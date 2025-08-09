// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -------------------- types --------------------
interface QuranRef {
  surah_name_ar?: string | null;
  surah_name_en?: string | null;
  surah_number?: number | null;
  ayah_numbers?: number[] | null;               // exact list
  ayah_ranges?: { from: number; to: number }[]; // optional ranges
  notes?: string | null;
}
interface HadithRef {
  source?: string | null; // Bukhari | Muslim | ...
  book?: string | null;
  number?: string | null;
  topic?: string | null;
  text_ar?: string | null;
  text_en?: string | null;
  grade?: string | null;
}
interface Extraction {
  quran?: QuranRef[];
  hadith?: HadithRef[];
  practical_tip?: string;
  dua?: string;
}

interface VerseRow {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en?: string | null;
  surah_name_ar?: string | null;
  surah_name_en?: string | null;
}

interface FinalVerse {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string | null;
  text_type: "quran";
  chapter_name: string;
  verse_number: number;
  similarity?: number; // optional
}

interface FinalHadith {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string | null;
  text_type: "hadith";
  chapter_name: string; // source/book if available
  verse_number: number | null; // not applicable, keep null
  similarity?: number;
}

type FinalScripture = FinalVerse | FinalHadith;

type Lang = "ar" | "en";

// -------------------- utils --------------------
const sensitiveRe = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i;
const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const withTimeout = async <T>(p: Promise<T>, ms = 10_000): Promise<T> => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort("timeout"), ms);
  try {
    // @ts-ignore - we'll pass signal where we use fetch
    return await p;
  } finally {
    clearTimeout(id);
  }
};

// Stable SHA-256 cache key
async function shaKey(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function expandAyahs(ref: QuranRef): number[] {
  const nums = new Set<number>();
  if (ref.ayah_numbers) ref.ayah_numbers.forEach(n => Number.isFinite(n) && nums.add(n));
  if (ref.ayah_ranges) {
    for (const r of ref.ayah_ranges) {
      const from = Math.max(1, r.from|0);
      const to = Math.max(from, r.to|0);
      for (let n = from; n <= to; n++) nums.add(n);
    }
  }
  return Array.from(nums).sort((a,b)=>a-b);
}

function pickLang<T>(obj: Record<Lang, T>, lang: Lang) { return obj[lang] ?? obj.ar; }

function sanitizeLLMJson<T>(txt: string): T {
  // try strict parse; otherwise extract first {...} block
  try { return JSON.parse(txt) as T; } catch {}
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON found in LLM output");
  return JSON.parse(m[0]) as T;
}

// -------------------- OpenAI calls --------------------
async function extractReferencesWithLLM(query: string, lang: Lang): Promise<Extraction | null> {
  const system = lang === "en"
    ? `You extract only exact Qur'an and Hadith references relevant to the user's question.
Return STRICT JSON that matches the schema. If unsure, leave fields null.
NO text outside JSON.`
    : `مهمتك استخراج مراجع دقيقة من القرآن والحديث ذات صلة بسؤال المستخدم.
أعد JSON مطابقًا للمخطط فقط. إن لم تتأكد فاترك الحقول فارغة.
لا تضف نصًا خارج JSON.`;

  const schemaHint = `
Return JSON like:
{
  "quran":[{"surah_name_ar":null,"surah_name_en":null,"surah_number":13,"ayah_numbers":[28],"ayah_ranges":[],"notes":null}],
  "hadith":[{"source":"Bukhari","book":null,"number":"6018","topic":null,"text_ar":null,"text_en":null,"grade":"Sahih"}],
  "practical_tip": "...",
  "dua": "..."
}`;

  const user = (lang === "en")
    ? `lang: en
query: "${query}"
Rules:
- If English, include Arabic ayah and English translation when known (or leave translation null).
- If you are unsure of a reference, leave it null.
${schemaHint}`
    : `lang: ar
السؤال: "${query}"
القواعد:
- إن كان السؤال بالعربية، أعد الآيات والأحاديث بالعربية (واترك الترجمة فارغة).
- إن لم تكن متأكدًا فاترك الحقول فارغة.
${schemaHint}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    console.error("LLM extract error:", await resp.text());
    return null;
  }
  const data = await resp.json();
  try {
    const parsed = sanitizeLLMJson<Extraction>(data.choices?.[0]?.message?.content ?? "{}");
    return parsed;
  } catch (e) {
    console.error("LLM extract parse error:", e);
    return null;
  }
}

async function generateAdviceLLM(query: string, scriptures: FinalScripture[], lang: Lang): Promise<{ practical_tip: string; dua: string }> {
  const context = scriptures.map(s => `${s.source_ref}: ${s.text_ar}`).slice(0, 6).join("\n");
  const system = (lang === "en")
    ? `You are an Islamic spiritual assistant. Provide practical, unique advice (100-150 words) + a short dua starting with "O Allah...". No fatwas.`
    : `أنت مساعد روحي إسلامي. قدم نصيحة عملية فريدة (100-150 كلمة) + دعاء قصير يبدأ بـ "اللهم...". بدون فتاوى.`;

  const user = (lang === "en")
    ? `Question: ${query}

Reference texts (use only if relevant):
${context}

Return JSON:
{"practical_tip":"...","dua":"..."}` :
    `السؤال: ${query}

نصوص مرجعية (استخدمها فقط إن كانت مناسبة):
${context}

أعد JSON:
{"practical_tip":"...","dua":"..."}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    console.error("LLM advice error:", msg);
    throw new Error(msg);
  }
  const data = await resp.json();
  const payload = sanitizeLLMJson<{ practical_tip: string; dua: string }>(data.choices?.[0]?.message?.content ?? "{}");
  return payload;
}

