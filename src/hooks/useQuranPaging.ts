import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Verse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en: string;
  surah_name_ar: string;
  surah_name_en: string;
  surah_name_roman: string;
}

interface QuranPage {
  pageNumber: number;
  verses: Verse[];
  surahInfo?: {
    name_ar: string;
    name_en: string;
    name_roman: string;
    isNewSurah: boolean;
  };
}

export const useQuranPaging = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<{ [key: number]: QuranPage }>({});
  const [loading, setLoading] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load current page from localStorage
  useEffect(() => {
    const savedPage = localStorage.getItem('quran-current-page');
    if (savedPage) {
      setCurrentPage(parseInt(savedPage, 10));
    }
  }, []);

  // Save current page to localStorage
  useEffect(() => {
    localStorage.setItem('quran-current-page', currentPage.toString());
  }, [currentPage]);

  const fetchPage = useCallback(async (pageNo: number): Promise<QuranPage> => {
    if (pages[pageNo]) {
      return pages[pageNo];
    }

    setLoading(true);
    try {
      // Calculate verses per page (approximately 15 verses per page for 604 pages)
      const versesPerPage = Math.ceil(6236 / 604); // Total verses in Quran
      const startVerse = (pageNo - 1) * versesPerPage + 1;
      const endVerse = pageNo * versesPerPage;

      const { data: verses, error } = await supabase
        .from('verses')
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en, surah_name_ar, surah_name_en, surah_name_roman')
        .gte('ayah_no_quran', startVerse)
        .lte('ayah_no_quran', endVerse)
        .order('ayah_no_quran');

      if (error) throw error;

      // Check if this page starts a new surah
      const isNewSurah = verses && verses.length > 0 && verses[0].ayah_no_surah === 1;
      
      const page: QuranPage = {
        pageNumber: pageNo,
        verses: verses || [],
        surahInfo: isNewSurah ? {
          name_ar: verses[0].surah_name_ar,
          name_en: verses[0].surah_name_en,
          name_roman: verses[0].surah_name_roman,
          isNewSurah: true
        } : undefined
      };

      setPages(prev => ({ ...prev, [pageNo]: page }));
      return page;
    } catch (error) {
      console.error('Error fetching page:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [pages]);

  const goToPage = useCallback((pageNo: number) => {
    if (pageNo >= 1 && pageNo <= 604) {
      setCurrentPage(pageNo);
      // Prefetch adjacent pages
      fetchPage(pageNo);
      if (pageNo > 1) fetchPage(pageNo - 1);
      if (pageNo < 604) fetchPage(pageNo + 1);
    }
  }, [fetchPage]);

  const nextPage = useCallback(() => {
    if (currentPage < 604) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, goToPage]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const jumpToSurah = useCallback(async (surahNumber: number) => {
    try {
      const { data: firstVerse, error } = await supabase
        .from('verses')
        .select('ayah_no_quran')
        .eq('surah_no', surahNumber)
        .eq('ayah_no_surah', 1)
        .single();

      if (error) throw error;

      const versesPerPage = Math.ceil(6236 / 604);
      const pageNo = Math.ceil(firstVerse.ayah_no_quran / versesPerPage);
      goToPage(pageNo);
    } catch (error) {
      console.error('Error jumping to surah:', error);
    }
  }, [goToPage]);

  return {
    currentPage,
    pages,
    loading,
    fontScale,
    theme,
    setFontScale,
    setTheme,
    fetchPage,
    goToPage,
    nextPage,
    previousPage,
    jumpToSurah
  };
};