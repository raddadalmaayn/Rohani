import { supabase } from '@/integrations/supabase/client';

export async function initializeQuranData() {
  try {
    console.log('Checking if Quran data needs initialization...');

    // Check if verses already exist
    const { count, error: countError } = await supabase
      .from('verses')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error checking verse count:', countError);
      return;
    }

    if (count && count > 0) {
      console.log('Quran data already exists:', count, 'verses');
      return;
    }

    console.log('Initializing Quran data...');

    // Call the ingest-quran edge function
    const { data, error } = await supabase.functions.invoke('ingest-quran');

    if (error) {
      console.error('Error calling ingest-quran function:', error);
      return;
    }

    console.log('Quran initialization completed:', data);
    return data;

  } catch (error) {
    console.error('Error in initializeQuranData:', error);
  }
}