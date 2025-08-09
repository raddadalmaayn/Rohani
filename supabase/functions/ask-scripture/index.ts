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
  similarity?: number;
}

interface LLMResponse {
  practical_tip: string;
  dua: string;
}

// New interfaces for LLM extraction
interface QuranRef {
  surah_name_ar: string | null;
  surah_name_en: string | null;
  surah_number: number | null;
  ayah_numbers: number[];
  ayah_ranges?: { from: number; to: number }[];
  notes: string | null;
}

interface HadithRef {
  source: string;
  book: string | null;
  number: string | null;
  topic: string | null;
  text_ar: string | null;
  text_en: string | null;
  grade: string | null;
}

interface Extraction {
  quran: QuranRef[];
  hadith: HadithRef[];
  practical_tip: string;
  dua: string;
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
    console.time('cache_read');
    const cacheKey = await createCacheKey(query, lang);
    console.log('Cache key:', cacheKey);
    
    const { data: cachedResult } = await supabase
      .from('cached_queries')
      .select('*')
      .eq('key', cacheKey)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h cache
      .maybeSingle();
    console.timeEnd('cache_read');
    
    if (cachedResult) {
      console.log('✅ CACHE HIT! Total time <100ms');
      console.timeEnd('total');
      return new Response(JSON.stringify({
        scriptures: [...(cachedResult.verses || []), ...(cachedResult.hadith || [])],
        practical_tip: cachedResult.practical_tip,
        dua: cachedResult.dua,
        is_sensitive: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detect language if not provided (simple Arabic char check)
    const detectedLang = lang || (/[\u0600-\u06FF]/.test(query) ? 'ar' : 'en');

    // Check for sensitive religious topics that require scholars
    const sensitiveTopics = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i;
    const isSensitiveTopic = sensitiveTopics.test(query);

    // NEW PIPELINE: LLM extraction first, then verification/hydration
    console.time('llm_extract');
    let extraction: Extraction | null = null;
    let quranResults: ScriptureResult[] = [];
    let hadithResults: ScriptureResult[] = [];
    let extractionUsed = false;

    try {
      extraction = await extractReferencesWithLLM(query, detectedLang);
      extractionUsed = true;
      console.timeEnd('llm_extract');

      // Parallel hydration of Quran and Hadith references
      const [hydratedQuran, hydratedHadith] = await Promise.allSettled([
        hydrateQuranRefs(extraction.quran, detectedLang, supabase),
        hydrateHadithRefs(extraction.hadith, detectedLang, supabase)
      ]);

      if (hydratedQuran.status === 'fulfilled') {
        quranResults = hydratedQuran.value;
        console.log(`✅ Hydrated ${quranResults.length} Quran verses`);
      } else {
        console.error('Quran hydration failed:', hydratedQuran.reason);
      }

      if (hydratedHadith.status === 'fulfilled') {
        hadithResults = hydratedHadith.value;
        console.log(`✅ Hydrated ${hadithResults.length} Hadith entries`);
      } else {
        console.error('Hadith hydration failed:', hydratedHadith.reason);
      }
    } catch (llmError) {
      console.error('LLM extraction failed, falling back to local search:', llmError);
      console.timeEnd('llm_extract');
      extractionUsed = false;
    }

    // Fallback to local search only if extraction yields nothing
    if (!extractionUsed || (quranResults.length === 0 && hadithResults.length === 0)) {
      console.log('Falling back to local search...');
      console.time('fallback_search');

      // Expand query with synonyms for better matching
      const { data: expandedQuery } = await supabase
        .rpc('expand_query_with_synonyms', { 
          input_query: query, 
          input_lang: detectedLang 
        });
      
      const searchQuery = expandedQuery || query;
      console.log(`Fallback - Original: "${query}", Expanded: "${searchQuery}"`);

      // Try local verses search (limit to top 3 for fallback)
      const { data: versesFallback, error: fallbackError } = await supabase
        .rpc('search_verses_local', {
          q: searchQuery,
          lang: detectedLang,
          q_embedding: null,
          limit_n: 3
        });
        
      if (!fallbackError && versesFallback && versesFallback.length > 0) {
        quranResults = versesFallback.map((v: any) => ({
          id: v.id.toString(),
          source_ref: `${v.surah_name_ar}:${v.ayah_number}`,
          text_ar: v.text_ar,
          text_type: 'quran',
          chapter_name: v.surah_name_ar,
          verse_number: v.ayah_number,
          similarity: v.score
        }));
        console.log(`Fallback found ${quranResults.length} Quran verses`);
      }

      console.timeEnd('fallback_search');
    }

    // Get practical advice and dua (from LLM extraction or fallback)
    let practicalTip = '';
    let dua = '';

    if (extraction && extractionUsed) {
      practicalTip = extraction.practical_tip;
      dua = extraction.dua;
    } else {
      // Use existing fallback advice generation
      const fallbackAdvice = generateContextualAdvice(query, [...quranResults, ...hadithResults], detectedLang);
      practicalTip = fallbackAdvice.practical_tip;
      dua = fallbackAdvice.dua;
    }

    console.log(`📊 PIPELINE SUMMARY:`, {
      query_length: query.length,
      extraction_used: extractionUsed,
      found_quran: quranResults.length,
      found_hadith: hadithResults.length,
      has_advice: !!practicalTip,
      has_dua: !!dua
    });

    // 3. If sensitive topic, return only scriptures without LLM advice
    if (isSensitiveTopic) {
      console.log('Sensitive topic detected, returning results only');
      return new Response(JSON.stringify({
        scriptures: [...quranResults, ...hadithResults],
        practical_tip: detectedLang === 'en' 
          ? "This question requires consultation with qualified religious scholars."
          : "هذا السؤال يحتاج إلى استشارة أهل العلم المختصين.",
        dua: detectedLang === 'en'
          ? "O Allah, guide us to the truth and help us follow it"
          : "اللهم أرشدنا إلى الحق وأعنا على اتباعه",
        is_sensitive: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store query for analytics (optional)
    if (user_id) {
      try {
        await supabase.from('search_history').insert({
          user_id,
          query,
          results_count: quranResults.length + hadithResults.length
        });
      } catch (analyticsError) {
        console.log('Analytics storage failed:', analyticsError);
        // Don't fail the whole request for analytics
      }
    }

    console.log('Practical tip:', practicalTip);
    console.log('Dua:', dua);
    
    const finalResponse = {
      scriptures: [...quranResults, ...hadithResults],
      practical_tip: practicalTip || (detectedLang === 'en' ? "Remember that Allah is always with you." : "تذكر أن الله معك دائماً."),
      dua: dua || (detectedLang === 'en' ? "O Allah, guide us to the truth" : "اللهم أرشدنا إلى الحق"),
      is_sensitive: false
    };
    
    // Log final summary before caching and return
    console.log('📊 FINAL SUMMARY:', {
      query_length: query.length,
      extraction_used: extractionUsed,
      found_scriptures: finalResponse.scriptures.length,
      quran_count: quranResults.length,
      hadith_count: hadithResults.length,
      has_advice: !!finalResponse.practical_tip,
      has_dua: !!finalResponse.dua,
      cache_used: false
    });
    
    // Cache the result for future queries
    console.time('cache_write');
    try {
      await supabase.from('cached_queries').insert({
        key: cacheKey,
        lang: detectedLang,
        query: query,
        verses: quranResults,
        hadith: hadithResults,
        practical_tip: finalResponse.practical_tip,
        dua: finalResponse.dua
      });
      console.log('✅ Result cached successfully');
    } catch (cacheError) {
      console.log('⚠️ Failed to cache result:', cacheError);
    }
    console.timeEnd('cache_write');
    
    console.timeEnd('total');
    console.log('🎯 REQUEST COMPLETE');
    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-scripture function:', error?.stack || error);
    const lang = 'en'; // Default lang for error responses
    return new Response(JSON.stringify({ 
      error: error.message,
      scriptures: [],
      practical_tip: lang === 'en' ? "System error occurred. Please try again." : "حدث خطأ في النظام. حاول مرة أخرى.",
      dua: lang === 'en' ? "O Allah, make our affairs easy for us" : "اللهم يسر لنا أمورنا",
      is_sensitive: false
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

// Strict LLM filtering function - returns only highly relevant verses
async function rerankVersesStrict(query: string, verses: any[], lang: string): Promise<any[]> {
  if (verses.length === 0) {
    return [];
  }

  // Prepare verses for LLM with shorter text for strict filtering
  const versesForLLM = verses.map(v => ({
    id: parseInt(v.id),
    text: v.text_ar.length > 200 ? v.text_ar.substring(0, 200) + '...' : v.text_ar
  }));

  const systemMessage = `You receive a user question and a list of Qur'an verses.
Return ONLY the IDs of verses that DIRECTLY answer or comfort
the question. 0–3 IDs max. Return strict JSON:
{"keep":[123,456]}`;

  const userMessage = JSON.stringify({
    question: query,
    verses: versesForLLM
  });

  console.log('Starting strict LLM filtering...');
  
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
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Strict LLM filter API error:', errorText);
    throw new Error(`Strict LLM filter failed: ${errorText}`);
  }

  const data = await response.json();
  const gptResponse = data.choices[0].message.content;
  console.log('Strict LLM filter raw response:', gptResponse);

  // Parse JSON response safely
  let filterResponse: StrictFilterResponse;
  try {
    filterResponse = JSON.parse(gptResponse);
  } catch (parseError) {
    console.error('Failed to parse strict filter response:', gptResponse);
    // Fallback to local scores if parsing fails
    return verses.filter(v => v.similarity >= 0.75).slice(0, 3);
  }

  // Keep only verses whose IDs appear in the "keep" array
  const keepIds = new Set(filterResponse.keep.map(id => id.toString()));
  const filteredVerses = verses.filter(v => keepIds.has(v.id));
  
  console.log('Strict filter applied - kept:', filteredVerses.length, 'out of', verses.length);
  
  return filteredVerses.slice(0, 3);
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

// LLM extraction helper function
async function extractReferencesWithLLM(query: string, lang: string): Promise<Extraction> {
  console.time('llm_extraction_api');
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const systemMessage = `You are a careful Islamic assistant. Extract only exact references. If unsure, leave fields null. Do not issue fatwas. Output ONLY valid JSON matching the schema below (no prose).`;

    const userMessage = `lang: ${lang}
query: "${query}"

Extract exact Qur'an and Hadith references relevant to this query. 

Rules:
- If Arabic question → keep Qur'an/Hadith Arabic as-is
- If English question → return Arabic text + English translation (if known) or leave translation null
- For Hadith: Only include if you're confident about source, book, and authenticity
- Be conservative - if unsure about a reference, exclude it

Return ONLY JSON per this exact schema:
{
  "quran": [
    {
      "surah_name_ar": "string|null",
      "surah_name_en": "string|null", 
      "surah_number": "number|null",
      "ayah_numbers": ["number"],
      "ayah_ranges": [{"from": "number", "to": "number"}],
      "notes": "string|null"
    }
  ],
  "hadith": [
    {
      "source": "Bukhari|Muslim|Tirmidhi|Nasa'i|Abu Dawud|Ibn Majah|Ahmad|Other",
      "book": "string|null",
      "number": "string|null", 
      "topic": "string|null",
      "text_ar": "string|null",
      "text_en": "string|null",
      "grade": "Sahih|Hasan|Daif|null"
    }
  ],
  "practical_tip": "string",
  "dua": "string"
}`;

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
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    console.timeEnd('llm_extraction_api');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM extraction API error:', errorText);
      throw new Error(`LLM extraction failed: ${errorText}`);
    }

    const data = await response.json();
    const gptResponse = data.choices[0].message.content;
    console.log('LLM extraction raw response:', gptResponse.substring(0, 200) + '...');

    try {
      return JSON.parse(gptResponse);
    } catch (parseError) {
      console.error('Failed to parse LLM extraction response:', gptResponse);
      throw new Error('Failed to parse LLM extraction response as JSON');
    }
  } catch (error) {
    clearTimeout(timeout);
    console.timeEnd('llm_extraction_api');
    throw error;
  }
}

// Hydrate Quran references helper function
async function hydrateQuranRefs(quranRefs: QuranRef[], lang: string, supabase: any): Promise<ScriptureResult[]> {
  console.time('hydrate_quran');
  if (!quranRefs || quranRefs.length === 0) {
    console.timeEnd('hydrate_quran');
    return [];
  }

  const results: ScriptureResult[] = [];
  let droppedCount = 0;

  try {
    // Get surah name to number mapping if needed
    const { data: surahs } = await supabase
      .from('surahs')
      .select('id, name_ar, name_en');
    
    const surahMap = new Map();
    if (surahs) {
      surahs.forEach((s: any) => {
        surahMap.set(s.name_ar, s.id);
        surahMap.set(s.name_en, s.id);
      });
    }

    for (const ref of quranRefs) {
      try {
        // Determine surah number
        let surahNumber = ref.surah_number;
        if (!surahNumber && (ref.surah_name_ar || ref.surah_name_en)) {
          surahNumber = surahMap.get(ref.surah_name_ar) || surahMap.get(ref.surah_name_en);
        }

        if (!surahNumber) {
          console.log(`Dropping Quran ref: no valid surah number found`);
          droppedCount++;
          continue;
        }

        // Build ayah list from numbers and ranges
        let ayahList = [...(ref.ayah_numbers || [])];
        if (ref.ayah_ranges) {
          for (const range of ref.ayah_ranges) {
            for (let i = range.from; i <= range.to; i++) {
              ayahList.push(i);
            }
          }
        }

        if (ayahList.length === 0) {
          console.log(`Dropping Quran ref: no ayah numbers specified`);
          droppedCount++;
          continue;
        }

        // Remove duplicates
        ayahList = [...new Set(ayahList)];

        // Fetch verses from database
        const { data: verses, error } = await supabase
          .from('verses')
          .select('*')
          .eq('surah_no', surahNumber)
          .in('ayah_no_surah', ayahList);

        if (error) {
          console.error('Database error fetching Quran verses:', error);
          droppedCount += ayahList.length;
          continue;
        }

        if (verses && verses.length > 0) {
          for (const verse of verses) {
            const shouldIncludeEnglish = lang === 'en';
            results.push({
              id: verse.ayah_no_quran.toString(),
              source_ref: `${verse.surah_name_ar}:${verse.ayah_no_surah}`,
              text_ar: verse.ayah_ar,
              text_type: 'quran',
              chapter_name: verse.surah_name_ar,
              verse_number: verse.ayah_no_surah,
              ...(shouldIncludeEnglish && verse.ayah_en ? { text_en: verse.ayah_en } : {})
            });
          }
          console.log(`✅ Hydrated ${verses.length} verses from surah ${surahNumber}`);
        } else {
          console.log(`No verses found for surah ${surahNumber}, ayahs: ${ayahList.join(',')}`);
          droppedCount += ayahList.length;
        }
      } catch (refError) {
        console.error('Error processing Quran ref:', refError);
        droppedCount++;
      }
    }

    console.log(`Quran hydration complete: ${results.length} verses hydrated, ${droppedCount} dropped`);
    console.timeEnd('hydrate_quran');
    return results;
  } catch (error) {
    console.error('Quran hydration failed:', error);
    console.timeEnd('hydrate_quran');
    return [];
  }
}

// Hydrate Hadith references helper function  
async function hydrateHadithRefs(hadithRefs: HadithRef[], lang: string, supabase: any): Promise<ScriptureResult[]> {
  console.time('hydrate_hadith');
  if (!hadithRefs || hadithRefs.length === 0) {
    console.timeEnd('hydrate_hadith');
    return [];
  }

  const results: ScriptureResult[] = [];
  let droppedCount = 0;

  try {
    for (const ref of hadithRefs) {
      try {
        // Try to verify against our hadith table
        // First try exact match on source and number/book
        let { data: hadithMatch } = await supabase
          .from('hadith')
          .select('*')
          .ilike('source_ref', `%${ref.source}%`)
          .limit(5);

        // If we have book/number info, try to match on that too
        if (!hadithMatch?.length && ref.book && ref.number) {
          ({ data: hadithMatch } = await supabase
            .from('hadith')
            .select('*')
            .or(`source_ref.ilike.%${ref.book}%,source_ref.ilike.%${ref.number}%`)
            .limit(5));
        }

        // If we have Arabic text, try fuzzy text match with high similarity
        if (!hadithMatch?.length && ref.text_ar) {
          const { data: textMatches } = await supabase
            .rpc('search_hadith_local', {
              q: ref.text_ar.substring(0, 100), // First 100 chars
              lang: 'ar',
              q_embedding: null,
              limit_n: 3
            });

          if (textMatches && textMatches.length > 0) {
            // Only accept very high similarity matches (≥0.8)
            const highSimilarityMatches = textMatches.filter((m: any) => m.score >= 0.8);
            if (highSimilarityMatches.length > 0) {
              hadithMatch = highSimilarityMatches;
            }
          }
        }

        if (hadithMatch && hadithMatch.length > 0) {
          // Use the first (best) match
          const match = hadithMatch[0];
          const shouldIncludeEnglish = lang === 'en';
          
          results.push({
            id: match.id,
            source_ref: match.source_ref,
            text_ar: match.text_ar,
            text_type: 'hadith',
            chapter_name: ref.source,
            verse_number: null,
            ...(shouldIncludeEnglish && match.text_en ? { text_en: match.text_en } : {})
          });
          console.log(`✅ Verified hadith from ${ref.source}`);
        } else {
          console.log(`❌ Could not verify hadith from ${ref.source} - dropping to avoid hallucination`);
          droppedCount++;
        }
      } catch (refError) {
        console.error('Error processing Hadith ref:', refError);
        droppedCount++;
      }
    }

    console.log(`Hadith hydration complete: ${results.length} hadith verified, ${droppedCount} dropped`);
    console.timeEnd('hydrate_hadith');
    return results;
  } catch (error) {
    console.error('Hadith hydration failed:', error);
    console.timeEnd('hydrate_hadith');
    return [];
  }