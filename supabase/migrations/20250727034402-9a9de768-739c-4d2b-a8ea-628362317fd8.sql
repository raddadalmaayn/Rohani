-- Create keywords mapping table for query expansion
CREATE TABLE IF NOT EXISTS public.keywords_map (
  keyword text PRIMARY KEY,
  synonyms text[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on keywords_map
ALTER TABLE public.keywords_map ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to keywords
CREATE POLICY "Keywords are publicly readable" 
ON public.keywords_map 
FOR SELECT 
USING (true);

-- Create user feedback table for verse relevance
CREATE TABLE IF NOT EXISTS public.verse_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  verse_id text NOT NULL, -- stores the verse reference like "الرعد 28"
  query text NOT NULL,
  is_helpful boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on verse_feedback
ALTER TABLE public.verse_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for user feedback
CREATE POLICY "Users can create their own feedback" 
ON public.verse_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback" 
ON public.verse_feedback 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" 
ON public.verse_feedback 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Insert initial Arabic keyword mappings for common spiritual topics
INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('قلق', ARRAY['خوف', 'هم', 'غم', 'حزن', 'طمأنينة', 'سكينة', 'راحة', 'اطمئنان']),
('خوف', ARRAY['قلق', 'فزع', 'رهبة', 'وجل', 'أمان', 'أمن', 'طمأنينة']),
('حزن', ARRAY['غم', 'هم', 'كرب', 'ضيق', 'فرج', 'سرور', 'فرح']),
('صبر', ARRAY['تحمل', 'احتساب', 'ثبات', 'جلد', 'مصابرة']),
('دعاء', ARRAY['ذكر', 'تسبيح', 'استغفار', 'تهليل', 'تكبير']),
('توبة', ARRAY['استغفار', 'إنابة', 'أوبة', 'رجوع', 'ندم']),
('رزق', ARRAY['كسب', 'معيشة', 'عيش', 'نعمة', 'فضل', 'خير']),
('شكر', ARRAY['حمد', 'ثناء', 'امتنان', 'اعتراف', 'تقدير']),
('محبة', ARRAY['حب', 'ود', 'مودة', 'عشق', 'هيام', 'غرام']),
('سلام', ARRAY['أمان', 'طمأنينة', 'سكينة', 'هدوء', 'راحة'])
ON CONFLICT (keyword) DO NOTHING;

-- Insert English keyword mappings
INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('anxiety', ARRAY['worry', 'fear', 'stress', 'concern', 'peace', 'calm', 'tranquility', 'serenity']),
('fear', ARRAY['anxiety', 'worry', 'dread', 'terror', 'safety', 'security', 'protection']),
('sadness', ARRAY['grief', 'sorrow', 'depression', 'melancholy', 'joy', 'happiness', 'comfort']),
('patience', ARRAY['endurance', 'perseverance', 'tolerance', 'forbearance', 'steadfastness']),
('prayer', ARRAY['worship', 'supplication', 'devotion', 'remembrance', 'meditation']),
('forgiveness', ARRAY['mercy', 'pardon', 'absolution', 'redemption', 'repentance']),
('love', ARRAY['affection', 'compassion', 'kindness', 'devotion', 'care']),
('peace', ARRAY['tranquility', 'serenity', 'calm', 'harmony', 'stillness', 'quiet'])
ON CONFLICT (keyword) DO NOTHING;

-- Create function to expand query with synonyms
CREATE OR REPLACE FUNCTION public.expand_query_with_synonyms(input_query text, input_lang text DEFAULT 'ar')
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  expanded_terms text[];
  final_query text;
  query_words text[];
  word text;
  synonyms_found text[];
BEGIN
  -- Clean and split the input query
  IF input_lang = 'ar' THEN
    final_query := normalize_arabic(input_query);
  ELSE
    final_query := lower(regexp_replace(input_query, '[^a-zA-Z0-9 ]', ' ', 'g'));
  END IF;
  
  query_words := string_to_array(final_query, ' ');
  expanded_terms := query_words; -- Start with original words
  
  -- Look up synonyms for each word
  FOREACH word IN ARRAY query_words
  LOOP
    IF length(trim(word)) > 2 THEN -- Only process meaningful words
      SELECT synonyms INTO synonyms_found
      FROM public.keywords_map 
      WHERE keyword = trim(word);
      
      -- Add synonyms to expanded terms
      IF synonyms_found IS NOT NULL THEN
        expanded_terms := expanded_terms || synonyms_found;
      END IF;
    END IF;
  END LOOP;
  
  -- Remove duplicates and join
  SELECT string_agg(DISTINCT term, ' ')
  INTO final_query
  FROM unnest(expanded_terms) AS term
  WHERE length(trim(term)) > 1;
  
  RETURN COALESCE(final_query, input_query);
END;
$$;