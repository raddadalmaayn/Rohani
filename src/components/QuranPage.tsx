import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Settings, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

interface QuranPageProps {
  onNavigateHome?: () => void;
}

const QuranPage: React.FC<QuranPageProps> = ({ onNavigateHome }) => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [quranPages, setQuranPages] = useState<QuranPageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
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
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en, juz_no, ruko_no, manzil_no, hizb_quarter, sajah_ayah, sajdah_no, surah_name_ar, surah_name_en')
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
      const juzNumber = pageVerses[0]?.juz_no;
      pages.push({
        pageNumber,
        verses: pageVerses,
        juzNumber,
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
      <div className="min-h-screen bg-[#f8f6f0] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800 font-medium font-arabic">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0]">
      {/* Header with Surah name and Part number */}
      <div className="bg-[#f5f3ed]/95 backdrop-blur-sm border-b border-amber-200/30 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left side - Surah name */}
          <div className="flex items-center gap-3">
            {onNavigateHome && (
              <Button
                onClick={onNavigateHome}
                variant="ghost"
                size="sm"
                className="text-amber-700 hover:bg-amber-50"
              >
                <Home className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col items-start">
              <h1 className="text-lg font-medium text-amber-800 font-arabic">
                {selectedSurah?.name_ar || 'القرآن الكريم'}
              </h1>
              <span className="text-xs text-amber-600">{selectedSurah?.name_en}</span>
            </div>
          </div>

          {/* Right side - Part and other info */}
          <div className="text-right">
            <div className="flex flex-col items-end text-xs text-amber-600 font-arabic">
              {currentPage?.juzNumber && <span>الجزء {formatArabicNumber(currentPage.juzNumber)}</span>}
              {currentPage?.verses[0]?.ruko_no && <span>الركوع {formatArabicNumber(currentPage.verses[0].ruko_no)}</span>}
              {currentPage?.verses[0]?.manzil_no && <span>المنزل {formatArabicNumber(currentPage.verses[0].manzil_no)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Quran Page */}
      <div 
        className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {selectedSurah && currentPage ? (
          <div className="w-full max-w-md mx-auto bg-[#fefcf7] rounded-lg shadow-lg border border-amber-100/50 overflow-hidden"
               style={{ backgroundColor: '#fefcf7', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
            
            {/* Decorative Surah Header */}
            {currentPageIndex === 0 && (
              <div className="text-center py-6 px-4 border-b border-amber-200/50">
                {/* Ornamental border */}
                <div className="inline-block border-2 border-amber-300 rounded-lg p-4 bg-gradient-to-r from-amber-50 to-yellow-50">
                  <div 
                    className="text-xl font-bold text-amber-800 font-quran mb-1"
                    dir="rtl"
                    style={{
                      background: 'linear-gradient(135deg, #d4af37, #b8860b)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    سُورَةُ {selectedSurah.name_ar}
                  </div>
                  <div className="text-xs text-amber-600 font-arabic">
                    {selectedSurah.name_en}
                  </div>
                </div>
              </div>
            )}

            {/* Basmala (if not Surah At-Tawbah and first page) */}
            {selectedSurah.id !== 9 && currentPageIndex === 0 && (
              <div className="text-center py-6">
                <div 
                  className="text-2xl font-bold text-amber-800 font-quran leading-relaxed"
                  dir="rtl"
                  style={{
                    background: 'linear-gradient(135deg, #d4af37, #b8860b)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
              </div>
            )}

            {/* Verses Container */}
            <div className="px-6 py-8 min-h-[500px]">
              <div 
                className="text-right font-quran leading-loose text-justify"
                dir="rtl"
                style={{ 
                  fontSize: '20px',
                  lineHeight: '2.2',
                  letterSpacing: '0.02em',
                  color: '#2c1810',
                  textAlignLast: 'justify'
                }}
              >
                {currentPage.verses.map((verse, index) => (
                  <span key={`${verse.surah_no}-${verse.ayah_no_surah}`} className="inline">
                    {/* Verse Text */}
                    <span className="inline">{verse.ayah_ar}</span>
                    
                    {/* Ayah Number with Sajdah indicator */}
                    <span className="inline-block mx-2 align-middle relative">
                      <span 
                        className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold relative ${
                          verse.sajah_ayah ? 'animate-pulse' : ''
                        }`}
                        style={{ 
                          background: verse.sajah_ayah 
                            ? 'radial-gradient(circle, #10b981 0%, #059669 100%)' 
                            : 'radial-gradient(circle, #f7e98e 0%, #edd55c 100%)',
                          border: verse.sajah_ayah ? '2px solid #047857' : '2px solid #d4af37',
                          borderRadius: '50%',
                          color: verse.sajah_ayah ? 'white' : '#8b4513',
                          fontSize: '10px'
                        }}
                        title={verse.sajah_ayah ? 'آية سجدة' : undefined}
                      >
                        {formatArabicNumber(verse.ayah_no_surah)}
                      </span>
                      {/* Sajdah indicator */}
                      {verse.sajah_ayah && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                      )}
                    </span>
                    
                    {/* Space between verses */}
                    <span className="inline-block w-1"></span>
                  </span>
                ))}
              </div>

              {/* Translation Section */}
              {showTranslation && (
                <div className="mt-8 pt-6 border-t border-amber-200/50">
                  <h4 className="text-sm font-semibold text-amber-800 mb-4 font-arabic" dir="rtl">
                    الترجمة الإنجليزية:
                  </h4>
                  <div className="space-y-3">
                    {currentPage.verses.map((verse, index) => (
                      verse.ayah_en && (
                        <div key={`translation-${verse.surah_no}-${verse.ayah_no_surah}`} className="text-sm text-gray-700 text-left" dir="ltr">
                          <span className="font-medium text-amber-700">({verse.ayah_no_surah})</span> {verse.ayah_en}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#f5f3ed] to-[#f8f6f0] border-t border-amber-200/30">
              <div className="flex items-center justify-between">
                {/* Previous Page */}
                <Button
                  onClick={goToPreviousPage}
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:bg-amber-100"
                  disabled={currentPageIndex === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                {/* Page Counter */}
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedSurah?.id.toString()}
                    onValueChange={(value) => {
                      const surah = surahs.find(s => s.id === parseInt(value));
                      if (surah) handleSurahSelection(surah);
                    }}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs border-amber-300 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {surahs.map((surah) => (
                        <SelectItem key={surah.id} value={surah.id.toString()}>
                          <span className="font-arabic">{surah.name_ar}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    onClick={() => setShowTranslation(!showTranslation)}
                    variant={showTranslation ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    Translation
                  </Button>
                </div>
                
                {/* Next Page */}
                <Button
                  onClick={goToNextPage}
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:bg-amber-100"
                  disabled={currentPageIndex === quranPages.length - 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Page Info */}
              <div className="text-center mt-3">
                <span className="text-xs text-amber-600 font-arabic">
                  صفحة {formatArabicNumber(currentPageIndex + 1)} من {formatArabicNumber(quranPages.length)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md p-8 bg-[#fefcf7] border border-amber-200/50 shadow-lg rounded-lg">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-amber-800 mb-2 font-arabic">
                القرآن الكريم
              </h3>
              <p className="text-amber-600 font-arabic">
                اختر سورة للبدء في القراءة
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuranPage;