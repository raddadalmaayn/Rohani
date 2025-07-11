-- Fix vector dimension mismatch for OpenAI text-embedding-3-large
-- Drop existing embedding column and recreate with correct dimensions
ALTER TABLE public.scripture DROP COLUMN embedding;

-- Add embedding column with correct dimensions for text-embedding-3-large (3072)
ALTER TABLE public.scripture ADD COLUMN embedding vector(3072);

-- Recreate the index for embeddings with correct dimensions
DROP INDEX IF EXISTS idx_scripture_embedding;
CREATE INDEX IF NOT EXISTS idx_scripture_embedding ON public.scripture USING ivfflat (embedding vector_cosine_ops);

-- Update the match_scripture function to use correct vector dimensions
CREATE OR REPLACE FUNCTION public.match_scripture(
  query_embedding vector(3072),
  match_count int DEFAULT 6,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_ref text,
  text_ar text,
  text_type text,
  chapter_name text,
  verse_number integer,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    scripture.id,
    scripture.source_ref,
    scripture.text_ar,
    scripture.text_type,
    scripture.chapter_name,
    scripture.verse_number,
    1 - (scripture.embedding <=> query_embedding) as similarity
  FROM public.scripture
  WHERE 
    scripture.embedding IS NOT NULL
    AND CASE 
      WHEN filter_type IS NOT NULL THEN scripture.text_type = filter_type
      ELSE true
    END
  ORDER BY scripture.embedding <=> query_embedding
  LIMIT match_count;
$$;