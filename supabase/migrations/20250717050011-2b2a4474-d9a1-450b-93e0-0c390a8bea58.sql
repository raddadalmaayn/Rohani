-- Enable Row Level Security on verses table
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to verses
CREATE POLICY "Verses are publicly readable" 
ON public.verses 
FOR SELECT 
USING (true);