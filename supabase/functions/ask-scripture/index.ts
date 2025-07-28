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

// Cache crypto for consistent hashing
const crypto = globalThis.crypto;

// Helper function to create cache key
function createCacheKey(query: string, lang: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(query + lang);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

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

interface VerseScore {
  id: string;
  score: number;
  reason: string;
}

interface LLMRerankResponse {
  scores: VerseScore[];
}

serve(async (req) => {
  console.time('total');
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

    // Check cache first
    const cacheKey = await createCacheKey(query, lang);
    console.log('Cache key:', cacheKey);
    
    const { data: cachedResult } = await supabase
      .from('cached_queries')
      .select('*')
      .eq('key', cacheKey)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h cache
      .maybeSingle();
    
    if (cachedResult) {
      console.log('Cache hit! Returning cached result');
      console.timeEnd('total');
      return new Response(JSON.stringify({
        ayat: cachedResult.verses || [],
        ahadith: cachedResult.hadith || [],
        generic_tip: cachedResult.practical_tip,
        dua: cachedResult.dua,
        is_sensitive: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for sensitive religious topics that require scholars
    const sensitiveTopics = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i;
    const isSensitiveTopic = sensitiveTopics.test(query);

    // 1. Start parallel operations
    console.time('embed');
    
    // Check embedding cache first
    const embeddingCacheKey = await createCacheKey(query, 'embedding');
    const { data: cachedEmbedding } = await supabase
      .from('embedding_cache')
      .select('embedding')
      .eq('key', embeddingCacheKey)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 day cache
      .maybeSingle();
    
    let queryEmbedding: number[] | null = null;
    
    if (cachedEmbedding) {
      console.log('Embedding cache hit!');
      queryEmbedding = cachedEmbedding.embedding;
      console.timeEnd('embed');
    } else {
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: query,
            model: 'text-embedding-ada-002'  
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error('OpenAI Embedding API error:', errorText);
          
          if (errorText.includes('insufficient_quota')) {
            console.log('Quota exceeded, falling back to text search...');
            queryEmbedding = null;
          } else {
            throw new Error(`OpenAI Embedding API error: ${errorText}`);
          }
        } else {
          const embeddingData = await embeddingResponse.json();
          queryEmbedding = embeddingData.data[0].embedding;
          
          // Cache the embedding for future use
          try {
            await supabase.from('embedding_cache').insert({
              key: embeddingCacheKey,
              embedding: queryEmbedding
            });
          } catch (cacheError) {
            console.log('Failed to cache embedding:', cacheError);
          }
        }
        console.timeEnd('embed');
      } catch (embeddingError) {
        console.error('Embedding generation failed:', embeddingError);
        queryEmbedding = null;
        console.timeEnd('embed');
      }
    }

    // 2. Start parallel operations after embedding
    console.time('db_quran');
    console.time('db_hadith');
    console.time('llm_advice');
    
    // Expand query with synonyms for better matching
    const { data: expandedQuery } = await supabase
      .rpc('expand_query_with_synonyms', { 
        input_query: query, 
        input_lang: lang 
      });
    
    const searchQuery = expandedQuery || query;
    console.log(`Original query: "${query}", Expanded: "${searchQuery}"`);
    
    let quranResults = [];
    let hadithResults = [];
    let llmAdvice: LLMResponse;
    
    if (queryEmbedding) {
      console.log('Using semantic search with embeddings...');
      
      // Parallel search operations
      const [versesPromise, hadithPromise, advicePromise] = await Promise.allSettled([
        // Verses search
        supabase.rpc('search_verses_local', {
          q: searchQuery,
          lang: lang,
          q_embedding: `[${queryEmbedding.join(',')}]`,
          limit_n: 12
        }),
        
        // Hadith search  
        supabase.rpc('search_hadith_local', {
          q: searchQuery,
          lang: lang,
          q_embedding: queryEmbedding,
          limit_n: 12
        }),
        
        // LLM advice generation (start early)
        generateAdviceParallel(query, lang, [])
      ]);
      
      // Process verses results
      console.timeEnd('db_quran');
      if (versesPromise.status === 'fulfilled' && versesPromise.value.data) {
        const versesData = versesPromise.value.data;
        console.log('raw verses:', versesData.length);
        
        const rawVerses = versesData.map(v => ({
          id: v.id.toString(),
          source_ref: `${v.surah_name_ar} ${v.ayah_number}`,
          text_ar: v.text_ar,
          text_en: v.text_en,
          similarity: v.score
        }));

        // Apply conditional LLM re-ranking
        if (rawVerses.length > 3 || (rawVerses.length > 0 && Math.max(...rawVerses.map(r => r.similarity)) < 0.80)) {
          console.time('llm_rerank');
          try {
            const rerankedVerses = await rerankVersesWithLLM(query, rawVerses, lang);
            quranResults = rerankedVerses;
            console.log('afterLLM:', quranResults.length);
          } catch (llmError) {
            console.error('LLM re-ranking failed, using fallback:', llmError);
            const MIN_VERSE_SCORE = 0.60;
            quranResults = rawVerses.filter(r => r.similarity >= MIN_VERSE_SCORE).slice(0, 3);
            console.log('afterLLM (fallback):', quranResults.length);
          }
          console.timeEnd('llm_rerank');
        } else {
          // Skip LLM re-ranking if we have few high-quality results
          const MIN_VERSE_SCORE = 0.60;
          quranResults = rawVerses.filter(r => r.similarity >= MIN_VERSE_SCORE).slice(0, 3);
          console.log('Skipped LLM re-ranking, using local scores:', quranResults.length);
        }
      } else {
        console.error('Verses search error:', versesPromise.status === 'rejected' ? versesPromise.reason : 'Unknown error');
      }
      
      // Process hadith results
      console.timeEnd('db_hadith');
      if (hadithPromise.status === 'fulfilled' && hadithPromise.value.data) {
        const hadithData = hadithPromise.value.data;
        console.log('raw hadith:', hadithData.length);
        
        // Apply similarity threshold filtering for hadith
        const MIN_SIM = 0.60;
        hadithResults = hadithData.filter(r => r.score >= MIN_SIM);
        
        // Apply conditional LLM re-ranking for hadith too
        if (hadithResults.length > 3 || (hadithResults.length > 0 && Math.max(...hadithResults.map(r => r.score)) < 0.80)) {
          try {
            const rerankedHadith = await rerankVersesWithLLM(query, hadithResults.map(h => ({
              id: h.id,
              source_ref: h.source_ref,
              text_ar: h.text_ar,
              text_en: h.text_en,
              similarity: h.score
            })), lang);
            hadithResults = rerankedHadith;
          } catch (llmError) {
            console.error('Hadith LLM re-ranking failed:', llmError);
            hadithResults = hadithResults.filter(r => r.score >= 0.65).slice(0, 3);
          }
        } else {
          hadithResults = hadithResults.slice(0, 3);
        }
        
        console.log('Hadith search processed:', hadithResults.length, 'results');
      }
      
      // Get advice result
      console.timeEnd('llm_advice');
      if (advicePromise.status === 'fulfilled') {
        llmAdvice = advicePromise.value;
      } else {
        console.error('Advice generation failed:', advicePromise.reason);
        llmAdvice = generateContextualAdvice(query, [...quranResults, ...hadithResults], lang);
      }
    } else {
      // Text-only fallback path
      console.log('Using text-only search...');
      llmAdvice = generateContextualAdvice(query, [], lang);
    }
    
    console.log('After processing - Quran:', quranResults.length, 'Hadith:', hadithResults.length);
    
    // Light fallback for verses only if absolutely no results at all
    if (quranResults.length === 0 && hadithResults.length === 0) {
      console.log('No semantic matches found, trying text search fallback...');
      
      // Try local verses search without embedding (text-only fallback) using expanded query
      const { data: versesFallback, error: fallbackError } = await supabase
        .rpc('search_verses_local', {
          q: searchQuery,
          lang: lang,
          q_embedding: null,
          limit_n: 12
        });
        
      if (!fallbackError && versesFallback && versesFallback.length > 0) {
        // Convert to expected format
        const rawFallbackVerses = versesFallback.map(v => ({
          id: v.id.toString(),
          source_ref: `${v.surah_name_ar} ${v.ayah_number}`,
          text_ar: v.text_ar,
          text_en: v.text_en,
          similarity: v.score * 0.5 // Mark as fallback with lower score
        }));

        // Try LLM re-ranking even for fallback
        try {
          const rerankedFallback = await rerankVersesWithLLM(query, rawFallbackVerses, lang);
          quranResults = rerankedFallback;
          console.log('Fallback with LLM re-ranking found:', quranResults.length, 'results');
        } catch (llmError) {
          console.error('LLM re-ranking failed for fallback, using basic filtering:', llmError);
          quranResults = rawFallbackVerses.slice(0, 3);
          console.log('Fallback verses search found:', quranResults.length, 'results');
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

    // Use the advice that was already generated in parallel
    if (!llmAdvice) {
      console.log('Using fallback advice generation...');
      const allResults = [...quranResults, ...hadithResults];
      llmAdvice = generateContextualAdvice(query, allResults, lang);
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
    
    // Cache the result for future queries
    try {
      await supabase.from('cached_queries').insert({
        key: cacheKey,
        lang: lang,
        query: query,
        verses: finalResponse.ayat,
        hadith: finalResponse.ahadith,
        practical_tip: finalResponse.generic_tip,
        dua: finalResponse.dua
      });
      console.log('Result cached successfully');
    } catch (cacheError) {
      console.log('Failed to cache result:', cacheError);
    }
    
    // Add notice if no scriptures were found but still provide advice
    const responseWithNotice = {
      ...finalResponse,
      no_scripture_notice: (quranResults.length === 0 && hadithResults.length === 0)
    };
    
    console.timeEnd('total');
    return new Response(JSON.stringify(responseWithNotice), {
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

// LLM re-ranking function for verses
async function rerankVersesWithLLM(query: string, verses: any[], lang: string): Promise<any[]> {
  if (verses.length === 0) {
    return [];
  }

  // Prepare verses for LLM with text truncation (cost guard)
  const versesForLLM = verses.map(v => ({
    id: v.id,
    text_ar: v.text_ar.length > 260 ? v.text_ar.substring(0, 260) + '...' : v.text_ar,
    text_en: v.text_en && v.text_en.length > 260 ? v.text_en.substring(0, 260) + '...' : v.text_en,
    source_ref: v.source_ref
  }));

  const systemMessage = lang === 'en' 
    ? `You are a relevance scorer for Islamic verses. Given a user query and verses, score each verse from 0 to 1 based on how well it answers or relates to the specific question. Be strict - only high relevance (0.75+) verses should get high scores.

Return JSON only:
{"scores":[{"id":"verse_id","score":0.85,"reason":"short reason"}]}`
    : `أنت مقيم صلة الآيات القرآنية. بناء على سؤال المستخدم والآيات المعطاة، قيم كل آية من 0 إلى 1 حسب مدى إجابتها أو صلتها بالسؤال المحدد. كن صارماً - فقط الآيات عالية الصلة (0.75+) يجب أن تحصل على درجات عالية.

أرجع JSON فقط:
{"scores":[{"id":"verse_id","score":0.85,"reason":"سبب قصير"}]}`;

  const userMessage = lang === 'en'
    ? `Query: "${query}"

Verses to score:
${versesForLLM.map((v, i) => `${i+1}. ID: ${v.id}, Ref: ${v.source_ref}
Arabic: ${v.text_ar}
English: ${v.text_en || 'N/A'}`).join('\n\n')}

Score each verse 0-1 for relevance to the query. Be strict.`
    : `السؤال: "${query}"

الآيات للتقييم:
${versesForLLM.map((v, i) => `${i+1}. رقم: ${v.id}, المرجع: ${v.source_ref}
عربي: ${v.text_ar}
إنجليزي: ${v.text_en || 'غير متوفر'}`).join('\n\n')}

قيم كل آية من 0-1 حسب صلتها بالسؤال. كن صارماً.`;

  console.log('Starting LLM re-ranking...');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LLM re-ranking API error:', errorText);
    throw new Error(`LLM re-ranking failed: ${errorText}`);
  }

  const data = await response.json();
  const gptResponse = data.choices[0].message.content;
  console.log('LLM re-ranking raw response:', gptResponse);

  // Parse JSON response safely
  let rerankResponse: LLMRerankResponse;
  try {
    rerankResponse = JSON.parse(gptResponse);
  } catch (parseError) {
    console.error('Failed to parse LLM re-ranking response:', gptResponse);
    // Try to extract JSON with regex as fallback
    const jsonMatch = gptResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        rerankResponse = JSON.parse(jsonMatch[0]);
      } catch (regexParseError) {
        throw new Error('Failed to parse LLM response as JSON');
      }
    } else {
      throw new Error('No valid JSON found in LLM response');
    }
  }

  // Merge scores back into verses
  const scoreMap = new Map(rerankResponse.scores.map(s => [s.id, s.score]));
  const rerankedVerses = verses.map(v => ({
    ...v,
    llm_score: scoreMap.get(v.id) || 0
  }));

  // Filter and sort
  const MIN_LLM_SCORE = 0.75;
  const filteredVerses = rerankedVerses
    .filter(v => v.llm_score >= MIN_LLM_SCORE)
    .sort((a, b) => b.llm_score - a.llm_score)
    .slice(0, 3);

  console.log('LLM scores applied:', rerankResponse.scores.length, 'filtered to:', filteredVerses.length);
  
  return filteredVerses;
}

// Parallel advice generation function
async function generateAdviceParallel(query: string, lang: string, context: any[]): Promise<LLMResponse> {
  const contextText = context
    .map((v: any) => `${v.source_ref}: ${v.text_ar}`)
    .join('\n');

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
${contextText}

Provide unique and useful practical advice for the question, with an appropriate prayer.`
    : `السؤال: ${query}

النصوص المرجعية (استخدمها فقط إذا كانت مناسبة للسؤال):
${contextText}

قدم نصيحة عملية فريدة ومفيدة للسؤال، مع دعاء مناسب.`;

  console.log('Starting parallel GPT generation...');
  
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

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text();
    console.error('Parallel GPT API error:', errorText);
    throw new Error(`Parallel GPT API error: ${errorText}`);
  }

  const chatData = await chatResponse.json();
  const gptResponse = chatData.choices[0].message.content;
  
  try {
    return JSON.parse(gptResponse);
  } catch (parseError) {
    console.error('Failed to parse parallel GPT response:', gptResponse);
    throw new Error('Failed to parse parallel GPT response as JSON');
  }
}