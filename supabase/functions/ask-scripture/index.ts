// index.ts – ask‑scripture v2
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve }          from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient }   from "https://esm.sh/@supabase/supabase-js@2.50.5";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL      = "gpt-4o-mini";          // adjust if you upgrade

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

/* ---------- utility ---------- */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type":"application/json" } });

async function getEmbedding(text: string): Promise<number[] | null> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method:"POST",
    headers:{ Authorization:`Bearer ${OPENAI_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({ model: EMBEDDING_MODEL, input: text })
  });
  if (!r.ok) return null;
  const { data } = await r.json();
  return data?.[0]?.embedding ?? null;
}

function detectSensitive(q: string) {
  return /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i.test(q);
}

async function match(table: "quran" | "hadith", emb: number[], count=6) {
  const { data, error } = await supabase.rpc(`match_${table}`, {
    embedding_input: "["+emb.join(",")+"]",
    match_count: count
  });
  if (error) return [];
  return data;
}

async function fullText(table:"quran"|"hadith", col="text_ar", q: string, count=6) {
  const { data } = await supabase
    .from(table)
    .select("id,source_ref,text_ar,text_en")
    .ilike(col, `%${q}%`)
    .limit(count);
  return data ?? [];
}

/* ---------- chat ---------- */
async function callGPT(promptSys: string, promptUser: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ Authorization:`Bearer ${OPENAI_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({
      model: CHAT_MODEL,
      messages:[
        { role:"system", content: promptSys },
        { role:"user",   content: promptUser }
      ],
      temperature:0.7,
      max_tokens:400
    })
  });
  if (!r.ok) throw new Error(await r.text());
  const { choices } = await r.json();
  return choices?.[0]?.message?.content ?? "";
}

/* ---------- handler ---------- */
serve(async req => {
  if (req.method === "OPTIONS") return json(null);

  try {
    const { query, user_id, lang = "ar" } = await req.json();
    if (!query?.trim()) throw new Error("Query is required");
    const sensitive = detectSensitive(query);
    const embedding = await getEmbedding(query) ?? [];

    /* 1. search Qurʾan + Hadith */
    let ayat    = embedding.length ? await match("quran",  embedding) : [];
    let ahadith = embedding.length ? await match("hadith", embedding) : [];

    if (!ayat.length)    ayat    = await fullText("quran",  "text_ar", query);
    if (!ahadith.length) ahadith = await fullText("hadith", "text_ar", query);

    /* 2. if still empty, trivial fallback */
    if (!ayat.length && !ahadith.length)
      ayat = await fullText("quran", "text_ar", "الله", 3);

    /* 3. Build GPT context */
    const contextQ = ayat.slice(0,3)
      .map(v=>`(QURAN) ${v.source_ref}: ${v.text_ar}`).join("\n");
    const contextH = ahadith.slice(0,3)
      .map(v=>`(HADITH) ${v.source_ref}: ${v.text_ar}`).join("\n");
    const context  = (contextQ+"\n"+contextH).trim();

    /* 4. Sensitive topic => scripture only */
    if (sensitive) {
      return json({
        ayat,
        ahadith,
        generic_tip:"يُنصح بمراجعة أهل العلم المتخصصين في هذا الموضوع.",
        dua:"اللهم أرشدنا إلى الحق",
        is_sensitive:true
      });
    }

    /* 5. Generate tip + dua */
    let generic_tip=""; let dua="";
    try {
      const sys = `أنت مساعد روحي. استخدم النصوص إذا كانت مناسبة. نصيحة ≤120كلمة، دعاء يبدأ بـ"اللهم".`;
      const usr = `السؤال: ${query}\n\nالنصوص:\n${context}\n\nأعطني نصيحة عملية ودعاء.`;
      const gpt = await callGPT(sys, usr);
      const parsed = JSON.parse(gpt);
      generic_tip = parsed.practical_tip;
      dua         = parsed.dua;
    } catch { /* fallback */ 
      generic_tip = "حاول التركيز على ذكر الله والتنفس العميق، وإعادة صياغة أهدافك اليومية بشكل أبسط.";
      dua         = "اللهم امنحني السكينة والفهم العميق.";
    }

    /* 6. optional analytics */
    if (user_id)
      await supabase.from("user_queries").insert({
        user_id, query, ayat:ayat.length, ahadith:ahadith.length
      });

    /* 7. respond */
    return json({
      ayat,
      ahadith,
      generic_tip,
      dua,
      is_sensitive:false
    });

  } catch (e) {
    console.error("ask-scripture error:", e);
    return json({
      error:e.message,
      ayat:[], ahadith:[],
      generic_tip:"عذرًا، حدث خطأ غير متوقع.",
      dua:"اللهم يسر لي أمري"
    }, 500);
  }
});
