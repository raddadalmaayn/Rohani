-- Fix the RPC function with correct to_tsvector syntax
DROP FUNCTION IF EXISTS search_verses_local(text, text, vector, integer);

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
BEGIN
  -- Determine search parameters based on language
  IF lang = 'en' THEN
    normalized_query := lower(regexp_replace(q, '[^a-zA-Z0-9 ]', ' ', 'g'));
    
    IF q_embedding IS NOT NULL THEN
      -- Hybrid search for English: embedding + text search + trigram
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
          0.6 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.3 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.1 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_en IS NOT NULL
        AND (
          (q_embedding IS NOT NULL AND v.embedding IS NOT NULL) OR
          to_tsvector('english', v.normalized_en) @@ plainto_tsquery('english', normalized_query) OR
          similarity(v.normalized_en, normalized_query) > 0.1
        )
      ORDER BY score DESC
      LIMIT limit_n;
    ELSE
      -- Text-only search for English: ts_rank + trigram
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
          0.7 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.3 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_en IS NOT NULL
        AND (
          to_tsvector('english', v.normalized_en) @@ plainto_tsquery('english', normalized_query) OR
          similarity(v.normalized_en, normalized_query) > 0.1
        )
      ORDER BY score DESC
      LIMIT limit_n;
    END IF;
  ELSE
    -- Arabic search
    normalized_query := normalize_arabic(q);
    
    IF q_embedding IS NOT NULL THEN
      -- Hybrid search for Arabic: embedding + text search + trigram
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
          0.6 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.3 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
          0.1 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_text IS NOT NULL
        AND (
          (q_embedding IS NOT NULL AND v.embedding IS NOT NULL) OR
          to_tsvector('simple', v.normalized_text) @@ plainto_tsquery('simple', normalized_query) OR
          similarity(v.normalized_text, normalized_query) > 0.1
        )
      ORDER BY score DESC
      LIMIT limit_n;
    ELSE
      -- Text-only search for Arabic: ts_rank + trigram
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
  END IF;
END;
$$ LANGUAGE plpgsql;