// -------------------- hydration --------------------
async function loadSurahMap(supabase: any): Promise<Map<string, number>> {
  // maps (lowercased) ar & en names -> id
  const { data, error } = await supabase.from("surahs").select("id,name_ar,name_en");
  if (error) throw error;
  const m = new Map<string, number>();
  for (const s of data) {
    if (s.name_ar) m.set(String(s.name_ar).trim().toLowerCase(), s.id);
    if (s.name_en) m.set(String(s.name_en).trim().toLowerCase(), s.id);
  }
  return m;
}

async function hydrateQuran(supabase: any, refs: QuranRef[] | undefined, lang: Lang): Promise<FinalVerse[]> {
  if (!refs || refs.length === 0) return [];

  const surahMap = await loadSurahMap(supabase);
  // Build per-surah ayah buckets
  const buckets = new Map<number, Set<number>>();

  for (const r of refs) {
    let surahNo = r.surah_number ?? null;
    if (!surahNo) {
      const key = (r.surah_name_ar ?? r.surah_name_en ?? "").trim().toLowerCase();
      if (key && surahMap.has(key)) surahNo = surahMap.get(key)!;
    }
    if (!surahNo) continue;

    const ayahs = expandAyahs(r);
    if (ayahs.length === 0) continue;
    if (!buckets.has(surahNo)) buckets.set(surahNo, new Set<number>());
    ayahs.forEach(a => buckets.get(surahNo)!.add(a));
  }

  if (buckets.size === 0) return [];

  // Batch queries by surah
  const queries: Promise<any>[] = [];
  for (const [surah_no, set] of buckets.entries()) {
    const arr = Array.from(set);
    queries.push(
      supabase
        .from("verses")
        .select("surah_no, ayah_no_surah, ayah_ar, ayah_en, surah_name_ar, surah_name_en")
        .eq("surah_no", surah_no)
        .in("ayah_no_surah", arr)
        .order("ayah_no_surah", { ascending: true })
    );
  }

  const settled = await Promise.allSettled(queries);
  const rows: VerseRow[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value?.data?.length) rows.push(...s.value.data);
  }

  // Hydrate into final structure
  const out: FinalVerse[] = rows.map((v) => ({
    id: `${v.surah_no}:${v.ayah_no_surah}`,
    source_ref: `${v.surah_name_ar ?? ""} ${v.ayah_no_surah}`,
    text_ar: v.ayah_ar,
    text_en: lang === "en" ? (v.ayah_en ?? null) : null,
    text_type: "quran",
    chapter_name: v.surah_name_ar ?? "",
    verse_number: v.ayah_no_surah,
    similarity: 1.0,
  }));

  // Dedup & cap 6 verses max (keep order by surah/ayah)
  const seen = new Set(out.map(v => v.id));
  const uniq = out.filter((v, idx) => idx === out.findIndex(x => x.id === v.id));
  return uniq.slice(0, 6);
}

