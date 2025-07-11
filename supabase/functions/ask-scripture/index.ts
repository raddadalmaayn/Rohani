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

interface ScriptureResult {
  id: string;
  source_ref: string;
  text_ar: string;
  text_type: string;
  chapter_name: string;
  verse_number: number | null;
  similarity: number;
}

interface LLMResponse {
  practical_tip: string;
  dua: string;
}

serve(async (req) => {
  console.log('Ask Scripture function called');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const { query, user_id } = await req.json();

    console.log('Processing query:', query);

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required');
    }

    // Check for sensitive religious topics that require scholars
    const sensitiveTopics = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/;
    const isSensitiveTopic = sensitiveTopics.test(query);

    // 1. Get embedding for the query
    console.log('Getting embedding for query...');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-3-large'
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI Embedding API error: ${await embeddingResponse.text()}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search for similar scriptures
    console.log('Searching for similar scriptures...');
    const { data: scriptures, error: searchError } = await supabase
      .rpc('match_scripture', {
        query_embedding: queryEmbedding,
        match_count: 6
      });

    if (searchError) {
      console.error('Scripture search error:', searchError);
      throw new Error(`Scripture search failed: ${searchError.message}`);
    }

    console.log('Found scriptures:', scriptures?.length || 0);

    // 3. If sensitive topic, return only scriptures without LLM advice
    if (isSensitiveTopic) {
      console.log('Sensitive topic detected, returning scriptures only');
      return new Response(JSON.stringify({
        scriptures: scriptures || [],
        practical_tip: "هذا السؤال يحتاج إلى استشارة أهل العلم المختصين.",
        dua: "اللهم أرشدنا إلى الحق وأعنا على اتباعه",
        is_sensitive: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Generate practical advice using GPT
    if (!scriptures || scriptures.length === 0) {
      console.log('No scriptures found for query');
      return new Response(JSON.stringify({
        scriptures: [],
        practical_tip: "لم أجد نصوص مناسبة لسؤالك. جرب صياغة السؤال بطريقة أخرى.",
        dua: "اللهم أرشدنا إلى ما فيه خير ديننا ودنيانا",
        is_sensitive: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create context from found scriptures
    const context = scriptures
      .map((v: ScriptureResult) => `${v.source_ref}: ${v.text_ar}`)
      .join('\n');

    const systemMessage = `أنت مساعد روحي مسلم. تعطي نصائح عملية ودعاء بناء على النصوص الإسلامية الصحيحة فقط.

قوانين مهمة:
- اكتب practical_tip في ≤60 كلمة، نصيحة عملية بسيطة
- اكتب dua في ≤40 كلمة، يبدأ بـ"اللهم"
- لا تعطي أحكام شرعية (لا تقل حلال/حرام)
- لا تفتي في أمور الدين
- كن لطيف ومشجع
- أرجع إجابة بصيغة JSON فقط:
{
  "practical_tip": "نصيحة عملية...",
  "dua": "اللهم..."
}`;

    const userMessage = `سؤال المستخدم: ${query}

النصوص الدينية ذات الصلة:
${context}

أعطني نصيحة عملية ودعاء مناسب.`;

    console.log('Calling OpenAI for advice...');
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 300
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI Chat API error: ${await chatResponse.text()}`);
    }

    const chatData = await chatResponse.json();
    const gptResponse = chatData.choices[0].message.content;

    console.log('GPT response received');

    // Parse JSON response from GPT
    let llmAdvice: LLMResponse;
    try {
      llmAdvice = JSON.parse(gptResponse);
    } catch (parseError) {
      console.error('Failed to parse GPT response as JSON:', gptResponse);
      // Fallback response
      llmAdvice = {
        practical_tip: "ابدأ بخطوات صغيرة واستعن بالله في كل أمورك.",
        dua: "اللهم أعنا على ذكرك وشكرك وحسن عبادتك"
      };
    }

    // Store query for analytics (optional)
    if (user_id) {
      try {
        await supabase.from('user_queries').insert({
          user_id,
          query,
          query_type: 'scripture_search',
          results_count: scriptures.length
        });
      } catch (analyticsError) {
        console.log('Analytics storage failed:', analyticsError);
        // Don't fail the whole request for analytics
      }
    }

    return new Response(JSON.stringify({
      scriptures: scriptures || [],
      practical_tip: llmAdvice.practical_tip,
      dua: llmAdvice.dua,
      is_sensitive: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-scripture function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      scriptures: [],
      practical_tip: "حدث خطأ في النظام. حاول مرة أخرى.",
      dua: "اللهم يسر لنا أمورنا"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});