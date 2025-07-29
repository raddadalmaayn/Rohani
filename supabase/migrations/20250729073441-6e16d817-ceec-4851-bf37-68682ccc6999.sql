-- Update search_verses_local to use tighter scoring weights and threshold
CREATE OR REPLACE FUNCTION public.search_verses_local(q text, lang text DEFAULT 'ar'::text, q_embedding vector DEFAULT NULL::vector, limit_n integer DEFAULT 10)
 RETURNS TABLE(id bigint, surah_id bigint, ayah_number bigint, text_ar text, text_en text, surah_name_ar text, surah_name_en text, score double precision)
 LANGUAGE plpgsql
AS $function$
DECLARE
  normalized_query text;
  min_score constant double precision := 0.68;
BEGIN
  -- Determine search parameters based on language
  IF lang = 'en' THEN
    normalized_query := lower(regexp_replace(q, '[^a-zA-Z0-9 ]', ' ', 'g'));
    
    IF q_embedding IS NOT NULL THEN
      -- Hybrid search for English: tighter weights - more emphasis on semantic
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
          0.8 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.15 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.05 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_en IS NOT NULL
        AND (
          (q_embedding IS NOT NULL AND v.embedding IS NOT NULL) OR
          to_tsvector('english', v.normalized_en) @@ plainto_tsquery('english', normalized_query) OR
          similarity(v.normalized_en, normalized_query) > 0.1
        )
        AND (
          0.8 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.15 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.05 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) >= min_score
      ORDER BY score DESC
      LIMIT limit_n;
    ELSE
      -- Text-only search for English
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
          0.85 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.15 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_en IS NOT NULL
        AND (
          to_tsvector('english', v.normalized_en) @@ plainto_tsquery('english', normalized_query) OR
          similarity(v.normalized_en, normalized_query) > 0.1
        )
        AND (
          0.85 * COALESCE(ts_rank(to_tsvector('english', v.normalized_en), plainto_tsquery('english', normalized_query)), 0) +
          0.15 * COALESCE(similarity(v.normalized_en, normalized_query), 0)
        ) >= min_score
      ORDER BY score DESC
      LIMIT limit_n;
    END IF;
  ELSE
    -- Arabic search
    normalized_query := normalize_arabic(q);
    
    IF q_embedding IS NOT NULL THEN
      -- Hybrid search for Arabic: tighter weights - more emphasis on semantic
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
          0.8 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.15 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
          0.05 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_text IS NOT NULL
        AND (
          (q_embedding IS NOT NULL AND v.embedding IS NOT NULL) OR
          to_tsvector('simple', v.normalized_text) @@ plainto_tsquery('simple', normalized_query) OR
          similarity(v.normalized_text, normalized_query) > 0.1
        )
        AND (
          0.8 * COALESCE((1 - (v.embedding <=> q_embedding)), 0) +
          0.15 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
          0.05 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
        ) >= min_score
      ORDER BY score DESC
      LIMIT limit_n;
    ELSE
      -- Text-only search for Arabic
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
          0.85 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
          0.15 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
        ) as score
      FROM public.verses v
      WHERE v.normalized_text IS NOT NULL
        AND (
          to_tsvector('simple', v.normalized_text) @@ plainto_tsquery('simple', normalized_query) OR
          similarity(v.normalized_text, normalized_query) > 0.1
        )
        AND (
          0.85 * COALESCE(ts_rank(to_tsvector('simple', v.normalized_text), plainto_tsquery('simple', normalized_query)), 0) +
          0.15 * COALESCE(similarity(v.normalized_text, normalized_query), 0)
        ) >= min_score
      ORDER BY score DESC
      LIMIT limit_n;
    END IF;
  END IF;
END;
$function$;

-- Add more Arabic and English synonyms for better query expansion
INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('طمأنينة', ARRAY['سكون','سكينة','راحة','هدوء','استقرار'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('خوف', ARRAY['رهبة','خشية','وجل','فزع','هلع'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('قلق', ARRAY['هم','توتر','خوف','وسواس','انزعاج','ضيق'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('حزن', ARRAY['ضيق','كآبة','أسى','غم','كدر'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('دعاء', ARRAY['ذكر','تسبيح','استغفار','تهليل','تحميد'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('صبر', ARRAY['احتمال','تحمل','ثبات','مصابرة'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('anxiety', ARRAY['worry','fear','stress','unease','nervousness','apprehension'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('peace', ARRAY['tranquility','calm','serenity','tranquillity','quietude'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('prayer', ARRAY['supplication','invocation','dua','remembrance','dhikr'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('patience', ARRAY['endurance','perseverance','forbearance','tolerance'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;

INSERT INTO public.keywords_map (keyword, synonyms) VALUES
('guidance', ARRAY['direction','counsel','advice','instruction','wisdom'])
ON CONFLICT (keyword) DO UPDATE SET synonyms = EXCLUDED.synonyms;