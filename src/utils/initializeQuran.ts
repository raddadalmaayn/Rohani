import { supabase } from '@/integrations/supabase/client';

export const initializeQuran = async () => {
  try {
    console.log('Checking if Quran data needs initialization...');
    
    // Check if we have verse data
    const { data: verseCheck } = await supabase
      .from('verses')
      .select('id')
      .limit(1);

    if (!verseCheck || verseCheck.length === 0) {
      console.log('No verses found, calling ingest-quran function...');
      
      const { data, error } = await supabase.functions.invoke('ingest-quran');
      
      if (error) {
        console.error('Error calling ingest-quran:', error);
        throw error;
      }
      
      console.log('Quran data initialized successfully:', data);
      return data;
    } else {
      console.log('Quran data already exists');
      return { success: true, message: 'Data already exists' };
    }
  } catch (error) {
    console.error('Error initializing Quran data:', error);
    throw error;
  }
};