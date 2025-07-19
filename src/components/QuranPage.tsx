import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, BookOpen, Settings, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
  ayah_count: number;
  revelation_place: string;
  revelation_order: number;
}

interface Verse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en?: string;
}

interface QuranPageData {
  pageNumber: number;
  verses: Verse[];
  startSurah?: string;
  endSurah?: string;
}

const QuranPage: React.FC = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [quranPages, setQuranPages] = useState<QuranPageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showTafsir, setShowTafsir] = useState(false);
  const { toast } = useToast();

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Traditional Mus'haf page settings - approximately 15 lines per page
  const versesPerPage = 15;

  useEffect(() => {
    loadSurahs();
  }, []);

  const loadSurahs = async () => {
    try {
      console.info('Loading surahs...');
      const { data, error } = await supabase
        .from('surahs')
        .select('*')
        .order('id');

      if (error) throw error;

      setSurahs(data);
      console.info('Surahs loaded:', data.length);
      
      // Load first surah by default
      if (data.length > 0) {
        handleSurahSelection(data[0]);
      }
    } catch (error) {
      console.error('Error loading surahs:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل السور",
        variant: "destructive",
      });
    }
  };

  const handleSurahSelection = async (surah: Surah) => {
    console.info('Opening surah:', surah);
    setSelectedSurah(surah);
    await loadVerses(surah.id);
  };

  const loadVerses = async (surahId: number) => {
    try {
      setLoading(true);
      console.info('🔍 Loading verses for surah:', surahId, 'type:', typeof surahId);

      const { data, error } = await supabase
        .from('verses')
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en')
        .eq('surah_no', surahId)
        .order('ayah_no_surah');

      if (error) throw error;

      console.info(`✅ Loaded ${data.length} verses for surah ${surahId}`);
      setVerses(data);
      
      // Create pages from verses
      const pages = createPages(data);
      setQuranPages(pages);
      setCurrentPageIndex(0);
      
    } catch (error) {
      console.error('Error loading verses:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل الآيات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPages = (allVerses: Verse[]): QuranPageData[] => {
    const pages: QuranPageData[] = [];
    let pageNumber = 1;
    
    for (let i = 0; i < allVerses.length; i += versesPerPage) {
      const pageVerses = allVerses.slice(i, i + versesPerPage);
      pages.push({
        pageNumber,
        verses: pageVerses,
      });
      pageNumber++;
    }
    
    return pages;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);
    
    // Only handle horizontal swipes (not vertical)
    if (Math.abs(deltaX) > 50 && deltaY < 100) {
      if (deltaX > 0) {
        // Swipe left - next page
        goToNextPage();
      } else {
        // Swipe right - previous page
        goToPreviousPage();
      }
    }
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

  const goToNextSurah = () => {
    const currentIndex = surahs.findIndex(s => s.id === selectedSurah?.id);
    if (currentIndex < surahs.length - 1) {
      handleSurahSelection(surahs[currentIndex + 1]);
    }
  };

  const goToPreviousSurah = () => {
    const currentIndex = surahs.findIndex(s => s.id === selectedSurah?.id);
    if (currentIndex > 0) {
      handleSurahSelection(surahs[currentIndex - 1]);
    }
  };

  const formatArabicNumber = (num: number): string => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumerals[parseInt(digit)]).join('');
  };

  const currentPage = quranPages[currentPageIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 dark:border-amber-400 mx-auto mb-4"></div>
          <p className="text-amber-800 dark:text-amber-200 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#fdf8ef' }}>
      {/* Header Navigation */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-amber-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={goToPreviousSurah}
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300"
            >
              <ChevronRight className="h-4 w-4 ml-1" />
              السورة السابقة
            </Button>
            
            <Select
              value={selectedSurah?.id.toString()}
              onValueChange={(value) => {
                const surah = surahs.find(s => s.id === parseInt(value));
                if (surah) handleSurahSelection(surah);
              }}
            >
              <SelectTrigger className="w-48 border-amber-300">
                <SelectValue placeholder="اختر السورة" />
              </SelectTrigger>
              <SelectContent>
                {surahs.map((surah) => (
                  <SelectItem key={surah.id} value={surah.id.toString()}>
                    <span dir="rtl">{surah.name_ar} - {surah.name_en}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={goToNextSurah}
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300"
            >
              السورة التالية
              <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowTranslation(!showTranslation)}
              variant={showTranslation ? "default" : "outline"}
              size="sm"
              className="text-amber-700 border-amber-300"
            >
              <BookOpen className="h-4 w-4 ml-1" />
              الترجمة
            </Button>
            
            <Button
              onClick={() => setShowTafsir(!showTafsir)}
              variant={showTafsir ? "default" : "outline"}
              size="sm"
              className="text-amber-700 border-amber-300"
            >
              <Settings className="h-4 w-4 ml-1" />
              التفسير
            </Button>
          </div>
        </div>
      </div>

      {/* Main Quran Page */}
      <div 
        className="flex items-center justify-center min-h-[calc(100vh-120px)] p-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {selectedSurah && currentPage ? (
          <div 
            className="w-full max-w-2xl shadow-2xl overflow-hidden relative"
            style={{
              background: '#fdf8ef',
              border: '8px solid',
              borderImage: 'linear-gradient(45deg, #d4af37, #ffd700, #d4af37) 1',
              borderRadius: '12px'
            }}
          >
            {/* Decorative Header with Traditional Pattern */}
            <div 
              className="relative p-6 border-b-4"
              style={{
                background: 'linear-gradient(135deg, #f7e98e 0%, #edd55c 50%, #f7e98e 100%)',
                borderBottomColor: '#d4af37'
              }}
            >
              {/* Traditional Islamic Pattern Border */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: '30px 30px'
                }}
              ></div>
              
              <div className="relative text-center">
                <div 
                  className="rounded-lg p-4 border-2 shadow-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderColor: '#d4af37'
                  }}
                >
                  <h2 className="text-2xl font-bold text-amber-800 font-othmani" dir="rtl">
                    سُورَةُ {selectedSurah.name_ar}
                  </h2>
                  <p className="text-sm text-amber-600 mt-1">
                    {selectedSurah.name_en} • {selectedSurah.ayah_count} آية
                  </p>
                </div>
              </div>
            </div>

            {/* Basmala with Traditional Decoration */}
            {selectedSurah.id !== 9 && currentPageIndex === 0 && (
              <div className="text-center py-8 relative">
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    background: 'radial-gradient(circle, #d4af37 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }}
                ></div>
                <div className="relative inline-block">
                  <div 
                    className="absolute inset-0 rounded-full blur-sm"
                    style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(255, 215, 0, 0.2))' }}
                  ></div>
                  <p 
                    className="text-3xl leading-relaxed font-othmani relative px-8 py-4"
                    dir="rtl"
                    style={{ color: '#8b4513' }}
                  >
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                </div>
              </div>
            )}

            {/* Verses Container with Traditional Layout */}
            <div className="p-8 min-h-[600px] flex flex-col justify-between">
              <div className="flex-1">
                <div 
                  className="text-right font-othmani leading-loose" 
                  dir="rtl" 
                  style={{ 
                    fontSize: '22px',
                    lineHeight: '2.5',
                    letterSpacing: '0.02em',
                    color: '#2d1810'
                  }}
                >
                  {currentPage.verses.map((verse, index) => (
                    <div key={`${verse.surah_no}-${verse.ayah_no_surah}`} className="mb-4 relative">
                      {/* Verse Text */}
                      <span className="inline">
                        {verse.ayah_ar}
                      </span>
                      
                      {/* Traditional Ayah Number in decorative circle */}
                      <span className="inline-block mx-3 align-middle">
                        <span 
                          className="inline-flex items-center justify-center w-8 h-8 border-2 rounded-full text-sm font-bold relative"
                          style={{ 
                            borderColor: '#d4af37',
                            background: 'radial-gradient(circle, rgba(252, 211, 77, 0.4) 0%, rgba(245, 158, 11, 0.2) 100%)',
                            color: '#8b4513'
                          }}
                        >
                          {formatArabicNumber(verse.ayah_no_surah)}
                        </span>
                      </span>
                      
                      {/* Translation (if enabled) */}
                      {showTranslation && verse.ayah_en && (
                        <div className="mt-3 text-sm text-gray-700 italic text-left" dir="ltr">
                          {verse.ayah_en}
                        </div>
                      )}
                      
                      {/* Tafsir (if enabled) */}
                      {showTafsir && (
                        <div 
                          className="mt-3 text-xs p-3 rounded-lg border" 
                          dir="rtl"
                          style={{
                            color: '#8b4513',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderColor: '#d4af37'
                          }}
                        >
                          تفسير الآية {formatArabicNumber(verse.ayah_no_surah)} من سورة {selectedSurah.name_ar}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Page Number with Traditional Style */}
              <div className="text-center mt-8 pt-4 border-t-2" style={{ borderColor: '#d4af37' }}>
                <div className="inline-flex items-center gap-4">
                  <Button
                    onClick={goToPreviousPage}
                    variant="ghost"
                    size="sm"
                    className="text-amber-600"
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <div 
                    className="px-4 py-2 rounded-lg border-2"
                    style={{
                      background: 'linear-gradient(135deg, #f7e98e, #edd55c)',
                      borderColor: '#d4af37',
                      color: '#8b4513'
                    }}
                  >
                    <span className="font-medium">
                      صفحة {formatArabicNumber(currentPageIndex + 1)} من {formatArabicNumber(quranPages.length)}
                    </span>
                  </div>
                  
                  <Button
                    onClick={goToNextPage}
                    variant="ghost"
                    size="sm"
                    className="text-amber-600"
                    disabled={currentPageIndex === quranPages.length - 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="w-full max-w-md p-8 border border-amber-200 shadow-lg rounded-lg"
            style={{ background: '#fdf8ef' }}
          >
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-amber-800 mb-2">
                مرحباً بك في المصحف الشريف
              </h3>
              <p className="text-amber-600 mb-4">
                اختر سورة لبدء القراءة
              </p>
              <Select
                onValueChange={(value) => {
                  const surah = surahs.find(s => s.id === parseInt(value));
                  if (surah) handleSurahSelection(surah);
                }}
              >
                <SelectTrigger className="border-amber-300">
                  <SelectValue placeholder="اختر السورة" />
                </SelectTrigger>
                <SelectContent>
                  {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id.toString()}>
                      <span dir="rtl">{surah.name_ar} - {surah.name_en}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div 
        className="text-center p-4 border-t border-amber-200"
        style={{ background: 'rgba(255, 255, 255, 0.6)' }}
      >
        <p className="text-sm text-amber-600">
          اسحب يميناً أو يساراً لتصفح الصفحات • انقر على الأزرار للتنقل بين السور
        </p>
      </div>
    </div>
  );
};

export default QuranPage;