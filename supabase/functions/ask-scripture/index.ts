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
    const { query, lang = 'ar', user_id } = await req.json();

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
          model: 'text-embedding-ada-002'  // Use the more available model
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

    // 2. Search for similar scriptures in both quran and hadith tables
    console.log('Searching for scriptures...');
    let quranResults = [];
    let hadithResults = [];
    
    if (queryEmbedding) {
      console.log('Using semantic search with embeddings...');
      
      // Search Quran
      const { data: quranData, error: quranError } = await supabase
        .rpc('match_quran', {
          embedding_input: queryEmbedding,
          match_count: 3
        });
      
      if (!quranError && quranData) {
        quranResults = quranData;
        console.log('Quran search returned:', quranResults.length, 'results');
      }
      
      // Search Hadith  
      const { data: hadithData, error: hadithError } = await supabase
        .rpc('match_hadith', {
          embedding_input: queryEmbedding,
          match_count: 3
        });
      
      if (!hadithError && hadithData) {
        hadithResults = hadithData;
        console.log('Hadith search returned:', hadithResults.length, 'results');
      }
    }
    
    // Fallback to text search if embedding search failed
    if (quranResults.length === 0 && hadithResults.length === 0) {
      console.log('Using fallback text search...');
      
      // Search Quran table
      const { data: quranFallback } = await supabase
        .from('quran')
        .select('id, source_ref, text_ar, text_en')
        .filter('text_ar', 'ilike', `%${query}%`)
        .limit(3);
        
      if (quranFallback && quranFallback.length > 0) {
        quranResults = quranFallback.map(item => ({ ...item, similarity: 0.8 }));
      }
      
      // Search Hadith table
      const { data: hadithFallback } = await supabase
        .from('hadith')
        .select('id, source_ref, text_ar, text_en')
        .filter('text_ar', 'ilike', `%${query}%`)
        .limit(3);
        
      if (hadithFallback && hadithFallback.length > 0) {
        hadithResults = hadithFallback.map(item => ({ ...item, similarity: 0.8 }));
      }
      
      // If still no results, try word-based search
      if (quranResults.length === 0 && hadithResults.length === 0) {
        const queryWords = query.trim().split(/\s+/).filter(word => word.length > 2);
        console.log('Extracted words for search:', queryWords);
        
        for (const word of queryWords.slice(0, 2)) {
          console.log('Searching for word:', word);
          
          // Search in Quran
          const { data: quranWord } = await supabase
            .from('quran')
            .select('id, source_ref, text_ar, text_en')
            .filter('text_ar', 'ilike', `%${word}%`)
            .limit(1);
            
          if (quranWord && quranWord.length > 0) {
            quranResults.push(...quranWord.map(item => ({ ...item, similarity: 0.6 })));
          }
          
          // Search in Hadith
          const { data: hadithWord } = await supabase
            .from('hadith')
            .select('id, source_ref, text_ar, text_en')
            .filter('text_ar', 'ilike', `%${word}%`)
            .limit(1);
            
          if (hadithWord && hadithWord.length > 0) {
            hadithResults.push(...hadithWord.map(item => ({ ...item, similarity: 0.6 })));
          }
        }
        
        // Last resort fallback
        if (quranResults.length === 0 && hadithResults.length === 0) {
          console.log('No word matches found, trying fallback...');
          
          const { data: fallbackQuran } = await supabase
            .from('quran')
            .select('id, source_ref, text_ar, text_en')
            .filter('text_ar', 'ilike', '%الله%')
            .limit(2);
            
          const { data: fallbackHadith } = await supabase
            .from('hadith')
            .select('id, source_ref, text_ar, text_en')
            .filter('text_ar', 'ilike', '%الله%')
            .limit(1);
            
          if (fallbackQuran && fallbackQuran.length > 0) {
            console.log('Fallback Quran search successful:', fallbackQuran.length);
            quranResults = fallbackQuran.map(item => ({ ...item, similarity: 0.5 }));
          }
          
          if (fallbackHadith && fallbackHadith.length > 0) {
            console.log('Fallback Hadith search successful:', fallbackHadith.length);
            hadithResults = fallbackHadith.map(item => ({ ...item, similarity: 0.5 }));
          }
        }
      }
    }

    console.log('Final results - Quran:', quranResults.length, 'Hadith:', hadithResults.length);

    // 3. If sensitive topic, return only scriptures without LLM advice
    if (isSensitiveTopic) {
      console.log('Sensitive topic detected, returning results only');
      return new Response(JSON.stringify({
        ayat: quranResults || [],
        ahadith: hadithResults || [],
        generic_tip: lang === 'en' 
          ? "This question requires consultation with qualified religious scholars."
          : "هذا السؤال يحتاج إلى استشارة أهل العلم المختصين.",
        dua: lang === 'en'
          ? "O Allah, guide us to the truth and help us follow it"
          : "اللهم أرشدنا إلى الحق وأعنا على اتباعه",
        is_sensitive: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Generate practical advice using GPT
    if (quranResults.length === 0 && hadithResults.length === 0) {
      console.log('No results found for query');
      return new Response(JSON.stringify({
        ayat: [],
        ahadith: [],
        generic_tip: lang === 'en' 
          ? "I couldn't find suitable texts for your question. Try rephrasing it differently."
          : "لم أجد نصوص مناسبة لسؤالك. جرب صياغة السؤال بطريقة أخرى.",
        dua: lang === 'en'
          ? "O Allah, guide us to what is best for our religion and worldly life"
          : "اللهم أرشدنا إلى ما فيه خير ديننا ودنيانا",
        is_sensitive: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create context from found results
    const allResults = [...quranResults, ...hadithResults];
    const context = allResults
      .map((v: any) => `${v.source_ref}: ${v.text_ar}`)
      .join('\n');

    // Adjust system message based on language
    const systemMessage = lang === 'en' 
      ? `You are an Islamic spiritual assistant. Your task is to provide practical and useful advice.

Important guidelines:
1. For each question, provide a completely different and unique answer
2. Read the attached texts carefully - if they are suitable for the question, use them. If not, ignore them and provide general advice
3. Focus on practical advice applicable in daily life (100-150 words)
4. Avoid repeating the same content in different answers
5. Make each answer unique and tailored to the specific question
6. Do not provide religious rulings or fatwas

Response format JSON:
{
  "practical_tip": "Unique and useful practical advice...",
  "dua": "Appropriate prayer starting with O Allah..."
}`
      : `أنت مساعد روحي إسلامي متخصص. مهمتك تقديم نصائح عملية مفيدة وفريدة.

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

    const userMessage = lang === 'en'
      ? `Question: ${query}

Reference texts (use only if relevant to the question):
${context}

Provide unique and useful practical advice for the question, with an appropriate prayer.`
      : `السؤال: ${query}

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
      llmAdvice = generateFallbackAdvice(query, lang);
      console.log('Fallback advice generated:', llmAdvice);
    }

    // Store query for analytics (optional)
    if (user_id) {
      try {
        await supabase.from('user_queries').insert({
          user_id,
          query,
          query_type: 'scripture_search',
          results_count: quranResults.length + hadithResults.length
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
      ayat: quranResults || [],
      ahadith: hadithResults || [],
      generic_tip: llmAdvice?.practical_tip || (lang === 'en' ? "Error generating advice" : "حدث خطأ في توليد النصيحة"),
      dua: llmAdvice?.dua || (lang === 'en' ? "O Allah, guide us to the truth" : "اللهم أرشدنا إلى الحق"),
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
      ayat: [],
      ahadith: [],
      generic_tip: lang === 'en' ? "System error occurred. Please try again." : "حدث خطأ في النظام. حاول مرة أخرى.",
      dua: lang === 'en' ? "O Allah, make our affairs easy for us" : "اللهم يسر لنا أمورنا"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fallback advice generator when OpenAI is unavailable
function generateFallbackAdvice(query: string, lang: string = 'ar'): LLMResponse {
  return {
    practical_tip: lang === 'en' 
      ? "Sorry, I cannot process your request right now. Please try again or rephrase your question."
      : "عذراً، لا يمكنني معالجة طلبك حالياً. يرجى المحاولة مرة أخرى أو صياغة السؤال بطريقة أخرى.",
    dua: lang === 'en'
      ? "O Allah, make our affairs easy for us and guide us to what is best"
      : "اللهم يسر لنا أمورنا واهدنا إلى ما فيه خير"
  };
}