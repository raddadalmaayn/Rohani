// ask-scripture/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

// ──────────────────────────────────────────────────────────────────────────────
// Env
// ──────────────────────────────────────────────────────────────────────────────
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ──────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────
const cryptoRef = globalThis.crypto;

async function createCacheKey(query: string, lang: string) {
  const bytes = new TextEncoder().encode(`${query}::${lang}`);
  const hash = await cryptoRef.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type QuranVerse = {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string;
  similarity?: number;
  llm_score?: number;
};

type Hadith = QuranVerse;

type LLMAdvice = { practical_tip: string; dua: string };

type LLMScore = { id: string; score: number; reason?: string };
type LLMScoreResp = { scores: LLMScore[] };
type StrictKeepResp = { keep: number[] };

// Small helpers
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withTimeout<T>(p: Promise<T>, ms: number, label = "op"): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    // @ts-ignore typed for fetch; we only pass ctrl to fetch calls
    const res = await p;
    return res;
  } catch (err) {
    console.error(`${label} timed out or failed:`, err);
    // @ts-ignore
    throw err;
  } finally {
    clearTimeout(to);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// LLM helpers
// ──────────────────────────────────────────────────────────────────────────────
async function llmJSON({
  system,
  user,
  model = "gpt-4o-mini",
  temperature = 0.2,
  max_tokens = 1000,
  timeoutMs = 12000,
}: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
}) {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY missing");

  const req = fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const res = await withTimeout(req, timeoutMs, "openai");
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";

  // robust parse
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("OpenAI: invalid JSON");
  }
}

async function embed(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY) return null;
  try {
    const r = await withTimeout(
      fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          model: "text-embedding-3-small", // 1536-dim, modern & cheap
        }),
      }),
      8000,
      "embedding",
    );
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("Embedding failed, falling back to text-only:", e);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Re-ranking and advice (same logic you had, but guarded)
// ──────────────────────────────────────────────────────────────────────────────
async function rerankVersesStrict(query: string, verses: QuranVerse[], lang: "ar" | "en") {
  if (!verses?.length) return [];

  const versesForLLM = verses.map((v) => ({
    id: Number(v.id),
    text: v.text_ar.length > 200 ? v.text_ar.slice(0, 200) + "..." : v.text_ar,
  }));

  const sys = `You receive a user question and a list of Qur'an verses. 
Return ONLY the IDs of verses that DIRECTLY answer or clearly comfort the question.
0–3 IDs max. Strict JSON: {"keep":[123,456]}`;
  const user = JSON.stringify({ question: query, verses: versesForLLM });

  try {
    const parsed: StrictKeepResp = await llmJSON({
      system: sys,
      user,
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 100,
      timeoutMs: 9000,
    });

    const keep = new Set((parsed?.keep ?? []).map((n) => String(n)));
    const kept = verses.filter((v) => keep.has(v.id)).slice(0, 3);
    if (kept.length) return kept;

    // If model returns nothing, fall back to top similarity
    return verses
      .sort((a, b) => (b.llm_score ?? b.similarity ?? 0) - (a.llm_score ?? a.similarity ?? 0))
      .slice(0, 3);
  } catch (e) {
    console.error("Strict LLM filter failed, falling back:", e);
    return verses
      .filter((v) => (v.similarity ?? 0) >= 0.75)
      .slice(0, 3);
  }
}

async function rerankWithLLM(query: string, items: QuranVerse[], lang: "ar" | "en") {
  if (!items?.length) return [];
  const prepared = items.map((v) => ({
    id: v.id,
    source_ref: v.source_ref,
    text_ar: v.text_ar.length > 260 ? v.text_ar.slice(0, 260) + "..." : v.text_ar,
    text_en: v.text_en ? (v.text_en.length > 260 ? v.text_en.slice(0, 260) + "..." : v.text_en) : "",
  }));

  const sys =
    lang === "en"
      ? `You are a relevance scorer for Islamic texts. Score each 0–1. Only strong matches (>=0.75) should pass.\nReturn JSON: {"scores":[{"id":"x","score":0.9,"reason":"..."}]}`
      : `أنت مقيم صلة للنصوص الإسلامية. قيّم كل نص من 0–1. فقط التطابقات القوية (≥0.75) تمر.\nأرجع JSON: {"scores":[{"id":"x","score":0.9,"reason":"..."}]}`;

  const user =
    (lang === "en"
      ? `Query: "${query}"\n\nItems:\n`
      : `السؤال: "${query}"\n\nالنصوص:\n`) +
    prepared
      .map(
        (v, i) =>
          `${i + 1}. ID:${v.id} Ref:${v.source_ref}\nArabic:${v.text_ar}\nEnglish:${v.text_en || "N/A"}`,
      )
      .join("\n\n");

  try {
    const parsed: LLMScoreResp = await llmJSON({
      system: sys,
      user,
      model: "gpt-4o-mini",
      temperature: 0.1,
      timeoutMs: 12000,
    });

    const m = new Map(parsed?.scores?.map((s) => [String(s.id), s.score]) ?? []);
    return items
      .map((v) => ({ ...v, llm_score: m.get(String(v.id)) ?? 0 }))
      .filter((v) => (v.llm_score ?? 0) >= 0.75)
      .sort((a, b) => (b.llm_score ?? 0) - (a.llm_score ?? 0))
      .slice(0, 3);
  } catch (e) {
    console.error("LLM re-rank failed, using similarity/top-N:", e);
    return items
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, 3);
  }
}

