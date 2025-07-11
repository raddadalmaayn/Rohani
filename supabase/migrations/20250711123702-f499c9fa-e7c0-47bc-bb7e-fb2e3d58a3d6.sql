-- Ensure profiles table has all necessary fields for onboarding
-- (Most fields already exist, but let's make sure username is properly indexed)

-- Add index for username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Add index for user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Update the handle_new_user function to include username from onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    display_name,
    username,
    email_notifications,
    language,
    spiritual_tradition,
    spiritual_goal
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    COALESCE(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'username',
    COALESCE((new.raw_user_meta_data ->> 'email_notifications')::boolean, true),
    COALESCE(new.raw_user_meta_data ->> 'language', 'en'),
    new.raw_user_meta_data ->> 'spiritual_tradition',
    new.raw_user_meta_data ->> 'spiritual_goal'
  );
  RETURN new;
END;
$$;