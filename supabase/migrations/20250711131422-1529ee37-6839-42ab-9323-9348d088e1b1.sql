-- Update the handle_new_user function to work without name requirements
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    display_name,
    email_notifications,
    language,
    spiritual_tradition,
    spiritual_goal
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.email, 'مستخدم جديد'),
    COALESCE((new.raw_user_meta_data ->> 'email_notifications')::boolean, true),
    COALESCE(new.raw_user_meta_data ->> 'language', 'ar'),
    new.raw_user_meta_data ->> 'spiritual_tradition',
    new.raw_user_meta_data ->> 'spiritual_goal'
  );
  RETURN new;
END;
$function$;