function generateContextualAdvice(query: string, lang: "ar" | "en"): LLMAdvice {
  const bank: Record<
    string,
    { ar: { tip: string; dua: string }; en: { tip: string; dua: string } }
  > = {
    "ذكر|هم|حزن|غم": {
      ar: {
        tip:
          'عند الهم والحزن، أكثر من ذكر الله تعالى… اقرأ الفاتحة والمعوذتين، واستكثر من الاستغفار والصلاة على النبي ﷺ.',
        dua: "اللهم أذهب عني الهم والحزن والغم، وأبدلني بهما فرحًا وسرورًا",
      },
      en: {
        tip:
          "In worry and sadness, increase dhikr… read Al-Fatiha and the protective surahs; increase istighfar and salawat.",
        dua: "O Allah, remove my worry and grief and replace them with joy and ease",
      },
    },
    "صلاة|قيام|ثبات": {
      ar: {
        tip:
          "للثبات على الصلاة: اضبط المنبهات، توضأ مبكرًا، حافظ على الفريضة أولًا، وابحث عن بيئة هادئة.",
        dua: "اللهم أعني على ذكرك وشكرك وحسن عبادتك",
      },
      en: {
        tip:
          "To stay consistent with prayer: set alarms, make wudu early, prioritize fard first, and find a quiet spot.",
        dua: "O Allah, help me remember You, thank You, and worship You well",
      },
    },
  };

  for (const [pattern, a] of Object.entries(bank)) {
    if (new RegExp(pattern, "i").test(query)) {
      return lang === "en" ? a.en : a.ar;
    }
  }
  return lang === "en"
    ? {
        tip:
          "Turn to Allah with prayer and remembrance. Keep consistent, start small, and trust His wisdom during hardship.",
        dua: "O Allah, grant me patience and make my affairs easy",
      }
    : {
        tip:
          "توجّه إلى الله بالصلاة والذكر. داوم على القليل، وثق بحكمته عند الشدّة.",
        dua: "اللهم ارزقني الصبر ويسّر لي أمري",
      };
}

