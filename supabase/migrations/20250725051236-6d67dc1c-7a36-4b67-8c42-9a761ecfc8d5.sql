-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add columns to verses table for search functionality
ALTER TABLE public.verses 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS normalized_text text;

-- Function to normalize Arabic text (remove diacritics, unify characters)
CREATE OR REPLACE FUNCTION normalize_arabic(input_text text) 
RETURNS text AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(input_text, 
                      '[َُِّْٰٱٌٍَُِّْٰ]', '', 'g'),
                    'ـ', '', 'g'),
                  '[آأإ]', 'ا', 'g'),
                '[ىئ]', 'ي', 'g'),
              'ة', 'ه', 'g'),
            '\s+', ' ', 'g'),
          '^\s+|\s+$', '', 'g'),
        '[^\u0600-\u06FF\u0750-\u077F\s]', '', 'g'),
      '\u202E|\u202D|\u202C', '', 'g'),
    '\uFEFF', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create RPC function for local verse search
CREATE OR REPLACE FUNCTION search_verses_local(
  q text,
  q_embedding vector DEFAULT NULL,
  limit_n integer DEFAULT 6
)
RETURNS TABLE(
  id bigint,
  surah_id bigint,
  ayah_number bigint,
  text_ar text,
  text_en text,
  surah_name_ar text,
  surah_name_en text,
  score double precision
) AS $$
DECLARE
  normalized_query text;
BEGIN
  normalized_query := normalize_arabic(q);
  
  IF q_embedding IS NOT NULL THEN
    -- Hybrid search: embedding + text search + trigram
    RETURN QUERY
    SELECT 
      v.ayah_no_quran::bigint as id,
      v.surah_no::bigint as surah_id,
      v.ayah_no_surah::bigint as ayah_number,
      v.ayah_ar as text_ar,
      v.ayah_en as text_en,
      v.surah_name_ar,
      v.surah_name_en,
      (
        0.6 * (1 - (v.embedding <=> q_embedding)) +
        0.3 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
        0.1 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
      ) as score
    FROM public.verses v
    WHERE v.embedding IS NOT NULL 
      AND v.normalized_text IS NOT NULL
      AND (
        v.embedding <=> q_embedding < 1.0 OR
        to_tsvector('simple', v.normalized_text) @@ plainto_tsquery('simple', normalized_query) OR
        similarity(v.normalized_text, normalized_query) > 0.1
      )
    ORDER BY score DESC
    LIMIT limit_n;
  ELSE
    -- Text-only search: ts_rank + trigram
    RETURN QUERY
    SELECT 
      v.ayah_no_quran::bigint as id,
      v.surah_no::bigint as surah_id,
      v.ayah_no_surah::bigint as ayah_number,
      v.ayah_ar as text_ar,
      v.ayah_en as text_en,
      v.surah_name_ar,
      v.surah_name_en,
      (
        0.7 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
        0.3 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
      ) as score
    FROM public.verses v
    WHERE v.normalized_text IS NOT NULL
      AND (
        to_tsvector('simple', v.normalized_text) @@ plainto_tsquery('simple', normalized_query) OR
        similarity(v.normalized_text, normalized_query) > 0.1
      )
    ORDER BY score DESC
    LIMIT limit_n;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing verses with normalized text
UPDATE public.verses 
SET normalized_text = normalize_arabic(ayah_ar) 
WHERE ayah_ar IS NOT NULL AND normalized_text IS NULL;

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS verses_fts_idx ON public.verses USING GIN(to_tsvector('simple', normalized_text));
CREATE INDEX IF NOT EXISTS verses_trigram_idx ON public.verses USING GIN(normalized_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS verses_embedding_idx ON public.verses USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);