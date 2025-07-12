import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchSuggestion {
  query: string;
  frequency: number;
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const saveSearch = async (query: string, resultsCount: number = 0) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Use upsert to update existing queries or insert new ones
      const { error } = await supabase
        .from('search_history')
        .upsert({
          user_id: user.data.user.id,
          query: query.trim(),
          results_count: resultsCount,
        }, {
          onConflict: 'user_id,query'
        });

      if (error) throw error;
      await fetchSearchHistory();
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const fetchSearchHistory = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data, error } = await supabase
        .from('search_history')
        .select('query')
        .eq('user_id', user.data.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSearchHistory(data?.map(item => item.query) || []);
    } catch (error) {
      console.error('Error fetching search history:', error);
    }
  };

  const getSuggestions = async (searchTerm: string = '') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_search_suggestions', {
          search_term: searchTerm,
          limit_count: 5
        });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.data.user.id);

      if (error) throw error;
      setSearchHistory([]);
      setSuggestions([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  return {
    searchHistory,
    suggestions,
    isLoading,
    saveSearch,
    getSuggestions,
    clearHistory,
    refreshHistory: fetchSearchHistory,
  };
}