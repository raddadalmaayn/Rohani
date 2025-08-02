import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Verse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en?: string;
  juz_no?: number;
  ruko_no?: number;
  manzil_no?: number;
  hizb_quarter?: number;
  sajah_ayah?: boolean;
  sajdah_no?: string;
  surah_name_ar?: string;
  surah_name_en?: string;
}

interface QuranPageData {
  pageNumber: number;
  verses: Verse[];
  juzNumber?: number;
}

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
  ayah_count: number;
  revelation_place: string;
  revelation_order: number;
}

// Cache for Arabic number formatting
const arabicNumberCache = new Map<number, string>();

export const formatArabicNumber = (num: number): string => {
  if (arabicNumberCache.has(num)) {
    return arabicNumberCache.get(num)!;
  }
  
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const result = num.toString().split('').map(digit => arabicNumerals[parseInt(digit)]).join('');
  arabicNumberCache.set(num, result);
  return result;
};

// Debug utility - disabled in production
const debug = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.info(message, ...args);
  }
};

export const useMushafPages = (isMobile: boolean) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verseCache, setVerseCache] = useState<Map<number, Verse[]>>(new Map());

  // Calculate verses per page based on screen size
  const maxCharsPerPage = useMemo(() => {
    return isMobile ? 950 : 1300;
  }, [isMobile]);

  const buildPages = (allVerses: Verse[]): QuranPageData[] => {
    const pages: QuranPageData[] = [];
    let pageNumber = 1;
    let currentPageVerses: Verse[] = [];
    let charCount = 0;
    
    for (const verse of allVerses) {
      const verseCharCount = verse.ayah_ar.length;
      
      if (charCount + verseCharCount > maxCharsPerPage && currentPageVerses.length > 0) {
        // Create new page
        const juzNumber = currentPageVerses[0]?.juz_no;
        pages.push({
          pageNumber,
          verses: currentPageVerses,
          juzNumber,
        });
        
        // Start new page
        currentPageVerses = [verse];
        charCount = verseCharCount;
        pageNumber++;
      } else {
        currentPageVerses.push(verse);
        charCount += verseCharCount;
      }
    }
    
    // Add remaining verses as last page
    if (currentPageVerses.length > 0) {
      const juzNumber = currentPageVerses[0]?.juz_no;
      pages.push({
        pageNumber,
        verses: currentPageVerses,
        juzNumber,
      });
    }
    
    return pages;
  };

  const quranPages = useMemo(() => {
    return buildPages(verses);
  }, [verses, maxCharsPerPage, selectedSurah?.id]);

  // Prefetch adjacent surahs
  useEffect(() => {
    if (selectedSurah && surahs.length > 0) {
      const currentIndex = surahs.findIndex(s => s.id === selectedSurah.id);
      
      // Prefetch next surah
      if (currentIndex < surahs.length - 1) {
        const nextSurahId = surahs[currentIndex + 1].id;
        if (!verseCache.has(nextSurahId)) {
          loadVerses(nextSurahId).catch(error => 
            debug('Error prefetching next surah:', error)
          );
        }
      }
      
      // Prefetch previous surah
      if (currentIndex > 0) {
        const prevSurahId = surahs[currentIndex - 1].id;
        if (!verseCache.has(prevSurahId)) {
          loadVerses(prevSurahId).catch(error => 
            debug('Error prefetching previous surah:', error)
          );
        }
      }
    }
  }, [selectedSurah?.id, surahs]);

  useEffect(() => {
    loadSurahs();
  }, []);

  const loadSurahs = async () => {
    try {
      debug('Loading surahs...');
      const { data, error } = await supabase
        .from('surahs')
        .select('*')
        .order('id');

      if (error) throw error;

      setSurahs(data);
      debug('Surahs loaded:', data.length);
      
      // Load first surah by default
      if (data.length > 0) {
        handleSurahSelection(data[0]);
      }
    } catch (error) {
      debug('Error loading surahs:', error);
      throw error;
    }
  };

  const loadVerses = async (surahId: number): Promise<Verse[]> => {
    // Check cache first
    if (verseCache.has(surahId)) {
      return verseCache.get(surahId)!;
    }

    try {
      debug('🔍 Loading verses for surah:', surahId);

      const { data, error } = await supabase
        .from('verses')
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en, juz_no, ruko_no, manzil_no, hizb_quarter, sajah_ayah, sajdah_no, surah_name_ar, surah_name_en')
        .eq('surah_no', surahId)
        .order('ayah_no_surah');

      if (error) throw error;

      debug(`✅ Loaded ${data.length} verses for surah ${surahId}`);
      
      // Cache the verses
      setVerseCache(prev => new Map(prev).set(surahId, data));
      
      return data;
    } catch (error) {
      debug('Error loading verses:', error);
      throw error;
    }
  };

  const handleSurahSelection = async (surah: Surah) => {
    debug('Opening surah:', surah);
    setSelectedSurah(surah);
    setLoading(true);
    
    try {
      const loadedVerses = await loadVerses(surah.id);
      setVerses(loadedVerses);
      setCurrentPageIndex(0);
      // Don't prefetch here anymore - handled by useEffect
    } catch (error) {
      debug('Error in handleSurahSelection:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const prefetchAdjacentSurahs = async (currentSurahId: number) => {
    // This is now handled by the useEffect above
  };

  const goToNextPage = () => {
    if (currentPageIndex < quranPages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else {
      // Go to next surah
      const currentSurahIndex = surahs.findIndex(s => s.id === selectedSurah?.id);
      if (currentSurahIndex < surahs.length - 1) {
        handleSurahSelection(surahs[currentSurahIndex + 1]);
      }
    }
  };

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    } else {
      // Go to previous surah
      const currentSurahIndex = surahs.findIndex(s => s.id === selectedSurah?.id);
      if (currentSurahIndex > 0) {
        handleSurahSelection(surahs[currentSurahIndex - 1]);
      }
    }
  };

  const jumpToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= quranPages.length) {
      setCurrentPageIndex(pageNumber - 1);
    }
  };

  return {
    surahs,
    selectedSurah,
    verses,
    currentPageIndex,
    quranPages,
    loading,
    handleSurahSelection,
    goToNextPage,
    goToPreviousPage,
    jumpToPage,
    setCurrentPageIndex,
  };
};