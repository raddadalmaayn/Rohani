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
- اكتب practical_tip في 400-600 كلمة، إجابة شاملة ومفصلة وفريدة
- ضع practical_tip في 5-7 فقرات منفصلة لسهولة القراءة
- اذكر آيات قرآنية ذات صلة مع الشرح المفصل (إذا توفرت في السياق)
- اذكر أحاديث شريفة ذات صلة مع التوضيح والتطبيق العملي (إذا توفرت في السياق)
- أعطي نصائح عملية قابلة للتطبيق ومتنوعة مع أمثلة محددة
- اشرح الحكمة والمعنى العميق وراء النصوص
- أضف قصص وأمثلة من السيرة النبوية إذا كانت مناسبة
- اكتب dua في ≤80 كلمة، دعاء شامل يبدأ بـ"اللهم"
- لا تعطي أحكام شرعية (لا تقل حلال/حرام)
- لا تفتي في أمور الدين
- كن لطيف ومشجع ومفصل
- استخدم النصوص المعطاة كمرجع أساسي
- تجنب التكرار واجعل كل إجابة فريدة ومتنوعة
- ركز على الجوانب العملية والتطبيقية للحياة اليومية
- اربط النصوص بالواقع المعاصر والتحديات اليومية
- أرجع إجابة بصيغة JSON فقط:
{
  "practical_tip": "إجابة شاملة ومفصلة مع فقرات منفصلة...",
  "dua": "اللهم..."
}`;

    const userMessage = `سؤال المستخدم: ${query}

النصوص الدينية ذات الصلة:
${context}

أريد إجابة شاملة ومفصلة وفريدة تتضمن:
1. شرح مفصل للموضوع مع تنويع في الأسلوب
2. الاستشهاد بالآيات والأحاديث المذكورة في السياق
3. نصائح عملية قابلة للتطبيق ومتنوعة
4. دعاء مناسب وفريد

