-- Add normalized_en column and dual-language search support
ALTER TABLE public.verses 
ADD COLUMN IF NOT EXISTS normalized_en text;

-- Fill normalized_en for all verses
UPDATE public.verses 
SET normalized_en = lower(regexp_replace(ayah_en, '[^a-zA-Z0-9 ]', ' ', 'g'))
WHERE normalized_en IS NULL AND ayah_en IS NOT NULL;

-- Create English FTS index
CREATE INDEX IF NOT EXISTS verses_en_fts_idx 
ON public.verses USING GIN(to_tsvector('english', normalized_en));

-- Create English trigram index  
CREATE INDEX IF NOT EXISTS verses_en_trigram_idx 
ON public.verses USING GIN(normalized_en gin_trgm_ops);

-- Drop and recreate RPC with language support
DROP FUNCTION IF EXISTS search_verses_local(text, vector, integer);

CREATE OR REPLACE FUNCTION search_verses_local(
  q text,
  lang text DEFAULT 'ar',
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
  search_column text;
  tsvector_config text;
BEGIN
  -- Determine search parameters based on language
  IF lang = 'en' THEN
    normalized_query := lower(regexp_replace(q, '[^a-zA-Z0-9 ]', ' ', 'g'));
    search_column := 'normalized_en';
    tsvector_config := 'english';
  ELSE
    normalized_query := normalize_arabic(q);
    search_column := 'normalized_text';
    tsvector_config := 'simple';
  END IF;
  
  IF q_embedding IS NOT NULL THEN
    -- Hybrid search: embedding + text search + trigram
    RETURN QUERY
    EXECUTE format('
    SELECT 
      v.ayah_no_quran::bigint as id,
      v.surah_no::bigint as surah_id,
      v.ayah_no_surah::bigint as ayah_number,
      v.ayah_ar as text_ar,
      v.ayah_en as text_en,
      v.surah_name_ar,
      v.surah_name_en,
      (
        0.6 * COALESCE((1 - (v.embedding <=> $3)), 0) +
        0.3 * COALESCE(ts_rank(to_tsvector($4, v.%I), plainto_tsquery($4, $1)), 0) +
        0.1 * COALESCE(similarity(v.%I, $1), 0)
      ) as score
    FROM public.verses v
    WHERE v.%I IS NOT NULL
      AND (
        ($3 IS NOT NULL AND v.embedding IS NOT NULL) OR
        to_tsvector($4, v.%I) @@ plainto_tsquery($4, $1) OR
        similarity(v.%I, $1) > 0.1
      )
    ORDER BY score DESC
    LIMIT $2', search_column, search_column, search_column, search_column, search_column)
    USING normalized_query, limit_n, q_embedding, tsvector_config;
  ELSE
    -- Text-only search: ts_rank + trigram
    RETURN QUERY
    EXECUTE format('
    SELECT 
      v.ayah_no_quran::bigint as id,
      v.surah_no::bigint as surah_id,
      v.ayah_no_surah::bigint as ayah_number,
      v.ayah_ar as text_ar,
      v.ayah_en as text_en,
      v.surah_name_ar,
      v.surah_name_en,
      (
        0.7 * COALESCE(ts_rank(to_tsvector($3, v.%I), plainto_tsquery($3, $1)), 0) +
        0.3 * COALESCE(similarity(v.%I, $1), 0)
      ) as score
    FROM public.verses v
    WHERE v.%I IS NOT NULL
      AND (
        to_tsvector($3, v.%I) @@ plainto_tsquery($3, $1) OR
        similarity(v.%I, $1) > 0.1
      )
    ORDER BY score DESC
    LIMIT $2', search_column, search_column, search_column, search_column, search_column)
    USING normalized_query, limit_n, tsvector_config;
  END IF;
END;
$$ LANGUAGE plpgsql;