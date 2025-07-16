import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    console.log("Starting Quran data ingestion...");

    // Check if verses table already has data
    const { data: existingVerses, error: checkError } = await supabase
      .from('verses')
      .select('surah_no')
      .limit(1);

    if (checkError) {
      console.error("Error checking existing data:", checkError);
      return json({ success: false, error: checkError.message }, 500);
    }

    if (existingVerses && existingVerses.length > 0) {
      console.log("Verses table already contains data. Skipping ingestion.");
      return json({ success: true, message: "Data already exists", total: existingVerses.length });
    }

    // For now, let's just verify the table structure and log what we find
    const { data: tableStructure, error: structureError } = await supabase
      .from('verses')
      .select('*')
      .limit(1);

    console.log("Table structure check:", { tableStructure, structureError });

    // Check what columns exist
    const { data: sampleData, error: sampleError } = await supabase
      .rpc('get_table_columns', { table_name: 'verses' })
      .catch(() => {
        // If RPC doesn't exist, try a simple select
        return supabase.from('verses').select('*').limit(0);
      });

    console.log("Available columns:", sampleData);

    return json({ 
      success: true, 
      message: "Table structure verified", 
      structure: tableStructure,
      sample: sampleData 
    });

  } catch (e) {
    console.error("Error in ingest function:", e);
    return json({ success: false, error: e.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}