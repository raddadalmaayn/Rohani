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
    
    // Define similarity threshold for relevance (higher = more strict)
    const SIMILARITY_THRESHOLD = 0.75;
    
    if (queryEmbedding) {
      console.log('Using semantic search with embeddings...');
      
      // Search Quran
      const { data: quranData, error: quranError } = await supabase
        .rpc('match_quran', {
          embedding_input: queryEmbedding,
          match_count: 3
        });
      
      if (!quranError && quranData) {
        // Filter by similarity threshold
        quranResults = quranData.filter((item: any) => item.similarity >= SIMILARITY_THRESHOLD);
        console.log('Quran search returned:', quranData.length, 'total,', quranResults.length, 'above threshold');
      }
      
      // Search Hadith  
      const { data: hadithData, error: hadithError } = await supabase
        .rpc('match_hadith', {
          embedding_input: queryEmbedding,
          match_count: 3
        });
      
      if (!hadithError && hadithData) {
        // Filter by similarity threshold
        hadithResults = hadithData.filter((item: any) => item.similarity >= SIMILARITY_THRESHOLD);
        console.log('Hadith search returned:', hadithData.length, 'total,', hadithResults.length, 'above threshold');
      }
    }
    
    // Only try text search fallback if embedding search completely failed (no API call)
    if (!queryEmbedding) {
      console.log('Using fallback text search...');
      
      // Search Quran table for exact matches only
      const { data: quranFallback } = await supabase
        .from('quran')
        .select('id, source_ref, text_ar, text_en')
        .filter('text_ar', 'ilike', `%${query}%`)
        .limit(2);
        
      if (quranFallback && quranFallback.length > 0) {
        quranResults = quranFallback.map(item => ({ ...item, similarity: 0.9 }));
      }
      
      // Search Hadith table for exact matches only
      const { data: hadithFallback } = await supabase
        .from('hadith')
        .select('id, source_ref, text_ar, text_en')
        .filter('text_ar', 'ilike', `%${query}%`)
        .limit(2);
        
      if (hadithFallback && hadithFallback.length > 0) {
        hadithResults = hadithFallback.map(item => ({ ...item, similarity: 0.9 }));
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
        throw new Error(`OpenAI Chat API error: ${errorText}`);
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
      console.log('Using intelligent fallback advice based on context...');
      
      // Generate contextual advice based on the search query and found texts
      llmAdvice = generateContextualAdvice(query, allResults, lang);
      console.log('Contextual advice generated:', llmAdvice);
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

// Generate contextual advice based on query and found texts
function generateContextualAdvice(query: string, results: any[], lang: string = 'ar'): LLMResponse {
  const queryLower = query.toLowerCase();
  
  // Common Islamic topics and their advice
  const contextualAdvice: { [key: string]: { ar: { tip: string, dua: string }, en: { tip: string, dua: string } } } = {
    'ذكر|هم|حزن|غم': {
      ar: {
        tip: 'عند الهم والحزن، أكثر من ذكر الله تعالى. قل "لا إله إلا الله العظيم الحليم، لا إله إلا الله رب العرش العظيم". أيضاً أكثر من الاستغفار والصلاة على النبي صلى الله عليه وسلم. احرص على قراءة القرآن خاصة سورة الفاتحة والمعوذتين.',
        dua: 'اللهم أذهب عني الهم والحزن والغم، وأبدلني بهما الفرح والسرور والسعادة'
      },
      en: {
        tip: 'During times of worry and sadness, increase your remembrance of Allah. Say "La ilaha illa Allah al-Azeem al-Haleem, La ilaha illa Allah Rabb al-Arsh al-Azeem". Also increase istighfar and sending blessings upon the Prophet. Make sure to read Quran, especially Al-Fatiha and the protective surahs.',
        dua: 'O Allah, remove from me worry, sadness and grief, and replace them with joy and happiness'
      }
    },
    'صلاة|قيام|ثبات': {
      ar: {
        tip: 'للثبات على الصلاة، ابدأ بالفرائض أولاً وأتقنها. اضبط المنبه لأوقات الصلاة، وتوضأ مبكراً. ابحث عن مكان هادئ للصلاة، واقرأ دعاء الاستفتاح بخشوع. ذكر نفسك دائماً أن الصلاة هي الركن الثاني من أركان الإسلام.',
        dua: 'اللهم أعني على ذكرك وشكرك وحسن عبادتك، واجعلني من المقيمين للصلاة'
      },
      en: {
        tip: 'To be consistent with prayer, start with the obligatory prayers first and perfect them. Set alarms for prayer times, and make ablution early. Find a quiet place for prayer, and recite the opening supplication with humility. Always remind yourself that prayer is the second pillar of Islam.',
        dua: 'O Allah, help me with Your remembrance, gratitude, and excellent worship, and make me among those who establish prayer'
      }
    },
    'قرآن|تلاوة|حفظ': {
      ar: {
        tip: 'لتلاوة القرآن بانتظام، خصص وقتاً ثابتاً يومياً ولو لمدة 10 دقائق. ابدأ بالسور القصيرة واحفظها جيداً. استخدم تطبيقات القرآن للمتابعة. اقرأ بتدبر وفهم للمعاني، وليس فقط للحفظ.',
        dua: 'اللهم اجعل القرآن ربيع قلبي ونور صدري وجلاء حزني وذهاب همي'
      },
      en: {
        tip: 'To read Quran regularly, dedicate a fixed time daily, even if just 10 minutes. Start with short surahs and memorize them well. Use Quran apps for tracking. Read with contemplation and understanding of meanings, not just for memorization.',
        dua: 'O Allah, make the Quran the spring of my heart, the light of my chest, the remover of my sadness and the dispeller of my worries'
      }
    }
  };
  
  // Find matching advice based on query content
  for (const [pattern, advice] of Object.entries(contextualAdvice)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(query)) {
      return {
        practical_tip: advice[lang as keyof typeof advice].tip,
        dua: advice[lang as keyof typeof advice].dua
      };
    }
  }
  
  // Default advice if no specific match
  return {
    practical_tip: lang === 'en' 
      ? "Remember that Allah is always with you in times of difficulty. Turn to Him through prayer, remembrance, and reading the Quran. Be patient and trust in His wisdom, for He knows what is best for you."
      : "تذكر أن الله معك دائماً في أوقات الصعوبة. توجه إليه بالدعاء والذكر وقراءة القرآن. اصبر وتوكل عليه، فهو يعلم ما هو خير لك.",
    dua: lang === 'en'
      ? "O Allah, grant me patience and make my affairs easy for me"
      : "اللهم اصبرني واجعل لي من أمري يسراً"
  };
}