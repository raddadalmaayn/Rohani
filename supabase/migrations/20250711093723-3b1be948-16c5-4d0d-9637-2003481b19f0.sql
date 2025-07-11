-- Recreate the match_scripture function to accept text input and convert internally
CREATE OR REPLACE FUNCTION match_scripture(
  embedding_input text,        -- Accept as text instead of vector
  match_count integer DEFAULT 6
)
RETURNS TABLE(
  id uuid,
  source_ref text,
  text_ar text,
  text_type text,
  chapter_name text,
  verse_number integer,
  similarity double precision
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
    1 - (scripture.embedding <=> embedding_input::vector) as similarity
  FROM public.scripture
  WHERE scripture.embedding IS NOT NULL
  ORDER BY scripture.embedding <=> embedding_input::vector
  LIMIT match_count;
$$;