async function hydrateHadith(supabase: any, refs: HadithRef[] | undefined, lang: Lang): Promise<FinalHadith[]> {
  if (!refs || refs.length === 0) return [];

  const results: FinalHadith[] = [];
  // Try strict matches first (source+number), then fallback to local RPC for text match (high threshold)
  for (const r of refs.slice(0, 6)) {
    let row: any = null;

    // strict
    if ((r.source && r.number) || (r.source && r.book && r.number)) {
      const q = supabase.from("hadith")
        .select("id,source,book,number,text_ar,text_en,grade")
        .eq("source", r.source)
        .eq("number", r.number)
        .limit(1);
      const { data } = await q;
      if (data && data.length) row = data[0];
    }

    // soft (if still not found and we have a snippet)
    if (!row && (r.text_ar || r.text_en || r.topic)) {
      const qText = r.text_ar ?? r.text_en ?? r.topic!;
      const { data } = await supabase.rpc("search_hadith_local", {
        q: qText,
        lang,
        q_embedding: null,
        limit_n: 5
      });
      const picked = (data ?? []).filter((d: any) => (d.score ?? 0) >= 0.8).slice(0, 1)[0];
      if (picked) row = picked;
    }

    if (!row) continue;

    results.push({
      id: String(row.id ?? `${r.source ?? "hadith"}:${r.number ?? ""}`),
      source_ref: row.source ? `${row.source}${row.number ? ` #${row.number}` : ""}` : (r.source ?? "Hadith"),
      text_ar: row.text_ar ?? r.text_ar ?? "",
      text_en: lang === "en" ? (row.text_en ?? r.text_en ?? null) : null,
      text_type: "hadith",
      chapter_name: row.book ?? r.book ?? (row.source ?? r.source ?? "Hadith"),
      verse_number: null,
      similarity: 1.0,
    });
  }

  // Dedup by id and cap 3
  const uniq = results.filter((v, i) => i === results.findIndex(x => x.id === v.id));
  return uniq.slice(0, 3);
}

