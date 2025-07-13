-- Create surahs table for the 114 chapters of the Quran
CREATE TABLE public.surahs (
  id INTEGER PRIMARY KEY CHECK (id >= 1 AND id <= 114),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  ayah_count INTEGER NOT NULL CHECK (ayah_count > 0),
  revelation_place TEXT CHECK (revelation_place IN ('mecca', 'medina')),
  revelation_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create verses table to replace scripture table structure
CREATE TABLE public.verses (
  id SERIAL PRIMARY KEY,
  surah_id INTEGER NOT NULL REFERENCES public.surahs(id),
  ayah_number INTEGER NOT NULL CHECK (ayah_number > 0),
  text_ar TEXT NOT NULL,
  text_en TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(surah_id, ayah_number)
);

-- Enable Row Level Security
ALTER TABLE public.surahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (Quran is public knowledge)
CREATE POLICY "Surahs are publicly readable" 
ON public.surahs 
FOR SELECT 
USING (true);

CREATE POLICY "Verses are publicly readable" 
ON public.verses 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_verses_surah_id ON public.verses(surah_id);
CREATE INDEX idx_verses_ayah_number ON public.verses(ayah_number);
CREATE INDEX idx_verses_embedding ON public.verses USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_verses_text_ar ON public.verses USING gin(to_tsvector('arabic', text_ar));

-- Create function to update timestamps
CREATE TRIGGER update_surahs_updated_at
BEFORE UPDATE ON public.surahs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_verses_updated_at
BEFORE UPDATE ON public.verses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to match verses (replacing match_scripture for new structure)
CREATE OR REPLACE FUNCTION public.match_verses(
  query_embedding vector,
  match_count integer DEFAULT 6,
  filter_surah_id integer DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  surah_id integer,
  ayah_number integer,
  text_ar text,
  text_en text,
  surah_name_ar text,
  surah_name_en text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    v.id,
    v.surah_id,
    v.ayah_number,
    v.text_ar,
    v.text_en,
    s.name_ar as surah_name_ar,
    s.name_en as surah_name_en,
    1 - (v.embedding <=> query_embedding) as similarity
  FROM public.verses v
  JOIN public.surahs s ON v.surah_id = s.id
  WHERE 
    CASE 
      WHEN filter_surah_id IS NOT NULL THEN v.surah_id = filter_surah_id
      ELSE true
    END
    AND v.embedding IS NOT NULL
  ORDER BY v.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Insert the 114 surahs with basic information
INSERT INTO public.surahs (id, name_ar, name_en, ayah_count, revelation_place, revelation_order) VALUES
(1, 'الفاتحة', 'Al-Fatihah', 7, 'mecca', 5),
(2, 'البقرة', 'Al-Baqarah', 286, 'medina', 87),
(3, 'آل عمران', 'Ali Imran', 200, 'medina', 89),
(4, 'النساء', 'An-Nisa', 176, 'medina', 92),
(5, 'المائدة', 'Al-Maidah', 120, 'medina', 112),
(6, 'الأنعام', 'Al-Anam', 165, 'mecca', 55),
(7, 'الأعراف', 'Al-Araf', 206, 'mecca', 39),
(8, 'الأنفال', 'Al-Anfal', 75, 'medina', 88),
(9, 'التوبة', 'At-Tawbah', 129, 'medina', 113),
(10, 'يونس', 'Yunus', 109, 'mecca', 51),
(11, 'هود', 'Hud', 123, 'mecca', 52),
(12, 'يوسف', 'Yusuf', 111, 'mecca', 53),
(13, 'الرعد', 'Ar-Rad', 43, 'medina', 96),
(14, 'إبراهيم', 'Ibrahim', 52, 'mecca', 72),
(15, 'الحجر', 'Al-Hijr', 99, 'mecca', 54),
(16, 'النحل', 'An-Nahl', 128, 'mecca', 70),
(17, 'الإسراء', 'Al-Isra', 111, 'mecca', 50),
(18, 'الكهف', 'Al-Kahf', 110, 'mecca', 69),
(19, 'مريم', 'Maryam', 98, 'mecca', 44),
(20, 'طه', 'Ta-Ha', 135, 'mecca', 45),
(21, 'الأنبياء', 'Al-Anbiya', 112, 'mecca', 73),
(22, 'الحج', 'Al-Hajj', 78, 'medina', 103),
(23, 'المؤمنون', 'Al-Muminun', 118, 'mecca', 74),
(24, 'النور', 'An-Nur', 64, 'medina', 102),
(25, 'الفرقان', 'Al-Furqan', 77, 'mecca', 42),
(26, 'الشعراء', 'Ash-Shuara', 227, 'mecca', 47),
(27, 'النمل', 'An-Naml', 93, 'mecca', 48),
(28, 'القصص', 'Al-Qasas', 88, 'mecca', 49),
(29, 'العنكبوت', 'Al-Ankabut', 69, 'mecca', 85),
(30, 'الروم', 'Ar-Rum', 60, 'mecca', 84),
(31, 'لقمان', 'Luqman', 34, 'mecca', 57),
(32, 'السجدة', 'As-Sajdah', 30, 'mecca', 75),
(33, 'الأحزاب', 'Al-Ahzab', 73, 'medina', 90),
(34, 'سبأ', 'Saba', 54, 'mecca', 58),
(35, 'فاطر', 'Fatir', 45, 'mecca', 43),
(36, 'يس', 'Ya-Sin', 83, 'mecca', 41),
(37, 'الصافات', 'As-Saffat', 182, 'mecca', 56),
(38, 'ص', 'Sad', 88, 'mecca', 38),
(39, 'الزمر', 'Az-Zumar', 75, 'mecca', 59),
(40, 'غافر', 'Ghafir', 85, 'mecca', 60),
(41, 'فصلت', 'Fussilat', 54, 'mecca', 61),
(42, 'الشورى', 'Ash-Shura', 53, 'mecca', 62),
(43, 'الزخرف', 'Az-Zukhruf', 89, 'mecca', 63),
(44, 'الدخان', 'Ad-Dukhan', 59, 'mecca', 64),
(45, 'الجاثية', 'Al-Jathiyah', 37, 'mecca', 65),
(46, 'الأحقاف', 'Al-Ahqaf', 35, 'mecca', 66),
(47, 'محمد', 'Muhammad', 38, 'medina', 95),
(48, 'الفتح', 'Al-Fath', 29, 'medina', 111),
(49, 'الحجرات', 'Al-Hujurat', 18, 'medina', 106),
(50, 'ق', 'Qaf', 45, 'mecca', 34),
(51, 'الذاريات', 'Adh-Dhariyat', 60, 'mecca', 67),
(52, 'الطور', 'At-Tur', 49, 'mecca', 76),
(53, 'النجم', 'An-Najm', 62, 'mecca', 23),
(54, 'القمر', 'Al-Qamar', 55, 'mecca', 37),
(55, 'الرحمن', 'Ar-Rahman', 78, 'medina', 97),
(56, 'الواقعة', 'Al-Waqiah', 96, 'mecca', 46),
(57, 'الحديد', 'Al-Hadid', 29, 'medina', 94),
(58, 'المجادلة', 'Al-Mujadila', 22, 'medina', 105),
(59, 'الحشر', 'Al-Hashr', 24, 'medina', 101),
(60, 'الممتحنة', 'Al-Mumtahanah', 13, 'medina', 91),
(61, 'الصف', 'As-Saff', 14, 'medina', 109),
(62, 'الجمعة', 'Al-Jumuah', 11, 'medina', 110),
(63, 'المنافقون', 'Al-Munafiqun', 11, 'medina', 104),
(64, 'التغابن', 'At-Taghabun', 18, 'medina', 108),
(65, 'الطلاق', 'At-Talaq', 12, 'medina', 99),
(66, 'التحريم', 'At-Tahrim', 12, 'medina', 107),
(67, 'الملك', 'Al-Mulk', 30, 'mecca', 77),
(68, 'القلم', 'Al-Qalam', 52, 'mecca', 2),
(69, 'الحاقة', 'Al-Haqqah', 52, 'mecca', 78),
(70, 'المعارج', 'Al-Maarij', 44, 'mecca', 79),
(71, 'نوح', 'Nuh', 28, 'mecca', 71),
(72, 'الجن', 'Al-Jinn', 28, 'mecca', 40),
(73, 'المزمل', 'Al-Muzzammil', 20, 'mecca', 3),
(74, 'المدثر', 'Al-Muddaththir', 56, 'mecca', 4),
(75, 'القيامة', 'Al-Qiyamah', 40, 'mecca', 31),
(76, 'الإنسان', 'Al-Insan', 31, 'medina', 98),
(77, 'المرسلات', 'Al-Mursalat', 50, 'mecca', 33),
(78, 'النبأ', 'An-Naba', 40, 'mecca', 80),
(79, 'النازعات', 'An-Naziat', 46, 'mecca', 81),
(80, 'عبس', 'Abasa', 42, 'mecca', 24),
(81, 'التكوير', 'At-Takwir', 29, 'mecca', 7),
(82, 'الانفطار', 'Al-Infitar', 19, 'mecca', 82),
(83, 'المطففين', 'Al-Mutaffifin', 36, 'mecca', 86),
(84, 'الانشقاق', 'Al-Inshiqaq', 25, 'mecca', 83),
(85, 'البروج', 'Al-Buruj', 22, 'mecca', 27),
(86, 'الطارق', 'At-Tariq', 17, 'mecca', 36),
(87, 'الأعلى', 'Al-Ala', 19, 'mecca', 8),
(88, 'الغاشية', 'Al-Ghashiyah', 26, 'mecca', 68),
(89, 'الفجر', 'Al-Fajr', 30, 'mecca', 10),
(90, 'البلد', 'Al-Balad', 20, 'mecca', 35),
(91, 'الشمس', 'Ash-Shams', 15, 'mecca', 26),
(92, 'الليل', 'Al-Layl', 21, 'mecca', 9),
(93, 'الضحى', 'Ad-Duha', 11, 'mecca', 11),
(94, 'الشرح', 'Ash-Sharh', 8, 'mecca', 12),
(95, 'التين', 'At-Tin', 8, 'mecca', 28),
(96, 'العلق', 'Al-Alaq', 19, 'mecca', 1),
(97, 'القدر', 'Al-Qadr', 5, 'mecca', 25),
(98, 'البينة', 'Al-Bayyinah', 8, 'medina', 100),
(99, 'الزلزلة', 'Az-Zalzalah', 8, 'medina', 93),
(100, 'العاديات', 'Al-Adiyat', 11, 'mecca', 14),
(101, 'القارعة', 'Al-Qariah', 11, 'mecca', 30),
(102, 'التكاثر', 'At-Takathur', 8, 'mecca', 16),
(103, 'العصر', 'Al-Asr', 3, 'mecca', 13),
(104, 'الهمزة', 'Al-Humazah', 9, 'mecca', 32),
(105, 'الفيل', 'Al-Fil', 5, 'mecca', 19),
(106, 'قريش', 'Quraysh', 4, 'mecca', 29),
(107, 'الماعون', 'Al-Maun', 7, 'mecca', 17),
(108, 'الكوثر', 'Al-Kawthar', 3, 'mecca', 15),
(109, 'الكافرون', 'Al-Kafirun', 6, 'mecca', 18),
(110, 'النصر', 'An-Nasr', 3, 'medina', 114),
(111, 'المسد', 'Al-Masad', 5, 'mecca', 6),
(112, 'الإخلاص', 'Al-Ikhlas', 4, 'mecca', 22),
(113, 'الفلق', 'Al-Falaq', 5, 'mecca', 20),
(114, 'الناس', 'An-Nas', 6, 'mecca', 21);