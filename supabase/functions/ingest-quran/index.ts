import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface QuranData {
  sura: number;           // = surah_id
  aya:  number;           // = ayah_number
  text: string;           // = text_ar
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    /* 1. تحميل بيانات القرآن (أمثلة قصيرة هنا) */
    const quranData: QuranData[] = [ /* … */ ];

    /* 2. تفريغ الجدول بأمان */
    await supabase.rpc("truncate_table", { table_name: "verses" }); // أنشِئ هذه الدالة مرة واحدة في SQL
    // بديل سريع:
    // await supabase.from("verses").delete().neq("id", 0);

    /* 3. إدراج دفعات */
    const BATCH = 100;
    let total = 0;

    for (let i = 0; i < quranData.length; i += BATCH) {
      const batch = quranData.slice(i, i + BATCH).map(v => ({
        surah_id:    v.sura,
        ayah_number: v.aya,
        text_ar:     v.text,
        text_en:     null,     // حقل الترجمة إن وجد
        juz:         null,
        hizb:        null,
        page:        null
      }));

      const { data, error } = await supabase.from("verses").insert(batch).select("id");
      if (error) throw error;
      total += data!.length;
      console.log(`✓ batch ${Math.floor(i / BATCH) + 1} inserted, total = ${total}`);
    }

    return json({ success: true, inserted: total });

  } catch (e) {
    console.error(e);
    return json({ success: false, error: e.message }, 500);
  }
});

/* ---------- helpers ---------- */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