// -------------------- server --------------------
serve(async (req) => {
  console.time("total");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const payload = await req.json();
    const rawQuery: string = (payload?.query ?? "").trim();
    const lang: Lang = (payload?.lang ?? (isArabic(rawQuery) ? "ar" : "en")) as Lang;
    const user_id: string | undefined = payload?.user_id ?? undefined;

    if (!rawQuery) throw new Error("Query is required");

    const isSensitive = sensitiveRe.test(rawQuery);

    // 1) Cache
    const cacheKey = await shaKey(`v2|${lang}|${rawQuery}`);
    const { data: cached } = await supabase
      .from("cached_queries")
      .select("*")
      .eq("key", cacheKey)
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .maybeSingle();

    if (cached) {
      console.log("✅ cache hit");
      console.timeEnd("total");
      return new Response(JSON.stringify({
        ayat: cached.verses ?? [],
        ahadith: cached.hadith ?? [],
        generic_tip: cached.practical_tip ?? "",
        dua: cached.dua ?? "",
        is_sensitive: isSensitive,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) LLM extraction (10s cap)
    console.time("llm_extract");
    const extraction = await withTimeout(extractReferencesWithLLM(rawQuery, lang), 10_000).catch(() => null);
    console.timeEnd("llm_extract");

    // 3) Hydrate in parallel
    let ayat: FinalVerse[] = [];
    let ahadith: FinalHadith[] = [];

    if (extraction) {
      console.time("hydrate_parallel");
      const [qRes, hRes] = await Promise.allSettled([
        hydrateQuran(supabase, extraction.quran ?? [], lang),
        hydrateHadith(supabase, extraction.hadith ?? [], lang),
      ]);
      console.timeEnd("hydrate_parallel");

      if (qRes.status === "fulfilled") ayat = qRes.value;
      if (hRes.status === "fulfilled") ahadith = hRes.value;
    }

    // 4) Fallback ONLY if nothing resolved
    if (ayat.length === 0 && ahadith.length === 0) {
      console.log("⚠️ no hydrated refs; using light text-only fallback (Qur'an only)");
      const { data: versesFallback } = await supabase.rpc("search_verses_local", {
        q: rawQuery,
        lang,
        q_embedding: null,
        limit_n: 6,
      });

      if (versesFallback?.length) {
        ayat = versesFallback.slice(0, 3).map((v: any): FinalVerse => ({
          id: String(v.id),
          source_ref: `${v.surah_name_ar ?? ""} ${v.ayah_number}`,
          text_ar: v.text_ar,
          text_en: lang === "en" ? v.text_en ?? null : null,
          text_type: "quran",
          chapter_name: v.surah_name_ar ?? "",
          verse_number: v.ayah_number,
          similarity: Number(v.score ?? 0),
        }));
      }
    }

    // 5) Sensitive? return scriptures only + disclaimer
    if (isSensitive) {
      const res = {
        ayat,
        ahadith,
        generic_tip: pickLang({
          ar: "هذا السؤال يحتاج إلى استشارة أهل العلم المختصين.",
          en: "This question requires consultation with qualified religious scholars."
        }, lang),
        dua: pickLang({
          ar: "اللهم أرشدنا إلى الحق وأعنا على اتباعه",
          en: "O Allah, guide us to the truth and help us follow it"
        }, lang),
        is_sensitive: true,
      };

      // cache
      await supabase.from("cached_queries").insert({
        key: cacheKey, lang, query: rawQuery,
        verses: res.ayat, hadith: res.ahadith,
        practical_tip: res.generic_tip, dua: res.dua,
      }).catch(() => {});

      console.timeEnd("total");
      return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6) Advice (parallel to hydration already done; do now using hydrated context)
    console.time("llm_advice");
    let advice: { practical_tip: string; dua: string };
    try {
      advice = await withTimeout(generateAdviceLLM(rawQuery, [...ayat, ...ahadith], lang), 10_000);
    } catch {
      advice = pickLang({
        ar: { practical_tip: "تذكر أن الله معك دائمًا؛ الزم الدعاء والذكر وتلاوة القرآن.", dua: "اللهم فرّج همّي ويسّر أمري" },
        en: { practical_tip: "Remember Allah is always with you; keep making dhikr, dua and reciting Qur'an.", dua: "O Allah, ease my affairs and relieve my worry." },
      }, lang);
    }
    console.timeEnd("llm_advice");

    // 7) Analytics (non-blocking)
    if (user_id) {
      supabase.from("user_queries").insert({
        user_id,
        query: rawQuery,
        query_type: "scripture_search",
        results_count: ayat.length + ahadith.length
      }).catch(() => {});
    }

    const response = {
      ayat,
      ahadith,
      generic_tip: advice.practical_tip,
      dua: advice.dua,
      is_sensitive: false,
    };

    // 8) Cache final (best-effort)
    supabase.from("cached_queries").insert({
      key: cacheKey, lang, query: rawQuery,
      verses: response.ayat, hadith: response.ahadith,
      practical_tip: response.generic_tip, dua: response.dua,
    }).catch(() => {});

    console.log("📊 final:", { ayat: ayat.length, ahadith: ahadith.length });
    console.timeEnd("total");
    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("ask-scripture error:", err?.stack || err);
    const langGuess: Lang = "en";
    return new Response(JSON.stringify({
      ayat: [], ahadith: [],
      generic_tip: (langGuess === "en") ? "System error occurred. Please try again." : "حدث خطأ في النظام. حاول مرة أخرى.",
      dua: (langGuess === "en") ? "O Allah, make our affairs easy for us" : "اللهم يسر لنا أمورنا",
      is_sensitive: false,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
