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
      console.log('Embedding length:', queryEmbedding.length);
      console.log('First 5 values:', queryEmbedding.slice(0, 5));
      
      // Use semantic search with embeddings
      const vectorString = '[' + queryEmbedding.join(',') + ']';
      console.log('Vector string format:', vectorString.substring(0, 100) + '...');
      console.log('Vector string length:', vectorString.length);
      
      const { data, error: searchError } = await supabase
        .rpc('match_scripture', {
          embedding_input: vectorString,  // Changed parameter name to match function
          match_count: 6
        });
      
      console.log('RPC call completed');
      console.log('Search error:', searchError);
      console.log('Search data type:', typeof data);
      console.log('Search data length:', Array.isArray(data) ? data.length : 'not array');
      console.log('Search data content:', JSON.stringify(data));
      
      if (searchError) {
        console.error('Semantic search error:', searchError);
        scriptures = null;
      } else {
        console.log('Semantic search returned:', data?.length || 0, 'results');
        scriptures = data;
      }
    }
    
    // Fallback to text search if embedding search failed
    if (!scriptures || scriptures.length === 0) {
      console.log('Using fallback text search...');
      console.log('Search query:', query);
      
      // Extract key words from the query for better text search
      const queryWords = query.trim().split(/\s+/).filter(word => word.length > 2);
      let searchResults = [];
      
      // Try searching for each meaningful word
      for (const word of queryWords.slice(0, 3)) { // Limit to first 3 words
        console.log('Searching for word:', word);
        const { data } = await supabase
          .from('scripture')
          .select('id, source_ref, text_ar, text_type, chapter_name, verse_number')
          .filter('text_ar', 'ilike', `%${word}%`)
          .limit(3);
          
        if (data && data.length > 0) {
          searchResults.push(...data.map(item => ({ ...item, similarity: 0.7 })));
        }
      }
      
      // Remove duplicates based on id
      const uniqueResults = searchResults.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );
      
      scriptures = uniqueResults.slice(0, 6); // Limit to 6 results
      console.log('Text search returned:', scriptures?.length || 0, 'results');
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

    const systemMessage = `أنت مساعد روحي إسلامي متخصص. مهمتك تقديم نصائح عملية مفيدة وفريدة.

إرشادات مهمة:
1. لكل سؤال، قدم إجابة مختلفة وفريدة تماماً
2. اقرأ النصوص المرفقة بعناية - إذا كانت مناسبة للسؤال، استخدمها. إذا لم تكن مناسبة، تجاهلها وقدم نصيحة عامة
3. ركز على النصائح العملية القابلة للتطبيق في الحياة اليومية (100-150 كلمة)
4. تجنب تكرار نفس المحتوى أو النصوص في إجابات مختلفة
5. اجعل كل إجابة فريدة ومخصصة للسؤال المحدد
6. لا تقدم أحكاماً شرعية أو فتاوى

صيغة الرد JSON:
{
  "practical_tip": "نصيحة عملية فريدة ومفيدة...",
  "dua": "دعاء مناسب يبدأ بـ اللهم..."
}`;

    const userMessage = `السؤال: ${query}

النصوص المرجعية (استخدمها فقط إذا كانت مناسبة للسؤال):
${context}

قدم نصيحة عملية فريدة ومفيدة للسؤال، مع دعاء مناسب.`;

    // 4. Generate practical advice using GPT (with fallback)
    console.log('Starting GPT generation...');
    console.log('Context for GPT:', context.substring(0, 200) + '...');
    
    let llmAdvice: LLMResponse;
    
    try {
      console.log('Calling OpenAI Chat API...');
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
          temperature: 0.8,
          max_tokens: 600
        }),
      });

      console.log('OpenAI API response status:', chatResponse.status);
      
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
      console.log('OpenAI response received:', chatData.choices?.length || 0, 'choices');
      
      const gptResponse = chatData.choices[0].message.content;
      console.log('GPT raw response:', gptResponse);

      // Parse JSON response from GPT
      try {
        llmAdvice = JSON.parse(gptResponse);
        console.log('Successfully parsed GPT response:', llmAdvice);
      } catch (parseError) {
        console.error('Failed to parse GPT response as JSON:', gptResponse);
        console.error('Parse error:', parseError);
        throw new Error('parse_error');
      }
    } catch (gptError) {
      console.error('GPT generation failed:', gptError);
      console.log('Using fallback advice...');
      // Fallback advice based on query content
      llmAdvice = generateFallbackAdvice(query);
      console.log('Fallback advice generated:', llmAdvice);
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

    console.log('Final llmAdvice object:', JSON.stringify(llmAdvice, null, 2));
    console.log('Practical tip:', llmAdvice?.practical_tip);
    console.log('Dua:', llmAdvice?.dua);
    
    const finalResponse = {
      scriptures: scriptures || [],
      practical_tip: llmAdvice?.practical_tip || "حدث خطأ في توليد النصيحة",
      dua: llmAdvice?.dua || "اللهم أرشدنا إلى الحق",
      is_sensitive: false
    };
    
    console.log('Final response being sent:', JSON.stringify(finalResponse, null, 2));
    console.log('Response timestamp:', new Date().toISOString());
    
    return new Response(JSON.stringify(finalResponse), {
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
  return {
    practical_tip: "عذراً، لا يمكنني معالجة طلبك حالياً. يرجى المحاولة مرة أخرى أو صياغة السؤال بطريقة أخرى.",
    dua: "اللهم يسر لنا أمورنا واهدنا إلى ما فيه خير"
  };
}