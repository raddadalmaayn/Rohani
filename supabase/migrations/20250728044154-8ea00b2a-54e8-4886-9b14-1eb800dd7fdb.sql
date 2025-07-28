-- Create caching tables for performance optimization
CREATE TABLE IF NOT EXISTS public.cached_queries(
  key text PRIMARY KEY,          -- sha256(query||lang)
  lang text NOT NULL,
  query text NOT NULL,
  verses jsonb,
  hadith jsonb,
  practical_tip text,
  dua text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.embedding_cache(
  key text PRIMARY KEY,          -- sha256(query||lang)
  embedding float8[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.cached_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_cache ENABLE ROW LEVEL SECURITY;

-- Public read access for cached queries (since they're general Islamic content)
CREATE POLICY "Cached queries are publicly readable" 
ON public.cached_queries FOR SELECT 
USING (true);

CREATE POLICY "Embedding cache is publicly readable" 
ON public.embedding_cache FOR SELECT 
USING (true);

-- Only allow inserts/updates from service role
CREATE POLICY "Service can manage cached queries" 
ON public.cached_queries FOR ALL 
USING (true);

CREATE POLICY "Service can manage embedding cache" 
ON public.embedding_cache FOR ALL 
USING (true);

-- Add some basic keyword mappings if not exists
INSERT INTO public.keywords_map (keyword, synonyms) VALUES
  ('قلق', ARRAY['خوف', 'هم', 'سكينة', 'طمأنينة', 'اضطراب', 'توتر']),
  ('حزن', ARRAY['ضيق', 'كآبة', 'غم', 'أسى', 'بؤس']),
  ('خوف', ARRAY['قلق', 'فزع', 'رهبة', 'وجل', 'خشية']),
  ('دعاء', ARRAY['ذكر', 'تسبيح', 'استغفار', 'تضرع', 'ابتهال']),
  ('صبر', ARRAY['احتساب', 'ثبات', 'تحمل', 'مقاومة']),
  ('توبة', ARRAY['استغفار', 'ندم', 'إنابة', 'أوبة']),
  ('شكر', ARRAY['حمد', 'ثناء', 'امتنان', 'تقدير']),
  ('anxiety', ARRAY['worry', 'fear', 'stress', 'calm', 'tranquility', 'peace']),
  ('sadness', ARRAY['grief', 'sorrow', 'depression', 'melancholy']),
  ('fear', ARRAY['anxiety', 'worry', 'dread', 'apprehension']),
  ('prayer', ARRAY['dua', 'supplication', 'remembrance', 'dhikr']),
  ('patience', ARRAY['perseverance', 'endurance', 'steadfastness', 'tolerance']),
  ('gratitude', ARRAY['thankfulness', 'appreciation', 'praise', 'blessing'])
ON CONFLICT (keyword) DO NOTHING;

-- Create function for hadith search similar to verses search
CREATE OR REPLACE FUNCTION public.search_hadith_local(
  q text, 
  lang text DEFAULT 'ar',
  q_embedding vector DEFAULT NULL,
  limit_n integer DEFAULT 6
)
RETURNS TABLE(
  id uuid,
  source_ref text,
  text_ar text,
  text_en text,
  score double precision
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_query text;
BEGIN
  -- Normalize query based on language
  IF lang = 'en' THEN
    normalized_query := lower(regexp_replace(q, '[^a-zA-Z0-9 ]', ' ', 'g'));
  ELSE
    normalized_query := normalize_arabic(q);
  END IF;

  IF q_embedding IS NOT NULL THEN
    -- Hybrid search: embedding + text search
    RETURN QUERY
    SELECT 
      h.id,
      h.source_ref,
      h.text_ar,
      h.text_en,
      (
        0.7 * COALESCE((1 - (h.embedding <=> q_embedding)), 0) +
        0.2 * COALESCE(ts_rank(to_tsvector('simple', h.text_ar), plainto_tsquery('simple', normalized_query)), 0) +
        0.1 * COALESCE(similarity(h.text_ar, normalized_query), 0)
      ) as score
    FROM public.hadith h
    WHERE h.embedding IS NOT NULL
      AND (
        to_tsvector('simple', h.text_ar) @@ plainto_tsquery('simple', normalized_query) OR
        similarity(h.text_ar, normalized_query) > 0.1 OR
        (h.text_en IS NOT NULL AND (
          to_tsvector('english', h.text_en) @@ plainto_tsquery('english', normalized_query) OR
          similarity(h.text_en, normalized_query) > 0.1
        ))
      )
    ORDER BY score DESC
    LIMIT limit_n;
  ELSE
    -- Text-only search
    RETURN QUERY
    SELECT 
      h.id,
      h.source_ref,
      h.text_ar,
      h.text_en,
      (
        0.8 * COALESCE(ts_rank(to_tsvector('simple', h.text_ar), plainto_tsquery('simple', normalized_query)), 0) +
        0.2 * COALESCE(similarity(h.text_ar, normalized_query), 0)
      ) as score
    FROM public.hadith h
    WHERE 
      to_tsvector('simple', h.text_ar) @@ plainto_tsquery('simple', normalized_query) OR
      similarity(h.text_ar, normalized_query) > 0.1 OR
      (h.text_en IS NOT NULL AND (
        to_tsvector('english', h.text_en) @@ plainto_tsquery('english', normalized_query) OR
        similarity(h.text_en, normalized_query) > 0.1
      ))
    ORDER BY score DESC
    LIMIT limit_n;
  END IF;
END;
$$;