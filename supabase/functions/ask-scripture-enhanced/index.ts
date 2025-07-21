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

// Logging utility
function log(...args: any[]) {
  if (Deno.env.get('ENV') === 'dev') console.log(...args);
}

// Sensitive topics detection
const sensitiveTopics = [
  'طلاق', 'divorce', 'حرام', 'haram', 'حلال', 'halal',
  'زواج', 'marriage', 'جنس', 'sex', 'موت', 'death'
];

function detectSensitiveTopic(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return sensitiveTopics.some(topic => lowerQuery.includes(topic.toLowerCase()));
}

serve(async (req) => {
  log('Enhanced Ask Scripture function called');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, lang = 'ar', user_id } = await req.json();
    
    if (!query?.trim()) {
      throw new Error('Query is required');
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const isSensitive = detectSensitiveTopic(query);
    
    log('Processing query:', query, 'Language:', lang, 'Sensitive:', isSensitive);

    // Get embedding for the query
    log('Getting embedding for query...');
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

    let ayat: any[] = [];
    let ahadith: any[] = [];

    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Search Quran verses
      const { data: quranResults, error: quranError } = await supabase
        .rpc('match_quran', {
          embedding_input: embedding,
          match_count: 3
        });

      if (!quranError && quranResults) {
        ayat = quranResults;
        log('Found Quran verses:', ayat.length);
      }

      // Search Hadith
      const { data: hadithResults, error: hadithError } = await supabase
        .rpc('match_hadith', {
          embedding_input: embedding,
          match_count: 3
        });

      if (!hadithError && hadithResults) {
        ahadith = hadithResults;
        log('Found Hadith:', ahadith.length);
      }
    } else {
      console.error('OpenAI Embedding API error:', await embeddingResponse.text());
    }

    // Fallback to text search if no vector results
    if (ayat.length === 0 && ahadith.length === 0) {
      log('No vector results, trying text search fallback...');
      
      const { data: fallbackQuran } = await supabase
        .from('quran')
        .select('id, source_ref, text_ar, text_en')
        .ilike('text_ar', `%${query}%`)
        .limit(2);
      
      const { data: fallbackHadith } = await supabase
        .from('hadith')
        .select('id, source_ref, text_ar, text_en')
        .ilike('text_ar', `%${query}%`)
        .limit(2);

      ayat = fallbackQuran || [];
      ahadith = fallbackHadith || [];
      log('Fallback search found:', ayat.length, 'Quran,', ahadith.length, 'Hadith');
    }

    // Generate practical advice and dua using GPT
    let practical_tip = '';
    let dua = '';

    if (!isSensitive && (ayat.length > 0 || ahadith.length > 0)) {
      const context = [
        ...ayat.map(v => `${v.source_ref}: ${v.text_ar}`),
        ...ahadith.map(h => `${h.source_ref}: ${h.text_ar}`)
      ].join('\n');

      const gptPrompt = lang === 'en' 
        ? `Based on these Islamic texts:\n${context}\n\nProvide practical spiritual advice for: "${query}"\n\nAlso suggest an appropriate dua (supplication).\n\nRespond in JSON format: {"practical_tip": "...", "dua": "..."}`
        : `بناءً على هذه النصوص الإسلامية:\n${context}\n\nقدم نصيحة روحية عملية لـ: "${query}"\n\nواقترح دعاءً مناسباً.\n\nالرد بصيغة JSON: {"practical_tip": "...", "dua": "..."}`;

      try {
        log('Calling OpenAI Chat API...');
        const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { 
                role: 'system', 
                content: lang === 'en' 
                  ? 'You are a knowledgeable Islamic advisor. Provide practical spiritual guidance based on Quran and Hadith.'
                  : 'أنت مستشار إسلامي مطلع. قدم إرشاداً روحياً عملياً مبنياً على القرآن والحديث.'
              },
              { role: 'user', content: gptPrompt }
            ],
            temperature: 0.7,
            max_tokens: 500
          }),
        });

        if (gptResponse.ok) {
          const gptData = await gptResponse.json();
          const gptRaw = gptData.choices[0].message.content;
          log('GPT raw response:', gptRaw);

          // Safe JSON extraction
          const match = gptRaw.match(/\{[\s\S]*\}/);
          const safeJson = match ? match[0] : '{"practical_tip":"","dua":""}';
          
          try {
            const parsed = JSON.parse(safeJson);
            practical_tip = parsed.practical_tip || '';
            dua = parsed.dua || '';
            log('Successfully parsed GPT response');
          } catch (parseError) {
            console.error('Failed to parse GPT response:', parseError);
            practical_tip = lang === 'en' ? 'Seek guidance through prayer and reflection.' : 'اطلب الهداية بالدعاء والتأمل.';
            dua = lang === 'en' ? 'O Allah, guide me to what is best.' : 'اللهم اهدني لما فيه خير.';
          }
        }
      } catch (gptError) {
        console.error('GPT API error:', gptError);
        practical_tip = lang === 'en' ? 'Seek guidance through prayer and reflection.' : 'اطلب الهداية بالدعاء والتأمل.';
        dua = lang === 'en' ? 'O Allah, guide me to what is best.' : 'اللهم اهدني لما فيه خير.';
      }
    }

    // Handle English translation fallback
    if (lang === 'en') {
      for (const verse of ayat) {
        if (!verse.text_en && verse.text_ar) {
          try {
            const translateResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { 
                    role: 'user', 
                    content: `Translate the following Quran verse to plain English: "${verse.text_ar}"`
                  }
                ],
                max_tokens: 200
              }),
            });

            if (translateResponse.ok) {
              const translateData = await translateResponse.json();
              const translation = translateData.choices[0].message.content;
              
              // Cache translation
              await supabase
                .from('quran')
                .update({ text_en: translation })
                .eq('id', verse.id);
              
              verse.text_en = translation;
            }
          } catch (translateError) {
            log('Translation error:', translateError);
          }
        }
      }

      for (const hadith of ahadith) {
        if (!hadith.text_en && hadith.text_ar) {
          try {
            const translateResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { 
                    role: 'user', 
                    content: `Translate the following Hadith to plain English: "${hadith.text_ar}"`
                  }
                ],
                max_tokens: 200
              }),
            });

            if (translateResponse.ok) {
              const translateData = await translateResponse.json();
              const translation = translateData.choices[0].message.content;
              
              // Cache translation
              await supabase
                .from('hadith')
                .update({ text_en: translation })
                .eq('id', hadith.id);
              
              hadith.text_en = translation;
            }
          } catch (translateError) {
            log('Translation error:', translateError);
          }
        }
      }
    }

    const response = {
      ayat: ayat.map(v => ({
        id: v.id,
        source_ref: v.source_ref,
        text_ar: v.text_ar,
        text_en: v.text_en
      })),
      ahadith: ahadith.map(h => ({
        id: h.id,
        source_ref: h.source_ref,
        text_ar: h.text_ar,
        text_en: h.text_en
      })),
      practical_tip,
      dua,
      is_sensitive: isSensitive
    };

    log('Final response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask-scripture-enhanced function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      ayat: [],
      ahadith: [],
      practical_tip: '',
      dua: '',
      is_sensitive: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});