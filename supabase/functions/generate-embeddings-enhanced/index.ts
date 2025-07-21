import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Generate embeddings enhanced function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    let totalProcessed = 0;
    let totalErrors = 0;

    // Process Quran verses without embeddings
    console.log('Processing Quran verses...');
    const { data: quranVerses, error: quranFetchError } = await supabase
      .from('quran')
      .select('id, text_ar')
      .is('embedding', null)
      .limit(200);

    if (quranFetchError) {
      throw new Error(`Failed to fetch Quran verses: ${quranFetchError.message}`);
    }

    console.log(`Found ${quranVerses?.length || 0} Quran verses without embeddings`);

    if (quranVerses && quranVerses.length > 0) {
      for (const verse of quranVerses) {
        try {
          console.log(`Processing Quran verse ${verse.id}...`);
          
          // Generate embedding
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: verse.text_ar,
              model: 'text-embedding-3-small'
            }),
          });

          if (!embeddingResponse.ok) {
            throw new Error(`OpenAI API error: ${await embeddingResponse.text()}`);
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Update verse with embedding
          const { error: updateError } = await supabase
            .from('quran')
            .update({ embedding })
            .eq('id', verse.id);

          if (updateError) {
            throw new Error(`Failed to update Quran verse: ${updateError.message}`);
          }

          totalProcessed++;
          console.log(`Successfully processed Quran verse ${verse.id}`);

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Failed to process Quran verse ${verse.id}:`, error);
          totalErrors++;
        }
      }
    }

    // Process Hadith without embeddings
    console.log('Processing Hadith...');
    const { data: hadiths, error: hadithFetchError } = await supabase
      .from('hadith')
      .select('id, text_ar')
      .is('embedding', null)
      .limit(200);

    if (hadithFetchError) {
      throw new Error(`Failed to fetch Hadith: ${hadithFetchError.message}`);
    }

    console.log(`Found ${hadiths?.length || 0} Hadith without embeddings`);

    if (hadiths && hadiths.length > 0) {
      for (const hadith of hadiths) {
        try {
          console.log(`Processing Hadith ${hadith.id}...`);
          
          // Generate embedding
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: hadith.text_ar,
              model: 'text-embedding-3-small'
            }),
          });

          if (!embeddingResponse.ok) {
            throw new Error(`OpenAI API error: ${await embeddingResponse.text()}`);
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Update hadith with embedding
          const { error: updateError } = await supabase
            .from('hadith')
            .update({ embedding })
            .eq('id', hadith.id);

          if (updateError) {
            throw new Error(`Failed to update Hadith: ${updateError.message}`);
          }

          totalProcessed++;
          console.log(`Successfully processed Hadith ${hadith.id}`);

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Failed to process Hadith ${hadith.id}:`, error);
          totalErrors++;
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Embedding generation completed',
      total_processed: totalProcessed,
      total_errors: totalErrors,
      quran_count: quranVerses?.length || 0,
      hadith_count: hadiths?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-embeddings-enhanced function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});