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
                      '[َُِّْٰٱٌٍَُِّْٰ]', '', 'g'), -- Remove diacritics
                    'ـ', '', 'g'), -- Remove tatweel
                  '[آأإ]', 'ا', 'g'), -- Normalize alef
                '[ىئ]', 'ي', 'g'), -- Normalize ya
              'ة', 'ه', 'g'), -- Normalize ta marbuta
            '\s+', ' ', 'g'), -- Normalize spaces
          '^\s+|\s+$', '', 'g'), -- Trim
        '[^\u0600-\u06FF\u0750-\u077F\s]', '', 'g'), -- Keep only Arabic and spaces
      '\u202E|\u202D|\u202C', '', 'g'), -- Remove RTL/LTR marks
    '\uFEFF', '', 'g') -- Remove BOM
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing verses with normalized text
UPDATE public.verses 
SET normalized_text = normalize_arabic(ayah_ar) 
WHERE ayah_ar IS NOT NULL AND normalized_text IS NULL;

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS verses_fts_idx ON public.verses USING GIN(to_tsvector('simple', normalized_text));
CREATE INDEX IF NOT EXISTS verses_trigram_idx ON public.verses USING GIN(normalized_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS verses_embedding_idx ON public.verses USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);