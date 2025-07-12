import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProgress } from '@/hooks/use-user-progress';

interface Bookmark {
  id: string;
  scripture_id: string;
  notes: string | null;
  created_at: string;
  scripture: {
    text_ar: string;
    source_ref: string;
    text_type: string;
    chapter_name: string | null;
    verse_number: number | null;
  };
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { updateProgress } = useUserProgress();

  const fetchBookmarks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          id,
          scripture_id,
          notes,
          created_at,
          scripture:scripture_id (
            text_ar,
            source_ref,
            text_type,
            chapter_name,
            verse_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookmarks(data || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      toast({
        title: 'خطأ في جلب المفضلة',
        description: 'حدث خطأ أثناء جلب النصوص المحفوظة',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addBookmark = async (scriptureId: string, notes?: string) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: 'يجب تسجيل الدخول',
          description: 'يجب تسجيل الدخول لحفظ النصوص',
          variant: 'destructive',
        });
        return false;
      }

      const { error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.data.user.id,
          scripture_id: scriptureId,
          notes: notes || null,
        });

      if (error) throw error;

      toast({
        title: 'تم الحفظ',
        description: 'تم إضافة النص إلى المفضلة',
      });

      await updateProgress(0, 1);
      await fetchBookmarks();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'موجود مسبقاً',
          description: 'هذا النص محفوظ في المفضلة مسبقاً',
          variant: 'destructive',
        });
      } else {
        console.error('Error adding bookmark:', error);
        toast({
          title: 'خطأ في الحفظ',
          description: 'حدث خطأ أثناء حفظ النص',
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) throw error;

      toast({
        title: 'تم الحذف',
        description: 'تم حذف النص من المفضلة',
      });

      await fetchBookmarks();
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast({
        title: 'خطأ في الحذف',
        description: 'حدث خطأ أثناء حذف النص',
        variant: 'destructive',
      });
      return false;
    }
  };

  const isBookmarked = async (scriptureId: string): Promise<boolean> => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return false;

      const { data, error } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.data.user.id)
        .eq('scripture_id', scriptureId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking bookmark status:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  return {
    bookmarks,
    isLoading,
    addBookmark,
    removeBookmark,
    isBookmarked,
    refreshBookmarks: fetchBookmarks,
  };
}