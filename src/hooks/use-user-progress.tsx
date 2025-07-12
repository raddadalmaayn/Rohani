import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserProgress {
  total_searches: number;
  total_bookmarks: number;
  favorite_topics: string[];
  streak_days: number;
  last_activity_date: string;
  spiritual_level: number;
  experience_points: number;
}

export function useUserProgress() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.data.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProgress(data);
      } else {
        // Create initial progress record
        const { data: newProgress, error: createError } = await supabase
          .from('user_progress')
          .insert({
            user_id: user.data.user.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        setProgress(newProgress);
      }
    } catch (error) {
      console.error('Error fetching user progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProgress = async (
    searchIncrement = 0,
    bookmarkIncrement = 0,
    topic?: string
  ) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      await supabase.rpc('update_user_progress', {
        p_user_id: user.data.user.id,
        p_search_increment: searchIncrement,
        p_bookmark_increment: bookmarkIncrement,
        p_topic: topic || null,
      });

      // Refresh progress
      await fetchProgress();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, []);

  return {
    progress,
    isLoading,
    updateProgress,
    refreshProgress: fetchProgress,
  };
}