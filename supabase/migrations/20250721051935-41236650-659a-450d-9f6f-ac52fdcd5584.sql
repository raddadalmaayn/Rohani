-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create Quran table
CREATE TABLE public.quran (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_ref TEXT NOT NULL,
    text_ar TEXT NOT NULL,
    text_en TEXT,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Hadith table  
CREATE TABLE public.hadith (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_ref TEXT NOT NULL,
    text_ar TEXT NOT NULL,
    text_en TEXT,
    embedding vector(1536),
    has_dua BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hadith ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Quran verses are publicly readable" 
ON public.quran 
FOR SELECT 
USING (true);

CREATE POLICY "Hadith texts are publicly readable" 
ON public.hadith 
FOR SELECT 
USING (true);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS quran_embedding_idx ON public.quran USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS hadith_embedding_idx ON public.hadith USING ivfflat (embedding vector_cosine_ops);

-- Insert sample data
INSERT INTO public.quran (source_ref, text_ar, text_en) VALUES
('الفاتحة:2', 'الحمد لله رب العالمين', 'Praise be to Allah, the Lord of all the worlds');

INSERT INTO public.hadith (source_ref, text_ar, text_en, has_dua) VALUES
('البخاري:1', 'إنما الأعمال بالنيات', 'Actions are but by intention', false);

-- Create match functions
CREATE OR REPLACE FUNCTION public.match_quran(
    embedding_input vector, 
    match_count integer DEFAULT 6
)
RETURNS TABLE(
    id uuid, 
    source_ref text, 
    text_ar text, 
    text_en text, 
    similarity double precision
)
LANGUAGE sql
STABLE
AS $function$
    SELECT 
        quran.id,
        quran.source_ref,
        quran.text_ar,
        quran.text_en,
        1 - (quran.embedding <=> embedding_input) as similarity
    FROM public.quran
    WHERE quran.embedding IS NOT NULL
    ORDER BY quran.embedding <=> embedding_input
    LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_hadith(
    embedding_input vector, 
    match_count integer DEFAULT 6
)
RETURNS TABLE(
    id uuid, 
    source_ref text, 
    text_ar text, 
    text_en text, 
    similarity double precision
)
LANGUAGE sql
STABLE
AS $function$
    SELECT 
        hadith.id,
        hadith.source_ref,
        hadith.text_ar,
        hadith.text_en,
        1 - (hadith.embedding <=> embedding_input) as similarity
    FROM public.hadith
    WHERE hadith.embedding IS NOT NULL
    ORDER BY hadith.embedding <=> embedding_input
    LIMIT match_count;
$function$;