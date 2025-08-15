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

interface StrictFilterResponse {
  keep: number[];
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
      // Check if cached result is generic fallback - if so, bypass cache
      const isGenericFallback = cachedResult.practical_tip === 'Remember that Allah is always with you in times of difficulty. Turn to Him through prayer, remembrance, and reading the Quran. Be patient and trust in His wisdom, for He knows what is best for you.';
      
      if (!isGenericFallback) {
        console.log('✅ CACHE HIT! Total time <100ms');
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
      } else {
        console.log('🔄 BYPASSING CACHE - Generic fallback detected');
      }
    }

    // Check for sensitive religious topics that require scholars
    const sensitiveTopics = /(?:طلاق|حرام|حلال|فتوى|زكاة|ميراث|أحكام|فقه)/i;
    const isSensitiveTopic = sensitiveTopics.test(query);

    // NEW: LLM extraction-first pipeline
    console.time('llm_extract');
    let hydratedQuranFromLLM: any[] = [];
    let hydratedHadithFromLLM: any[] = [];
    try {
      const effLang = (lang === 'ar' || lang === 'en') ? lang : (/\p{Script=Arabic}/u.test(query) ? 'ar' : 'en');
      const systemPrompt = `You are a careful Islamic assistant. Extract exact Qur’an and Hadith references relevant to the user’s question. If uncertain, leave fields null. Output ONLY valid JSON matching the provided schema. Do not add any text outside JSON. Do not issue legal rulings.`;
      const userPrompt = `lang: ${effLang}\nquery: "${query}"\nReturn ONLY JSON per schema. For Arabic questions: keep scripture in Arabic. For English: include Arabic scripture and English translations when known. If a hadith’s source/book/number cannot be confirmed, leave it null so it can be excluded.\n\nSchema:\n{\n  "quran": [\n    {\n      "surah_name_ar": "string|null",\n      "surah_name_en": "string|null",\n      "surah_number": "number|null",\n      "ayah_numbers": ["number", "..."],\n      "ayah_ranges": [{"from": "number", "to": "number"}],\n      "notes": "string|null"\n    }\n  ],\n  "hadith": [\n    {\n      "source": "Bukhari|Muslim|Tirmidhi|Nasa'i|Abu Dawud|Ibn Majah|Ahmad|Other",\n      "book": "string|null",\n      "number": "string|null",\n      "topic": "string|null",\n      "text_ar": "string|null",\n      "text_en": "string|null",\n      "grade": "Sahih|Hasan|Daif|null"\n    }\n  ],\n  "practical_tip": "string",\n  "dua": "string"\n}`;

      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 700,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(to);

      let extraction: any | null = null;
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        try { extraction = JSON.parse(content); } catch (_) { extraction = null; }
      } else {
        console.error('LLM extraction HTTP error:', await resp.text());
      }
      console.timeEnd('llm_extract');

      if (extraction) {
        // Hydrate Quran
        console.time('hydrate_quran');
        let droppedQuran = 0;
        try {
          const { data: surahs } = await supabase.from('surahs').select('id, name_ar, name_en');
          const mapAr = new Map<string, number>();
          const mapEn = new Map<string, number>();
          (surahs || []).forEach((s: any) => {
            if (s.name_ar) mapAr.set(String(s.name_ar).trim(), s.id);
            if (s.name_en) mapEn.set(String(s.name_en).toLowerCase().trim(), s.id);
          });
          const getSurahNo = (item: any) => {
            if (item?.surah_number) return Number(item.surah_number);
            if (item?.surah_name_ar && mapAr.has(String(item.surah_name_ar).trim())) return mapAr.get(String(item.surah_name_ar).trim()) ?? null;
            if (item?.surah_name_en && mapEn.has(String(item.surah_name_en).toLowerCase().trim())) return mapEn.get(String(item.surah_name_en).toLowerCase().trim()) ?? null;
            return null;
          };

          for (const it of (extraction.quran || [])) {
            const surah_no = getSurahNo(it);
            if (!surah_no) { droppedQuran++; continue; }
            const nums = new Set<number>();
            (it.ayah_numbers || []).forEach((n: any) => { const v = Number(n); if (!Number.isNaN(v)) nums.add(v); });
            for (const r of (it.ayah_ranges || [])) {
              const from = Number(r.from), to = Number(r.to);
              if (!Number.isNaN(from) && !Number.isNaN(to) && to >= from) {
                for (let i = from; i <= to && i - from <= 50; i++) nums.add(i);
              }
            }
            const list = Array.from(nums);
            if (list.length === 0) { droppedQuran++; continue; }
            const { data: versesData, error: versesErr } = await supabase
              .from('verses')
              .select('surah_no, ayah_no_surah, ayah_ar, ayah_en, surah_name_ar, surah_name_en')
              .eq('surah_no', surah_no)
              .in('ayah_no_surah', list);
            if (versesErr || !versesData || versesData.length === 0) { droppedQuran++; continue; }
            hydratedQuranFromLLM.push(...versesData.map((v: any) => ({
              id: `${v.surah_no}:${v.ayah_no_surah}`,
              source_ref: `${v.surah_name_ar} ${v.ayah_no_surah}`,
              text_ar: v.ayah_ar,
              text_en: effLang === 'en' ? (v.ayah_en ?? null) : undefined
            })));
          }
        } catch (e) {
          console.error('Hydrate Quran error:', e);
        }
        console.timeEnd('hydrate_quran');
        console.log('Hydrated Quran count:', hydratedQuranFromLLM.length);

        // Hydrate Hadith
        console.time('hydrate_hadith');
        let droppedHadith = 0;
        try {
          for (const h of (extraction.hadith || [])) {
            let candidates: any[] = [];
            if (h.source && (h.number || h.book)) {
              const pattern = h.number ? `${h.source} ${h.number}` : `${h.source} ${h.book || ''}`;
              const { data: rows } = await supabase
                .from('hadith')
                .select('id, source_ref, text_ar, text_en')
                .ilike('source_ref', `%${pattern}%`)
                .limit(10);
              candidates = rows || [];
            } else if (h.text_ar) {
              const { data: rows } = await supabase
                .from('hadith')
                .select('id, source_ref, text_ar, text_en')
                .ilike('text_ar', `%${String(h.text_ar).slice(0, 25)}%`)
                .limit(10);
              candidates = rows || [];
            }
            if (!candidates.length) { droppedHadith++; continue; }
            const target = (h.text_ar || '').trim();
            const tokenize = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
            let best: any = candidates[0];
            let bestScore = 0;
            if (target.length >= 20) {
              const tset = tokenize(target);
              for (const c of candidates) {
                const cset = tokenize((c.text_ar || '').trim());
                const inter = new Set([...tset].filter(x => cset.has(x)));
                const unionSize = new Set([...tset, ...cset]).size || 1;
                const score = inter.size / unionSize;
                if (score > bestScore) { bestScore = score; best = c; }
              }
            } else {
              bestScore = 1;
            }
            if (best && bestScore >= 0.8) {
              hydratedHadithFromLLM.push({
                id: best.id,
                source_ref: best.source_ref,
                text_ar: best.text_ar,
                text_en: effLang === 'en' ? (best.text_en ?? null) : undefined
              });
            } else {
              droppedHadith++;
            }
          }
        } catch (e) {
          console.error('Hydrate Hadith error:', e);
        }
        console.timeEnd('hydrate_hadith');
        console.log('Hydrated Hadith count:', hydratedHadithFromLLM.length, 'dropped:', droppedHadith);

        if (hydratedQuranFromLLM.length > 0 || hydratedHadithFromLLM.length > 0) {
          console.time('llm_advice');
          let advice: LLMResponse;
          try {
            advice = await generateAdviceParallel(query, effLang, [...hydratedQuranFromLLM, ...hydratedHadithFromLLM]);
          } catch (e) {
            console.error('Advice generation failed:', e);
            advice = generateContextualAdvice(query, [...hydratedQuranFromLLM, ...hydratedHadithFromLLM], effLang);
          }
          console.timeEnd('llm_advice');

          const respObj = {
            ayat: hydratedQuranFromLLM.slice(0, 3),
            ahadith: hydratedHadithFromLLM.slice(0, 3),
            generic_tip: advice.practical_tip,
            dua: advice.dua,
            is_sensitive: isSensitiveTopic
          };

          // Cache result
          try {
            await supabase.from('cached_queries').upsert({
              key: cacheKey,
              lang: effLang,
              query,
              verses: respObj.ayat,
              hadith: respObj.ahadith,
              practical_tip: respObj.generic_tip,
              dua: respObj.dua
            }, { onConflict: 'key' });
          } catch (e) { console.log('Cache write failed (LLM-first):', e); }

          console.timeEnd('total');
          return new Response(JSON.stringify(respObj), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    } catch (e) {
      console.timeEnd('llm_extract');
      console.error('LLM-first pipeline failed early:', e);
    }

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
            model: 'text-embedding-3-small'  
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

        // Filter by local score threshold first
        const MIN_LOCAL_SCORE = 0.68;
        const versesLocal = rawVerses.filter(v => v.similarity >= MIN_LOCAL_SCORE);
        console.log('local', versesLocal.length);
        
        // Apply strict LLM filtering every time
        console.time('llm_rerank');
        try {
          const versesFinal = await rerankVersesStrict(query, versesLocal, lang);
          quranResults = versesFinal;
          console.log('afterLLM', quranResults.length);
        } catch (llmError) {
          console.error('LLM re-ranking failed, using fallback:', llmError);
          quranResults = versesLocal.filter(r => r.similarity >= 0.75).slice(0, 3);
          console.log('afterLLM (fallback):', quranResults.length);
        }
        console.timeEnd('llm_rerank');
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
      try {
        console.time('llm_advice');
        llmAdvice = await generateAdviceParallel(query, lang, []);
        console.timeEnd('llm_advice');
      } catch (e) {
        console.error('Advice LLM failed (text-only path):', e);
        llmAdvice = generateContextualAdvice(query, [], lang);
      }
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
    
    // Add detailed logging variables for the summary
    let localCount = 0;
    let finalCount = quranResults.length;
    
    // Log final summary before caching and return
    console.log('📊 FINAL SUMMARY:', {
      query_length: query.length,
      found_ayat: finalResponse.ayat.length,
      found_hadith: finalResponse.ahadith.length,
      has_advice: !!finalResponse.generic_tip,
      has_dua: !!finalResponse.dua,
      cache_used: false,  // Only cache hits log cache_used: true above
      local_filtered_verses: `local ${localCount} -> afterLLM ${finalCount}`,
      semantic_scores: quranResults.map(r => r.similarity?.toFixed(2) || 'N/A').join(', ')
    });
    
    // Cache the result for future queries
    console.time('cache_write');
    try {
      await supabase.from('cached_queries').upsert({
        key: cacheKey,
        lang: lang,
        query: query,
        verses: finalResponse.ayat,
        hadith: finalResponse.ahadith,
        practical_tip: finalResponse.generic_tip,
        dua: finalResponse.dua
      }, { onConflict: 'key' });
      console.log('✅ Result cached successfully');
    } catch (cacheError) {
      console.log('⚠️ Failed to cache result:', cacheError);
    }
    console.timeEnd('cache_write');
    
    // Add notice if no scriptures were found but still provide advice
    const responseWithNotice = {
      ...finalResponse,
      no_scripture_notice: (quranResults.length === 0 && hadithResults.length === 0)
    };
    
    console.timeEnd('total');
    console.log('🎯 REQUEST COMPLETE');
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
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 1000,
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
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 100,
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
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 600
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