يرجى تقسيم الإجابة إلى فقرات واضحة ومنفصلة، وتجنب التكرار في المحتوى.`;

    // 4. Generate practical advice using GPT (with fallback)
    console.log('Starting GPT generation...');
    console.log('Context for GPT:', context.substring(0, 200) + '...');
    console.log('OpenAI API Key available:', !!openAIApiKey);
    
    let llmAdvice: LLMResponse;
    
    try {
      if (!openAIApiKey) {
        console.error('OpenAI API key is missing');
        throw new Error('API key missing');
      }

      console.log('Calling OpenAI Chat API...');
      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1500
        }),
      });

      console.log('OpenAI API response status:', chatResponse.status);
      console.log('OpenAI API response headers:', Object.fromEntries(chatResponse.headers.entries()));
      
      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error('OpenAI Chat API error response:', errorText);
        console.error('OpenAI Chat API error status:', chatResponse.status);
        
        if (errorText.includes('insufficient_quota') || errorText.includes('quota')) {
          console.log('Quota exceeded, using fallback advice...');
          throw new Error('quota_exceeded');
        } else if (errorText.includes('model_not_found') || errorText.includes('invalid_request_error')) {
          console.log('Model or request error, using fallback advice...');
          throw new Error('model_error');
        } else {
          throw new Error(`OpenAI Chat API error: ${errorText}`);
        }
      }

      const chatData = await chatResponse.json();
      console.log('OpenAI response received successfully');
      console.log('Response choices length:', chatData.choices?.length || 0);
      console.log('Usage tokens:', chatData.usage);
      
      if (!chatData.choices || chatData.choices.length === 0) {
        console.error('No choices in OpenAI response:', chatData);
        throw new Error('No response choices');
      }

      const gptResponse = chatData.choices[0].message.content;
      console.log('GPT raw response length:', gptResponse?.length || 0);
      console.log('GPT raw response preview:', gptResponse?.substring(0, 200) + '...');

      if (!gptResponse) {
        console.error('Empty GPT response');
        throw new Error('Empty response');
      }

      // Parse JSON response from GPT
      try {
        llmAdvice = JSON.parse(gptResponse);
        console.log('Successfully parsed GPT response');
        console.log('Parsed practical_tip length:', llmAdvice.practical_tip?.length || 0);
        console.log('Parsed dua length:', llmAdvice.dua?.length || 0);
      } catch (parseError) {
        console.error('Failed to parse GPT response as JSON:', gptResponse);
        console.error('Parse error details:', parseError);
        throw new Error('parse_error');
      }
    } catch (gptError) {
      console.error('GPT generation failed with error:', gptError);
      console.error('Error type:', gptError.constructor.name);
      console.error('Error message:', gptError.message);
      console.log('Using fallback advice for query:', query);
      
      // Fallback advice based on query content
      llmAdvice = generateFallbackAdvice(query);
      console.log('Fallback advice generated successfully');
      console.log('Fallback practical_tip length:', llmAdvice.practical_tip?.length || 0);
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
  
  // Add randomization based on query hash to avoid repetitive responses
  const queryHash = query.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const randomIndex = Math.abs(queryHash) % 3; // Use modulo to get 0, 1, or 2
  
  // Simple keyword-based fallback advice with variety
  if (queryLower.includes('صلاة') || queryLower.includes('صلى')) {
    const responses = [
      {
        practical_tip: "الصلاة هي صلة العبد بربه ومناجاة مباشرة مع الخالق. ابدأ بتهيئة النفس والمكان، فالطهارة الحسية والمعنوية أساس الخشوع في الصلاة.\n\nاحرص على الدعاء بين السجود وقراءة القرآن بتدبر، واجعل قلبك حاضراً مع معاني ما تقرأ. الصلاة ليست مجرد حركات بل هي رحلة روحية تجدد إيمانك.\n\nاجعل الصلاة موعداً ثابتاً في يومك، وحاول أن تصل المسجد مبكراً لتهيئة قلبك. ستجد السكينة تنزل عليك بإذن الله.",
        dua: "اللهم اجعل الصلاة قرة عيني ونور طريقي وراحة قلبي، وأعني على الخشوع والتدبر فيها"
      },
      {
        practical_tip: "الصلاة عماد الدين وأول ما يُحاسب عليه العبد يوم القيامة. اجعل لها مكاناً مقدساً في قلبك قبل بيتك، واستعد لها بالوضوء الكامل والتسبيح.\n\nاقرأ الفاتحة بتأمل وتدبر، وتذكر أنك تقف بين يدي الله العظيم. استعن بالسواك والعطر وأفضل الثياب لتشعر بعظمة هذا الموقف.\n\nادع الله في سجودك بما يهمك ويشغل بالك، فهذا أقرب ما تكون إليه. اجعل الصلاة تجديداً لعهدك مع الله في كل وقت.",
        dua: "اللهم أقم صلاتي واجعلها مقبولة عندك، وارزقني الخشوع والتواضع بين يديك"
      },
      {
        practical_tip: "الصلاة ليست مجرد عبادة بل هي تزكية للنفس وتطهير للقلب من أدران الدنيا. تعلم أحكامها وآدابها، واجعل كل صلاة أفضل من التي قبلها.\n\nاستعن بالأذكار قبل الصلاة وبعدها، واحرص على النوافل فهي تجبر النقص في الفرائض. تذكر أن الله ينظر إلى قلبك وخشوعك أكثر من حركاتك.\n\nاجعل المسجد بيتك الثاني، وكن من أهل الصف الأول إن استطعت. الصلاة في جماعة تضاعف الأجر وتقوي الروابط بين المؤمنين.",
        dua: "اللهم بارك لي في صلاتي واجعلها نوراً في قلبي وطريق هدايتي إلى رضوانك"
      }
    ];
    return responses[randomIndex];
  } else if (queryLower.includes('ذكر') || queryLower.includes('تسبيح')) {
    const responses = [
      {
        practical_tip: "الذكر هو حياة القلب وغذاء الروح، وهو من أيسر العبادات وأعظمها نفعاً. ابدأ يومك بأذكار الصباح واختتمه بأذكار المساء، فهي حصنك المنيع.\n\nاجعل لسانك رطباً بذكر الله في كل حال، سواء كنت تمشي أو تعمل أو تستريح. التسبيح والتحميد والتكبير يطهران القلب ويجلبان السكينة.\n\nاحرص على الأذكار المأثورة بعد كل صلاة، واستعن بالمسبحة أو العد على الأصابع لتحافظ على العدد المطلوب. ستجد أثر الذكر في طمأنينة قلبك وبركة وقتك.",
        dua: "اللهم اجعل قلبي عامراً بذكرك ولساني لا يفتر من تسبيحك وشكرك"
      },
      {
        practical_tip: "ذكر الله تعالى يجلب الطمأنينة ويطرد الهموم والأحزان. اختر من الأذكار ما يناسب حالك، فلكل وقت ذكر مناسب وأجر عظيم.\n\nسبح الله وأنت تنظر إلى جمال الطبيعة، واحمده على نعمه التي لا تُحصى، وكبره عند رؤية عظمته في خلقه. الذكر يربطك بالله في كل لحظة.\n\nاجعل الاستغفار رفيقك الدائم، فهو مفتاح الرزق والسعادة وزوال الهموم. قل 'لا إله إلا الله' و 'سبحان الله وبحمده' فهما من أحب الكلام إلى الله.",
        dua: "اللهم أعني على ذكرك وشكرك وحسن عبادتك، واجعل الذكر نوراً في قلبي"
      },
      {
        practical_tip: "الذكر عبادة القلب واللسان معاً، وهو طريق الوصول إلى محبة الله ورضوانه. اجعل له أوقاتاً محددة في يومك، وأكثر منه عند النزول والصعود والسفر.\n\nتعلم معاني الأذكار لتشعر بحلاوتها وأثرها في نفسك. الذكر بتدبر وحضور قلب أفضل من الذكر الكثير بغفلة. استعن بالكتب والتطبيقات لتتعلم الأذكار الصحيحة.\n\nاذكر الله في السراء والضراء، وعلم أطفالك الذكر منذ الصغر. الذكر الجماعي في الأسرة يجلب البركة والألفة بين القلوب.",
        dua: "اللهم ارزقني لساناً ذاكراً وقلباً شاكراً وإيماناً لا يرتد ولا يضل"
      }
    ];
    return responses[randomIndex];
  } else {
    const responses = [
      {
        practical_tip: "الإيمان يزيد بالطاعة وينقص بالمعصية، وهو رحلة مستمرة نحو الله تحتاج إلى صبر ومثابرة. ابدأ بالفرائض واحرص عليها، ثم أضف النوافل تدريجياً.\n\nاطلب العلم الشرعي من مصادره الموثوقة، واقرأ سيرة النبي صلى الله عليه وسلم لتتعلم كيف تطبق الإسلام في حياتك اليومية. الصحبة الصالحة تعينك على الطريق.\n\nتذكر أن الدنيا دار اختبار والآخرة دار جزاء، واجعل عملك كله لوجه الله. اصبر على البلاء واشكر في الرخاء، وتوكل على الله في جميع أمورك.",
        dua: "اللهم اهدني فيمن هديت وعافني فيمن عافيت وتولني فيمن توليت"
      },
      {
        practical_tip: "التقرب إلى الله يحتاج إلى نية صادقة وعمل مستمر، ولا يشترط الكمال من البداية بل التدرج والثبات. اجعل كل يوم خطوة نحو الأفضل، واستغفر الله عن تقصيرك.\n\nالدعاء سلاح المؤمن وعبادة عظيمة تقربك من الله وتجلب لك الخير. ادع في أوقات الإجابة واحرص على آداب الدعاء. تذكر أن الله يحب من عبده أن يلح في الدعاء.\n\nاقرأ القرآن بتدبر وحاول تطبيق تعاليمه في حياتك. استعن بالتفسير لفهم المعاني، واجعل حفظ القرآن هدفاً تدريجياً في حياتك.",
        dua: "اللهم أصلح لي ديني الذي هو عصمة أمري، وأصلح لي دنياي التي فيها معاشي"
      },
      {
        practical_tip: "العبادة لها معنى واسع يشمل كل ما يرضي الله من قول وعمل ونية. اجعل حياتك كلها عبادة بأن تنوي الخير في كل عمل تقوم به، حتى عملك ونومك وأكلك.\n\nتعلم من أخطائك وتب إلى الله بصدق، فباب التوبة مفتوح ما لم تطلع الشمس من مغربها. الله يفرح بتوبة عبده أكثر مما تتخيل.\n\nكن قدوة حسنة في أخلاقك وتعاملك مع الناس، فالدين المعاملة. اصبر على أذى الناس وأحسن إليهم، واجعل بسمتك صدقة ترجو بها وجه الله.",
        dua: "اللهم إني أسألك من خير ما سألك منه نبيك محمد صلى الله عليه وسلم"
      }
    ];
    return responses[randomIndex];
  }
}