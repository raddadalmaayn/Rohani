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
  console.log('Generate embeddings function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    // Get all scriptures without embeddings
    const { data: scriptures, error: fetchError } = await supabase
      .from('scripture')
      .select('id, text_ar')
      .is('embedding', null);

    if (fetchError) {
      throw new Error(`Failed to fetch scriptures: ${fetchError.message}`);
    }

    console.log(`Found ${scriptures?.length || 0} scriptures without embeddings`);

    if (!scriptures || scriptures.length === 0) {
      return new Response(JSON.stringify({
        message: 'No scriptures need embeddings',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let errors = 0;

    // Process scriptures in batches to avoid rate limits
    for (const scripture of scriptures) {
      try {
        console.log(`Processing scripture ${scripture.id}...`);
        
        // Generate embedding
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Organization': 'org-94b5lzv0LSQe5YkW7LQ0x5jU',
            'OpenAI-Project': 'proj_YdvX7tD5M7UJnVl4tV9PkmsT',
          },
          body: JSON.stringify({
            input: scripture.text_ar,
            model: 'text-embedding-3-small'
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI API error: ${await embeddingResponse.text()}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update scripture with embedding
        const { error: updateError } = await supabase
          .from('scripture')
          .update({ embedding })
          .eq('id', scripture.id);

        if (updateError) {
          throw new Error(`Failed to update scripture: ${updateError.message}`);
        }

        processed++;
        console.log(`Successfully processed scripture ${scripture.id} (${processed}/${scriptures.length})`);

        // Add delay to respect rate limits (100 requests per minute)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to process scripture ${scripture.id}:`, error);
        errors++;
      }
    }

    return new Response(JSON.stringify({
      message: 'Embedding generation completed',
      processed,
      errors,
      total: scriptures.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});