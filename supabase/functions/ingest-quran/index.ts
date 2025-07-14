import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuranData {
  sura: number;
  aya: number;
  text: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Quran data ingestion...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tanzil Uthmani data - simplified version with key surahs
    const quranData: QuranData[] = [
      // Al-Fatihah (complete)
      { sura: 1, aya: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
      { sura: 1, aya: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
      { sura: 1, aya: 3, text: "الرَّحْمَٰنِ الرَّحِيمِ" },
      { sura: 1, aya: 4, text: "مَالِكِ يَوْمِ الدِّينِ" },
      { sura: 1, aya: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
      { sura: 1, aya: 6, text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" },
      { sura: 1, aya: 7, text: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ" },

      // Al-Baqarah (first 20 verses)
      { sura: 2, aya: 1, text: "الم" },
      { sura: 2, aya: 2, text: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ" },
      { sura: 2, aya: 3, text: "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ" },
      { sura: 2, aya: 4, text: "وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ" },
      { sura: 2, aya: 5, text: "أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ" },
      { sura: 2, aya: 6, text: "إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ أَأَنذَرْتَهُمْ أَمْ لَمْ تُنذِرْهُمْ لَا يُؤْمِنُونَ" },
      { sura: 2, aya: 7, text: "خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ وَعَلَىٰ سَمْعِهِمْ وَعَلَىٰ أَبْصَارِهِمْ غِشَاوَةٌ وَلَهُمْ عَذَابٌ عَظِيمٌ" },
      { sura: 2, aya: 8, text: "وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ وَبِالْيَوْمِ الْآخِرِ وَمَا هُم بِمُؤْمِنِينَ" },
      { sura: 2, aya: 9, text: "يُخَادِعُونَ اللَّهَ وَالَّذِينَ آمَنُوا وَمَا يَخْدَعُونَ إِلَّا أَنفُسَهُمْ وَمَا يَشْعُرُونَ" },
      { sura: 2, aya: 10, text: "فِي قُلُوبِهِم مَّرَضٌ فَزَادَهُمُ اللَّهُ مَرَضًا وَلَهُمْ عَذَابٌ أَلِيمٌ بِمَا كَانُوا يَكْذِبُونَ" },

      // Al-Ikhlas (complete)
      { sura: 112, aya: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
      { sura: 112, aya: 2, text: "اللَّهُ الصَّمَدُ" },
      { sura: 112, aya: 3, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ" },
      { sura: 112, aya: 4, text: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ" },

      // Al-Falaq (complete)
      { sura: 113, aya: 1, text: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ" },
      { sura: 113, aya: 2, text: "مِن شَرِّ مَا خَلَقَ" },
      { sura: 113, aya: 3, text: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ" },
      { sura: 113, aya: 4, text: "وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ" },
      { sura: 113, aya: 5, text: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ" },

      // An-Nas (complete)
      { sura: 114, aya: 1, text: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ" },
      { sura: 114, aya: 2, text: "مَلِكِ النَّاسِ" },
      { sura: 114, aya: 3, text: "إِلَٰهِ النَّاسِ" },
      { sura: 114, aya: 4, text: "مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ" },
      { sura: 114, aya: 5, text: "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ" },
      { sura: 114, aya: 6, text: "مِنَ الْجِنَّةِ وَالنَّاسِ" },
    ];

    console.log(`Processing ${quranData.length} verses...`);

    // Delete existing verses to avoid duplicates
    const { error: deleteError } = await supabase
      .from('verses')
      .delete()
      .neq('id', 0); // Delete all

    if (deleteError) {
      console.error('Error deleting existing verses:', deleteError);
    }

    // Insert verses in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < quranData.length; i += batchSize) {
      const batch = quranData.slice(i, i + batchSize);
      const versesToInsert = batch.map(verse => ({
        surah_id: verse.sura,
        ayah_number: verse.aya,
        text_ar: verse.text,
        text_en: null // We'll add English translation later if needed
      }));

      const { data, error } = await supabase
        .from('verses')
        .insert(versesToInsert)
        .select();

      if (error) {
        console.error('Error inserting batch:', error);
        throw error;
      }

      insertedCount += data?.length || 0;
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}, total: ${insertedCount}`);
    }

    console.log(`Successfully ingested ${insertedCount} verses`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully ingested ${insertedCount} verses`,
        inserted_count: insertedCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ingest-quran function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});