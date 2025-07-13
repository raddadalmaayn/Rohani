import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuranVerse {
  surah: number;
  ayah: number;
  text: string;
}

// Sample Quranic verses (Al-Fatihah and first few verses of Al-Baqarah)
const sampleQuranData: QuranVerse[] = [
  // Al-Fatihah (1)
  { surah: 1, ayah: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
  { surah: 1, ayah: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
  { surah: 1, ayah: 3, text: "الرَّحْمَٰنِ الرَّحِيمِ" },
  { surah: 1, ayah: 4, text: "مَالِكِ يَوْمِ الدِّينِ" },
  { surah: 1, ayah: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
  { surah: 1, ayah: 6, text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" },
  { surah: 1, ayah: 7, text: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ" },
  
  // Al-Baqarah (2) - first 10 verses
  { surah: 2, ayah: 1, text: "الم" },
  { surah: 2, ayah: 2, text: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ" },
  { surah: 2, ayah: 3, text: "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ" },
  { surah: 2, ayah: 4, text: "وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ" },
  { surah: 2, ayah: 5, text: "أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ" },
  { surah: 2, ayah: 6, text: "إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ أَأَنذَرْتَهُمْ أَمْ لَمْ تُنذِرْهُمْ لَا يُؤْمِنُونَ" },
  { surah: 2, ayah: 7, text: "خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ وَعَلَىٰ سَمْعِهِمْ وَعَلَىٰ أَبْصَارِهِمْ غِشَاوَةٌ وَلَهُمْ عَذَابٌ عَظِيمٌ" },
  { surah: 2, ayah: 8, text: "وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ وَبِالْيَوْمِ الْآخِرِ وَمَا هُم بِمُؤْمِنِينَ" },
  { surah: 2, ayah: 9, text: "يُخَادِعُونَ اللَّهَ وَالَّذِينَ آمَنُوا وَمَا يَخْدَعُونَ إِلَّا أَنفُسَهُمْ وَمَا يَشْعُرُونَ" },
  { surah: 2, ayah: 10, text: "فِي قُلُوبِهِم مَّرَضٌ فَزَادَهُمُ اللَّهُ مَرَضًا وَلَهُمْ عَذَابٌ أَلِيمٌ بِمَا كَانُوا يَكْذِبُونَ" },
  
  // Add some verses from other surahs for variety
  { surah: 3, ayah: 1, text: "الم" },
  { surah: 3, ayah: 2, text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ" },
  { surah: 112, ayah: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
  { surah: 112, ayah: 2, text: "اللَّهُ الصَّمَدُ" },
  { surah: 112, ayah: 3, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ" },
  { surah: 112, ayah: 4, text: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ" },
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Quran ingestion...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if verses already exist
    const { count, error: countError } = await supabase
      .from('verses')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error checking verse count:', countError);
      throw countError;
    }

    console.log('Current verse count:', count);

    if (count && count > 0) {
      console.log('Verses already exist, skipping ingestion');
      return new Response(JSON.stringify({ 
        message: 'Verses already exist',
        count 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Inserting verses...');

    // Insert verses in batches
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < sampleQuranData.length; i += batchSize) {
      const batch = sampleQuranData.slice(i, i + batchSize);
      
      const versesToInsert = batch.map(verse => ({
        surah_id: verse.surah,
        ayah_number: verse.ayah,
        text_ar: verse.text,
      }));

      const { error: insertError } = await supabase
        .from('verses')
        .insert(versesToInsert);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        throw insertError;
      }

      insertedCount += batch.length;
      console.log(`Inserted batch: ${insertedCount}/${sampleQuranData.length}`);
    }

    console.log('Quran ingestion completed successfully');

    return new Response(JSON.stringify({ 
      message: 'Quran ingestion completed successfully',
      insertedVerses: insertedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ingest-quran function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to ingest Quran data'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});