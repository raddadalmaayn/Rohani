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
      
      // Use correct supabase-js v2 syntax for ilike
      const { data, error: textSearchError } = await supabase
        .from('scripture')
        .select('id, source_ref, text_ar')
        .filter('text_ar', 'ilike', `%${query}%`)
        .limit(6);
        
      console.log('Text search error:', textSearchError);
      console.log('Text search data:', JSON.stringify(data, null, 2));
        
      if (textSearchError) {
        console.error('Text search error:', textSearchError);
        scriptures = [];
      } else {
        console.log('Text search returned:', data?.length || 0, 'results');
        scriptures = data?.map(item => ({ ...item, similarity: 0.8 })) || [];
      }
      
      // If still no results, try with common Arabic words
      if (!scriptures || scriptures.length === 0) {
        console.log('No direct matches, trying common Arabic words...');
        const { data: fallbackData } = await supabase
          .from('scripture')
          .select('id, source_ref, text_ar')
          .filter('text_ar', 'ilike', '%الله%')
          .limit(6);
          
        if (fallbackData && fallbackData.length > 0) {
          console.log('Found results with fallback search:', fallbackData.length);
          scriptures = fallbackData.map(item => ({ ...item, similarity: 0.6 }));
        }
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

    const systemMessage = `أنت مساعد روحي مسلم متخصص. تعطي إجابات شاملة ومفصلة بناء على النصوص الإسلامية الصحيحة فقط.

قوانين مهمة:
- اكتب practical_tip في 150-250 كلمة، إجابة شاملة ومفصلة
- ضع practical_tip في 3-4 فقرات منفصلة لسهولة القراءة
- اذكر آيات قرآنية ذات صلة مع الشرح (إذا توفرت في السياق)
- اذكر أحاديث شريفة ذات صلة مع التوضيح (إذا توفرت في السياق)
- أعطي نصائح عملية قابلة للتطبيق
- اكتب dua في ≤60 كلمة، دعاء شامل يبدأ بـ"اللهم"
- لا تعطي أحكام شرعية (لا تقل حلال/حرام)
- لا تفتي في أمور الدين
- كن لطيف ومشجع ومفصل
- استخدم النصوص المعطاة كمرجع أساسي
- أرجع إجابة بصيغة JSON فقط:
{
  "practical_tip": "إجابة شاملة ومفصلة مع فقرات منفصلة...",
  "dua": "اللهم..."
}`;

    const userMessage = `سؤال المستخدم: ${query}

النصوص الدينية ذات الصلة:
${context}

أريد إجابة شاملة ومفصلة تتضمن:
1. شرح مفصل للموضوع
2. الاستشهاد بالآيات والأحاديث المذكورة في السياق
3. نصائح عملية قابلة للتطبيق
4. دعاء مناسب

يرجى تقسيم الإجابة إلى فقرات واضحة ومنفصلة.`;

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
          temperature: 0.7,
          max_tokens: 800
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
  const queryLower = query.toLowerCase();
  
  // Simple keyword-based fallback advice with longer, more detailed responses
  if (queryLower.includes('صلاة') || queryLower.includes('صلى')) {
    return {
      practical_tip: "الصلاة هي عماد الدين وصلة العبد بربه. ابدأ بالحفاظ على الصلوات الخمس في أوقاتها، فهي الفريضة الأولى التي سيُسأل عنها العبد يوم القيامة.\n\nاجعل لك مكاناً هادئاً ونظيفاً للصلاة في البيت، وحاول أن تصلي الفجر والمغرب والعشاء في المسجد إن أمكن. استعد للصلاة بالطهارة الكاملة واجعل قلبك حاضراً مع الله.\n\nادع الله أن يعينك على إقامة الصلاة وأن يجعلها قرة عين لك، واستعن بالأذكار والتسبيح لتهيئة قلبك للمناجاة.",
      dua: "اللهم أعني على إقامة الصلاة وأدائها في وقتها، واجعلها قرة عين لي ونوراً في قبري"
    };
  } else if (queryLower.includes('ذكر') || queryLower.includes('تسبيح')) {
    return {
      practical_tip: "الذكر غذاء الروح وطمأنينة القلب. اجعل لسانك رطباً بذكر الله في كل وقت، فهو من أيسر العبادات وأعظمها أجراً عند الله.\n\nابدأ بالأذكار المأثورة: 33 مرة سبحان الله، 33 مرة الحمد لله، 34 مرة الله أكبر بعد كل صلاة. واحرص على أذكار الصباح والمساء فهي حصنك من كل سوء.\n\nاذكر الله عند النوم والاستيقاظ، وعند دخول البيت والخروج منه، وفي جميع أحوالك. ستشعر بالسكينة تملأ قلبك والبركة في حياتك.",
      dua: "اللهم اجعل قلبي عامراً بذكرك ولساني رطباً بشكرك، وأعني على ذكرك وشكرك وحسن عبادتك"
    };
  } else if (queryLower.includes('قرآن') || queryLower.includes('تلاوة')) {
    return {
      practical_tip: "القرآن الكريم هو كلام الله وهداية للناس أجمعين. اجعل له نصيباً ثابتاً من يومك، ولو صفحة واحدة، فالقليل الدائم خير من الكثير المنقطع.\n\nاقرأ بتدبر وتأمل، وحاول أن تفهم معاني الآيات وتطبقها في حياتك. استعن بكتب التفسير المبسطة لفهم ما تقرأ، واحرص على الطهارة عند التلاوة.\n\nاجعل للقرآن وقتاً خاصاً في يومك، ويُستحب التلاوة في الثلث الأخير من الليل أو بعد صلاة الفجر. ادع الله أن يجعل القرآن شفيعاً لك يوم القيامة.",
      dua: "اللهم اجعل القرآن ربيع قلبي ونور صدري وجلاء حزني وذهاب همي وغمي"
    };
  } else if (queryLower.includes('سكينة') || queryLower.includes('طمأنينة')) {
    return {
      practical_tip: "السكينة والطمأنينة من أعظم النعم التي يمنحها الله لعبده المؤمن. أكثر من الاستغفار فهو مفتاح السكينة، واذكر الله كثيراً فبذكره تطمئن القلوب.\n\nتوكل على الله في جميع أمورك واعلم أن ما أصابك لم يكن ليخطئك وما أخطأك لم يكن ليصيبك. ارض بقضاء الله وقدره واعلم أن الله لا يريد بك إلا الخير.\n\nاجعل الصلاة والدعاء ملجأك عند الهم والحزن، وأكثر من قراءة القرآن والتسبيح. تذكر أن الدنيا دار ابتلاء وأن الآخرة هي دار القرار.",
      dua: "اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام، أدخلني في السلام وأعذني من كل هم وغم"
    };
  } else {
    return {
      practical_tip: "كل رحلة روحية تبدأ بخطوة صغيرة، والله يحب من العبد القليل الدائم أكثر من الكثير المنقطع. ابدأ بما تستطيع واستعن بالله في كل أمورك.\n\nالزم الاستغفار فهو مفتاح كل خير، واحرص على الصلاة في وقتها فهي عماد الدين. اقرأ شيئاً من القرآن يومياً ولو آية واحدة، واذكر الله في جميع أحوالك.\n\nكن صبوراً مع نفسك واعلم أن التغيير يحتاج إلى وقت. ادع الله أن يهديك ويعينك على طاعته، وتذكر أن رحمة الله واسعة وأنه يقبل التوبة من عباده.",
      dua: "اللهم أرشدنا إلى ما فيه خير ديننا ودنيانا وآخرتنا، واجعلنا من عبادك الصالحين المتقين"
    };
  }
}