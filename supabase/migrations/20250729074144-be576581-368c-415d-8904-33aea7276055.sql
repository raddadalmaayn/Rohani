-- Update expand_query_with_synonyms to remove duplicates properly
CREATE OR REPLACE FUNCTION public.expand_query_with_synonyms(input_query text, input_lang text DEFAULT 'ar'::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  expanded_terms text[];
  final_query text;
  query_words text[];
  word text;
  synonyms_found text[];
BEGIN
  -- Clean and split the input query
  IF input_lang = 'ar' THEN
    final_query := normalize_arabic(input_query);
  ELSE
    final_query := lower(regexp_replace(input_query, '[^a-zA-Z0-9 ]', ' ', 'g'));
  END IF;
  
  query_words := string_to_array(final_query, ' ');
  expanded_terms := query_words; -- Start with original words
  
  -- Look up synonyms for each word
  FOREACH word IN ARRAY query_words
  LOOP
    IF length(trim(word)) > 2 THEN -- Only process meaningful words
      SELECT synonyms INTO synonyms_found
      FROM public.keywords_map 
      WHERE keyword = trim(word);
      
      -- Add synonyms to expanded terms
      IF synonyms_found IS NOT NULL THEN
        expanded_terms := expanded_terms || synonyms_found;
      END IF;
    END IF;
  END LOOP;
  
  -- Remove duplicates using DISTINCT and join, filter out very short words
  SELECT string_agg(DISTINCT term, ' ')
  INTO final_query
  FROM unnest(expanded_terms) AS term
  WHERE length(trim(term)) > 1;
  
  RETURN COALESCE(final_query, input_query);
END;
$function$;