-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create scripture table for verses and hadiths with embeddings
CREATE TABLE public.scripture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ref TEXT NOT NULL, -- e.g., "البخاري 1/3" or "يوسف: 12"
  text_ar TEXT NOT NULL,
  text_type TEXT NOT NULL CHECK (text_type IN ('quran', 'hadith')),
  chapter_name TEXT, -- For Quran: surah name, For Hadith: book name
  verse_number INTEGER, -- For Quran verses
  embedding vector(1536), -- OpenAI text-embedding-3-large dimension
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scripture ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (scripture should be readable by all)
CREATE POLICY "Scripture is publicly readable" 
ON public.scripture 
FOR SELECT 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_scripture_text_type ON public.scripture(text_type);
CREATE INDEX idx_scripture_source_ref ON public.scripture(source_ref);
CREATE INDEX IF NOT EXISTS idx_scripture_embedding ON public.scripture USING ivfflat (embedding vector_cosine_ops);

-- Create function for semantic search using cosine similarity
CREATE OR REPLACE FUNCTION public.match_scripture(
  query_embedding vector(1536),
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
    CASE 
      WHEN filter_type IS NOT NULL THEN scripture.text_type = filter_type
      ELSE true
    END
  ORDER BY scripture.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Add trigger for updating timestamps
CREATE TRIGGER update_scripture_updated_at
BEFORE UPDATE ON public.scripture
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample Islamic content for testing
INSERT INTO public.scripture (source_ref, text_ar, text_type, chapter_name, verse_number) VALUES
('الفاتحة: 2', 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', 'quran', 'الفاتحة', 2),
('البقرة: 255', 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ', 'quran', 'البقرة', 255),
('آل عمران: 26', 'قُلِ اللَّهُمَّ مَالِكَ الْمُلْكِ تُؤْتِي الْمُلْكَ مَن تَشَاءُ وَتَنزِعُ الْمُلْكَ مِمَّن تَشَاءُ', 'quran', 'آل عمران', 26),
('البخاري 1/8', 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى', 'hadith', 'صحيح البخاري', NULL),
('مسلم 2/43', 'من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت', 'hadith', 'صحيح مسلم', NULL),
('الترمذي 5/621', 'الدعاء مخ العبادة', 'hadith', 'سنن الترمذي', NULL);