async function generateAdviceParallel(query: string, lang: "ar" | "en") {
  // Keep it robust—if OpenAI fails, fall back to static advice
  try {
    const sys =
      lang === "en"
        ? `You are an Islamic spiritual assistant. Produce unique, practical advice (100–150 words) and a short dua. Return JSON: {"practical_tip":"...","dua":"..."}.`
        : `أنت مساعد روحي إسلامي. قدّم نصيحة عملية موجزة (100–150 كلمة) ودعاءً قصيرًا. أرجع JSON: {"practical_tip":"...","dua":"..."}.`;

    const parsed = await llmJSON({
      system: sys,
      user: lang === "en" ? `Question: ${query}` : `السؤال: ${query}`,
      temperature: 0.8,
      max_tokens: 600,
      timeoutMs: 12000,
    });

    // minimal shape guard
    if (parsed?.practical_tip && parsed?.dua) return parsed as LLMAdvice;
    throw new Error("Advice shape invalid");
  } catch (e) {
    console.warn("Advice LLM failed, using contextual fallback:", e);
    return generateContextualAdvice(query, lang);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always keep defaults alive for the catch block
  let lang: "ar" | "en" = "ar";

  try {
    console.time("total");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Body parsing with guards
    const body = await req.json().catch(() => ({}));
    const queryRaw = String(body?.query ?? "").trim();
    lang = (body?.lang === "en" ? "en" : "ar"); // normalize
    const user_id = body?.user_id ?? null;

    if (!queryRaw) {
      // return OK with empty payload to avoid non-2xx toast
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Query is required",
          ayat: [],
          ahadith: [],
          generic_tip: generateContextualAdvice("", lang).practical_tip,
          dua: generateContextualAdvice("", lang).dua,
          is_sensitive: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic sensitive detection
    const isSensitive = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i.test(queryRaw);

    // Cache read
    const cacheKey = await createCacheKey(queryRaw, lang);
    const { data: cached } = await supabase
      .from("cached_queries")
      .select("*")
      .eq("key", cacheKey)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cached) {
      console.timeEnd("total");
      return new Response(
        JSON.stringify({
          ok: true,
          ayat: cached.verses ?? [],
          ahadith: cached.hadith ?? [],
          generic_tip: cached.practical_tip,
          dua: cached.dua,
          is_sensitive: false,
          cache: "hit",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Embedding (w/ cache)
    let qEmbedding: number[] | null = null;
    try {
      const embKey = await createCacheKey(queryRaw, "embedding");
      const { data: embCached } = await supabase
        .from("embedding_cache")
        .select("embedding")
        .eq("key", embKey)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      qEmbedding = embCached?.embedding ?? (await embed(queryRaw));
      if (qEmbedding && !embCached) {
        await supabase.from("embedding_cache").insert({ key: embKey, embedding: qEmbedding }).catch(
          () => {},
        );
      }
    } catch (e) {
      console.warn("Embedding cache error:", e);
    }

    // Expand query
    let searchQuery = queryRaw;
    try {
      const { data: expanded } = await supabase.rpc("expand_query_with_synonyms", {
        input_query: queryRaw,
        input_lang: lang,
      });
      if (expanded && typeof expanded === "string") searchQuery = expanded;
    } catch (e) {
      console.warn("expand_query_with_synonyms failed; using original query:", e);
    }

    // Parallel: verses, hadith, advice
    const [versesRes, hadithRes, adviceRes] = await Promise.allSettled([
      supabase.rpc("search_verses_local", {
        q: searchQuery,
        lang,
        q_embedding: qEmbedding ? `[${qEmbedding.join(",")}]` : null,
        limit_n: 12,
      }),
      supabase.rpc("search_hadith_local", {
        q: searchQuery,
        lang,
        q_embedding: qEmbedding ?? null,
        limit_n: 12,
      }),
      generateAdviceParallel(queryRaw, lang),
    ]);

    // Build results safely
    let verses: QuranVerse[] = [];
    let hadiths: Hadith[] = [];

    if (versesRes.status === "fulfilled" && versesRes.value?.data) {
      const data = versesRes.value.data as any[];
      verses = data.map((v) => ({
        id: String(v.id),
        source_ref: `${v.surah_name_ar} ${v.ayah_number}`,
        text_ar: v.text_ar,
        text_en: v.text_en,
        similarity: v.score ?? 0,
      }));
      // local filter + strict LLM filter
      const local = verses.filter((v) => (v.similarity ?? 0) >= 0.68);
      verses = await rerankVersesStrict(queryRaw, local, lang);
    }

    if (hadithRes.status === "fulfilled" && hadithRes.value?.data) {
      const data = hadithRes.value.data as any[];
      const base = data
        .map((h) => ({
          id: String(h.id),
          source_ref: h.source_ref,
          text_ar: h.text_ar,
          text_en: h.text_en,
          similarity: h.score ?? 0,
        }))
        .filter((h) => (h.similarity ?? 0) >= 0.6);
      hadiths =
        base.length > 3 || Math.max(...base.map((b) => b.similarity ?? 0)) < 0.8
          ? await rerankWithLLM(queryRaw, base, lang)
          : base.slice(0, 3);
    }

    // light fallback if both empty
    if (!verses.length && !hadiths.length) {
      try {
        const { data } = await supabase.rpc("search_verses_local", {
          q: searchQuery,
          lang,
          q_embedding: null,
          limit_n: 12,
        });
        if (data?.length) {
          const raw = (data as any[]).map((v) => ({
            id: String(v.id),
            source_ref: `${v.surah_name_ar} ${v.ayah_number}`,
            text_ar: v.text_ar,
            text_en: v.text_en,
            similarity: (v.score ?? 0) * 0.5,
          }));
          verses = await rerankWithLLM(queryRaw, raw, lang);
        }
      } catch (e) {
        console.warn("text-only fallback failed:", e);
      }
    }

    // advice
    const advice: LLMAdvice =
      adviceRes.status === "fulfilled"
        ? adviceRes.value
        : generateContextualAdvice(queryRaw, lang);

    // Sensitive handling: don’t block, just add a flag + softer generic tip
    const payload = {
      ok: true,
      ayat: verses,
      ahadith: hadiths,
      generic_tip: isSensitive
        ? lang === "en"
          ? "This topic may require a qualified scholar. The texts below are provided for reflection."
          : "قد يتطلب هذا الموضوع سؤال أهل العلم، والنصوص أدناه للعظة والتأمل."
        : advice.practical_tip,
      dua: advice.dua,
      is_sensitive: isSensitive,
      cache: "miss",
    };

    // cache write (best effort)
    try {
      await supabase.from("cached_queries").insert({
        key: await createCacheKey(queryRaw, lang),
        lang,
        query: queryRaw,
        verses,
        hadith: hadiths,
        practical_tip: payload.generic_tip,
        dua: payload.dua,
      });
    } catch {
      /* ignore cache errors */
    }

    // optional analytics (best effort)
    if (user_id) {
      supabase
        .from("user_queries")
        .insert({
          user_id,
          query: queryRaw,
          query_type: "scripture_search",
          results_count: verses.length + hadiths.length,
        })
        .catch(() => {});
    }

    console.timeEnd("total");
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Never return non-2xx to avoid the red toast in UI
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ask-scripture fatal:", msg);
    const fallback = generateContextualAdvice("", lang);
    return new Response(
      JSON.stringify({
        ok: false,
        message: msg,
        ayat: [],
        ahadith: [],
        generic_tip: fallback.practical_tip,
        dua: fallback.dua,
        is_sensitive: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
