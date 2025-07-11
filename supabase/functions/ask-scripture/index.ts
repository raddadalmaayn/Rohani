import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const supabase = createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false }
    });
    const { query, user_id } = await req.json();

    console.log('Processing query:', query);
    console.log('User ID:', user_id);

    if (!query || query.trim().length === 0) {
      throw new Error('Query is required');
    }

    // Check for sensitive religious topics that require scholars
    const sensitiveTopics = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i;
    const isSensitiveTopic = sensitiveTopics.test(query);

    // 1. Get embedding for the query (with fallback for quota issues)
    console.log('Getting embedding for query...');
    let queryEmbedding: number[] | null = null;
    
    try {
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          model: 'text-embedding-3-small'
        }),
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error('OpenAI Embedding API error:', errorText);
        
        // Check if it's a quota error
        if (errorText.includes('insufficient_quota')) {
          console.log('Quota exceeded, falling back to text search...');
          queryEmbedding = null; // Will trigger fallback search
        } else {
          throw new Error(`OpenAI Embedding API error: ${errorText}`);
        }
      } else {
        const embeddingData = await embeddingResponse.json();
        queryEmbedding = embeddingData.data[0].embedding;
      }
    } catch (embeddingError) {
      console.error('Embedding generation failed:', embeddingError);
      queryEmbedding = null; // Will trigger fallback search
    }

    // 2. Search for similar scriptures (with fallback)
    console.log('Searching for scriptures...');
    let scriptures;
    
    if (queryEmbedding) {
      console.log('Using semantic search with embeddings...');
      // Use semantic search with embeddings
      const vectorString = '[' + queryEmbedding.join(',') + ']';
      console.log('Vector string format:', vectorString.substring(0, 50) + '...');
      const { data, error: searchError } = await supabase
        .rpc('match_scripture', {
          embedding_input: vectorString,  // Changed parameter name to match function
          match_count: 6
        });
      
      if (searchError) {
        console.error('Semantic search error:', searchError);
        scriptures = null;
      } else {
        console.log('Semantic search returned:', data?.length || 0, 'results');
        console.log('SEMANTIC DATA →', JSON.stringify(data, null, 2));
        scriptures = data;
      }
    }
    
    // Fallback to text search if embedding search failed
    if (!scriptures || scriptures.length === 0) {
      console.log('Using fallback text search...');
      const { data, error: textSearchError } = await supabase
        .from('scripture')
        .select('id, source_ref, text_ar')
        .or(`text_ar.ilike.*${query}*,source_ref.ilike.*${query}*`)
        .limit(6);
        
      if (textSearchError) {
        console.error('Text search error:', textSearchError);
        scriptures = [];
      } else {
        console.log('Text search returned:', data?.length || 0, 'results');
        // Add similarity score for consistency (fake score for text search)
        scriptures = data?.map(item => ({ ...item, similarity: 0.8 })) || [];
      }
    }

    console.log('Final scriptures count:', scriptures?.length || 0);

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

    // 4. Generate practical advice using GPT (with fallback)
    let llmAdvice: LLMResponse;
    
    try {
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
        const errorText = await chatResponse.text();
        console.error('OpenAI Chat API error:', errorText);
        
        if (errorText.includes('insufficient_quota')) {
          console.log('Quota exceeded, using fallback advice...');
          throw new Error('quota_exceeded');
        } else {
          throw new Error(`OpenAI Chat API error: ${errorText}`);
        }
      }

      const chatData = await chatResponse.json();
      const gptResponse = chatData.choices[0].message.content;

      console.log('GPT response received');

      // Parse JSON response from GPT
      try {
        llmAdvice = JSON.parse(gptResponse);
      } catch (parseError) {
        console.error('Failed to parse GPT response as JSON:', gptResponse);
        throw new Error('parse_error');
      }
    } catch (gptError) {
      console.log('GPT generation failed, using fallback advice...');
      // Fallback advice based on query content
      llmAdvice = generateFallbackAdvice(query);
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
    console.error('Error in ask-scripture function:', error?.stack || error);
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

// Fallback advice generator when OpenAI is unavailable
function generateFallbackAdvice(query: string): LLMResponse {
  const queryLower = query.toLowerCase();
  
  // Simple keyword-based fallback advice
  if (queryLower.includes('صلاة') || queryLower.includes('صلى')) {
    return {
      practical_tip: "ابدأ بالصلوات الخمس في أوقاتها، واجعل لك مكاناً هادئاً للصلاة.",
      dua: "اللهم أعني على إقام الصلاة وأدائها في وقتها"
    };
  } else if (queryLower.includes('ذكر') || queryLower.includes('تسبيح')) {
    return {
      practical_tip: "اجعل لسانك رطباً بذكر الله، ابدأ بـ 33 تسبيحة و33 تحميدة و34 تكبيرة.",
      dua: "اللهم اجعل قلبي عامراً بذكرك ولساني رطباً بشكرك"
    };
  } else if (queryLower.includes('قرآن') || queryLower.includes('تلاوة')) {
    return {
      practical_tip: "اقرأ صفحة واحدة من القرآن يومياً، وتدبر في معانيها.",
      dua: "اللهم اجعل القرآن ربيع قلبي ونور صدري"
    };
  } else if (queryLower.includes('سكينة') || queryLower.includes('طمأنينة')) {
    return {
      practical_tip: "أكثر من الاستغفار والذكر، وتوكل على الله في جميع أمورك.",
      dua: "اللهم أنت السلام ومنك السلام، أدخلني في السلام"
    };
  } else {
    return {
      practical_tip: "ابدأ بخطوات صغيرة، واستعن بالله في كل أمورك، والزم الاستغفار.",
      dua: "اللهم أرشدنا إلى ما فيه خير ديننا ودنيانا وآخرتنا"
    };
  }
}