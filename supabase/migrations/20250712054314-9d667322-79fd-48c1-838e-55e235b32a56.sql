-- Create user progress tracking table
CREATE TABLE public.user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_searches INTEGER DEFAULT 0,
  total_bookmarks INTEGER DEFAULT 0,
  favorite_topics TEXT[],
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  spiritual_level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user progress
CREATE POLICY "Users can view their own progress" 
ON public.user_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" 
ON public.user_progress 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create daily reminders table
CREATE TABLE public.daily_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL, -- 0=Sunday, 1=Monday, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for reminders
ALTER TABLE public.daily_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for reminders
CREATE POLICY "Users can manage their own reminders" 
ON public.daily_reminders 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create Islamic calendar events table
CREATE TABLE public.islamic_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'religious', 'historical', 'seasonal'
  hijri_date TEXT NOT NULL,
  gregorian_date DATE,
  description TEXT,
  significance TEXT,
  recommended_actions TEXT[],
  related_verses TEXT[],
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Make Islamic events publicly readable
ALTER TABLE public.islamic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Islamic events are publicly readable" 
ON public.islamic_events 
FOR SELECT 
USING (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_progress_updated_at
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_reminders_updated_at
BEFORE UPDATE ON public.daily_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user progress
CREATE OR REPLACE FUNCTION public.update_user_progress(
  p_user_id UUID,
  p_search_increment INTEGER DEFAULT 0,
  p_bookmark_increment INTEGER DEFAULT 0,
  p_topic TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_date_val DATE := CURRENT_DATE;
  last_activity DATE;
  new_streak INTEGER;
  points_earned INTEGER := 0;
BEGIN
  -- Get or create user progress record
  INSERT INTO public.user_progress (user_id, last_activity_date)
  VALUES (p_user_id, current_date_val)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get last activity date
  SELECT last_activity_date INTO last_activity
  FROM public.user_progress 
  WHERE user_id = p_user_id;

  -- Calculate streak
  IF last_activity = current_date_val THEN
    new_streak := (SELECT streak_days FROM public.user_progress WHERE user_id = p_user_id);
  ELSIF last_activity = current_date_val - INTERVAL '1 day' THEN
    new_streak := (SELECT streak_days FROM public.user_progress WHERE user_id = p_user_id) + 1;
    points_earned := points_earned + 5; -- Streak bonus
  ELSE
    new_streak := 1;
  END IF;

  -- Calculate points
  points_earned := points_earned + (p_search_increment * 2) + (p_bookmark_increment * 5);

  -- Update progress
  UPDATE public.user_progress 
  SET 
    total_searches = total_searches + p_search_increment,
    total_bookmarks = total_bookmarks + p_bookmark_increment,
    favorite_topics = CASE 
      WHEN p_topic IS NOT NULL AND NOT (favorite_topics @> ARRAY[p_topic]) 
      THEN array_append(favorite_topics, p_topic)
      ELSE favorite_topics
    END,
    streak_days = new_streak,
    last_activity_date = current_date_val,
    experience_points = experience_points + points_earned,
    spiritual_level = LEAST(10, 1 + (experience_points + points_earned) / 100),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$function$;

-- Insert some sample Islamic events
INSERT INTO public.islamic_events (event_name, event_type, hijri_date, description, significance, recommended_actions, related_verses) VALUES
('رمضان المبارك', 'religious', '1 رمضان', 'شهر الصيام المبارك', 'شهر التوبة والمغفرة والعتق من النار', ARRAY['الصيام', 'قيام الليل', 'قراءة القرآن', 'الصدقة'], ARRAY['البقرة: 183', 'البقرة: 185']),
('ليلة القدر', 'religious', '27 رمضان', 'ليلة خير من ألف شهر', 'ليلة نزول القرآن الكريم', ARRAY['قيام الليل', 'الدعاء', 'تلاوة القرآن'], ARRAY['القدر: 1-5']),
('عيد الفطر', 'religious', '1 شوال', 'عيد انتهاء شهر رمضان', 'فرحة المؤمنين بإتمام الصيام', ARRAY['صلاة العيد', 'زكاة الفطر', 'التهنئة'], ARRAY['البقرة: 185']),
('عيد الأضحى', 'religious', '10 ذو الحجة', 'عيد الحج الأكبر', 'ذكرى فداء إسماعيل عليه السلام', ARRAY['صلاة العيد', 'الأضحية', 'التكبير'], ARRAY['الصافات: 102-107']),
('يوم عرفة', 'religious', '9 ذو الحجة', 'يوم الحج الأكبر', 'يوم مغفرة الذنوب وعتق الرقاب', ARRAY['الصيام لغير الحاج', 'الدعاء', 'الذكر'], ARRAY['المائدة: 3']);