import React, { useState, useEffect, useRef } from 'react';
import SwipeableViews from 'react-swipeable-views';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMushafPages, formatArabicNumber } from '@/hooks/useMushafPages';
import ErrorBoundary from '@/components/ErrorBoundary';
import SkeletonPage from '@/components/SkeletonPage';

interface QuranPageProps {
  onNavigateHome?: () => void;
}

const QuranPage: React.FC<QuranPageProps> = ({ onNavigateHome }) => {
  const [showTranslation, setShowTranslation] = useState(() => {
    const saved = localStorage.getItem('qReaderShowTranslation');
    return saved ? JSON.parse(saved) : false;
  });
  const [showPageJumpModal, setShowPageJumpModal] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const lastTapTime = useRef<number>(0);
  const {
    surahs,
    selectedSurah,
    currentPageIndex,
    quranPages,
    loading,
    handleSurahSelection,
    goToNextPage,
    goToPreviousPage,
    jumpToPage,
    setCurrentPageIndex,
  } = useMushafPages(isMobile);

  // Handle double-tap for translation toggle (mobile only)
  const handlePageDoubleTap = () => {
    if (isMobile) {
      const now = Date.now();
      const timeDiff = now - lastTapTime.current;
      
      if (timeDiff < 300) {
        // Double tap detected
        setShowTranslation(!showTranslation);
      }
      
      lastTapTime.current = now;
    }
  };

  // Handle page counter interactions
  const handlePageCounterClick = () => {
    setShowPageJumpModal(true);
  };

  const handleJumpToPage = () => {
    const pageNumber = parseInt(jumpPageInput);
    if (pageNumber && pageNumber >= 1 && pageNumber <= quranPages.length) {
      jumpToPage(pageNumber);
      setShowPageJumpModal(false);
      setJumpPageInput('');
    }
  };

  // Edge swipe zone handlers
  const handleLeftEdgeClick = () => {
    goToPreviousPage();
  };

  const handleRightEdgeClick = () => {
    goToNextPage();
  };

  // Allow normal page interaction
  useEffect(() => {
    // Don't prevent scrolling/navigation
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Persist translation preference
  useEffect(() => {
    localStorage.setItem('qReaderShowTranslation', JSON.stringify(showTranslation));
  }, [showTranslation]);

  // Add zero-width joiner after words for better Arabic rendering
  const enhanceArabicText = (text: string): string => {
    return text.split(' ').join('\u200D ');
  };

  // SVG Ayah Badge Component with improved alignment
  const AyahBadge: React.FC<{ number: number; isSajdah?: boolean }> = ({ number, isSajdah }) => {
    const badgeSize = isMobile ? 22 : 26;
    
    return (
      <span className="inline-block mx-2 align-middle relative">
        <svg
          width={badgeSize}
          height={badgeSize}
          viewBox="0 0 24 24"
          className="ayah-badge"
          aria-label={`آية ${formatArabicNumber(number)}${isSajdah ? ' سجدة' : ''}`}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke={isSajdah ? 'hsl(var(--mushaf-sajdah))' : 'hsl(var(--mushaf-badge-stroke))'}
            strokeWidth="2"
            fill={isSajdah ? 'hsl(var(--mushaf-sajdah))' : 'hsl(var(--mushaf-badge-fill))'}
          />
          <text
            x="12"
            y="12"
            textAnchor="middle"
            dominantBaseline="middle"
            dy=".1em"
            fontSize="10"
            fill={isSajdah ? 'white' : 'hsl(var(--mushaf-text))'}
            fontFamily="Arial"
          >
            {formatArabicNumber(number)}
          </text>
        </svg>
        {isSajdah && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-mushaf-sajdah rounded-full"></span>
        )}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mushaf-page flex items-center justify-center p-4">
        <SkeletonPage />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-mushaf-page relative">
        {/* Edge swipe zones with accessibility */}
        <button 
          className="edge-swipe-zone edge-swipe-left focus:outline-none" 
          onClick={handleLeftEdgeClick}
          aria-label="الصفحة السابقة"
          tabIndex={0}
        />
        <button 
          className="edge-swipe-zone edge-swipe-right focus:outline-none" 
          onClick={handleRightEdgeClick}
          aria-label="الصفحة التالية"
          tabIndex={0}
        />
        {/* Header with Surah name and Part number */}
        <div className="bg-mushaf-header/95 backdrop-blur-sm border-b border-mushaf-badge-stroke/30 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {/* Left side - Surah name */}
            <div className="flex items-center gap-3">
              {onNavigateHome && (
                <Button
                  onClick={onNavigateHome}
                  variant="ghost"
                  size="sm"
                  className="text-mushaf-text hover:bg-mushaf-badge-fill/50"
                  aria-label="العودة للرئيسية"
                >
                  <Home className="h-4 w-4" />
                </Button>
              )}
              <div className="flex flex-col items-start">
                <h1 className="text-lg font-medium text-mushaf-text font-arabic" lang="ar">
                  {selectedSurah?.name_ar || 'القرآن الكريم'}
                </h1>
                <span className="text-xs text-mushaf-text/70" lang="en">{selectedSurah?.name_en}</span>
              </div>
            </div>

            {/* Right side - Part and other info */}
            <div className="text-right">
              <div className="flex flex-col items-end text-xs text-mushaf-text/70 font-arabic" lang="ar">
                {quranPages[currentPageIndex]?.juzNumber && <span>الجزء {formatArabicNumber(quranPages[currentPageIndex].juzNumber)}</span>}
                {quranPages[currentPageIndex]?.verses[0]?.ruko_no && <span>الركوع {formatArabicNumber(quranPages[currentPageIndex].verses[0].ruko_no)}</span>}
                {quranPages[currentPageIndex]?.verses[0]?.manzil_no && <span>المنزل {formatArabicNumber(quranPages[currentPageIndex].verses[0].manzil_no)}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Main Quran Page */}
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          {selectedSurah && quranPages[currentPageIndex] ? (
            <SwipeableViews
              index={currentPageIndex}
              onChangeIndex={setCurrentPageIndex}
              enableMouseEvents
              resistance
              className="mushaf-wrapper"
            >
              {quranPages.map((page, pageIndex) => (
                <div 
                  key={pageIndex}
                  className="bg-mushaf-page rounded-lg shadow-lg border border-mushaf-badge-stroke/20 overflow-hidden min-h-[600px]"
                  onClick={handlePageDoubleTap}
                >
                  {/* Decorative Surah Header */}
                  {pageIndex === 0 && (
                    <div className="text-center py-6 px-4 border-b border-mushaf-badge-stroke/30">
                      <div className="inline-block border-2 border-mushaf-badge-stroke rounded-lg p-4 bg-gradient-to-r from-mushaf-badge-fill to-mushaf-page">
                         <div 
                           className="text-xl font-bold text-mushaf-text font-uthmanic mb-1"
                           dir="rtl"
                           lang="ar"
                         >
                           سُورَةُ {selectedSurah.name_ar}
                         </div>
                        <div className="text-xs text-mushaf-text/70 font-arabic" lang="en">
                          {selectedSurah.name_en}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basmala (if not Surah At-Tawbah and first page) */}
                  {selectedSurah.id !== 9 && pageIndex === 0 && (
                    <div className="text-center py-6">
                       <div 
                         className="text-2xl font-bold text-mushaf-text font-uthmanic leading-relaxed"
                         dir="rtl"
                         lang="ar"
                       >
                         بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                       </div>
                    </div>
                  )}

                  {/* Verses Container */}
                  <div className="px-6 py-8 min-h-[500px]">
                    {showTranslation && !isMobile ? (
                      // Large screen: side-by-side layout
                      <div className="translation-grid">
                         <div 
                           className="mushafText text-right font-uthmanic text-mushaf-text"
                           dir="rtl"
                           lang="ar"
                         >
                          {page.verses.map((verse) => (
                            <div key={`ar-${verse.surah_no}-${verse.ayah_no_surah}`} className="mb-4">
                              <span className="inline">{enhanceArabicText(verse.ayah_ar)}</span>
                              <AyahBadge number={verse.ayah_no_surah} isSajdah={verse.sajah_ayah} />
                            </div>
                          ))}
                        </div>
                        <div className="text-left" dir="ltr" lang="en">
                          {page.verses.map((verse) => (
                            verse.ayah_en && (
                              <div key={`en-${verse.surah_no}-${verse.ayah_no_surah}`} className="text-sm text-mushaf-text/70 mb-4">
                                <span className="font-medium text-mushaf-text">({verse.ayah_no_surah})</span> {verse.ayah_en}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Mobile or translation off: stacked layout
                       <div 
                         className="mushafText text-right font-uthmanic text-mushaf-text"
                         dir="rtl"
                         lang="ar"
                       >
                        {page.verses.map((verse) => (
                          <div key={`${verse.surah_no}-${verse.ayah_no_surah}`} className="inline">
                            {/* Verse Text with enhanced Arabic rendering */}
                            <span className="inline">{enhanceArabicText(verse.ayah_ar)}</span>
                            
                            {/* Ayah Badge */}
                            <AyahBadge number={verse.ayah_no_surah} isSajdah={verse.sajah_ayah} />
                            
                            {/* Translation inline beneath each ayah (mobile) */}
                            {showTranslation && verse.ayah_en && (
                              <div className="translation text-mushaf-text/60 text-sm mt-1 mb-3" dir="ltr" lang="en">
                                {verse.ayah_en}
                              </div>
                            )}
                            
                            {/* Space between verses */}
                            <span className="inline-block w-1"></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </SwipeableViews>

          ) : (
            <div className="mushaf-wrapper mx-auto p-8 bg-mushaf-page border border-mushaf-badge-stroke/20 shadow-lg rounded-lg">
              <div className="text-center">
                <BookOpen className="h-12 w-12 text-mushaf-text/50 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-mushaf-text mb-2 font-arabic" lang="ar">
                  القرآن الكريم
                </h3>
                <p className="text-mushaf-text/70 font-arabic" lang="ar">
                  اختر سورة للبدء في القراءة
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="px-6 py-4 bg-mushaf-header/95 border-t border-mushaf-badge-stroke/30">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Previous Page */}
            <Button
              onClick={goToPreviousPage}
              variant="ghost"
              size="sm"
              className="text-mushaf-text hover:bg-mushaf-badge-fill/50"
              disabled={currentPageIndex === 0}
              aria-label="الصفحة السابقة"
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
                <SelectTrigger className="w-32 h-8 text-xs border-mushaf-badge-stroke bg-mushaf-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {surahs.map((surah) => (
                    <SelectItem key={surah.id} value={surah.id.toString()}>
                      <span className="font-arabic" lang="ar">{surah.name_ar}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Page counter with click */}
              <div 
                className="text-xs text-mushaf-text font-arabic cursor-pointer px-2 py-1 rounded hover:bg-mushaf-badge-fill/50"
                onClick={handlePageCounterClick}
                lang="ar"
              >
                صفحة {formatArabicNumber(currentPageIndex + 1)} من {formatArabicNumber(quranPages.length)}
              </div>
              
              <Button
                onClick={() => setShowTranslation(!showTranslation)}
                variant={showTranslation ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                ترجمة
              </Button>
            </div>
            
            {/* Next Page */}
            <Button
              onClick={goToNextPage}
              variant="ghost"
              size="sm"
              className="text-mushaf-text hover:bg-mushaf-badge-fill/50"
              disabled={currentPageIndex === quranPages.length - 1}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page Jump Modal */}
        <Modal
          isOpen={showPageJumpModal}
          onClose={() => setShowPageJumpModal(false)}
          title="الانتقال إلى صفحة"
        >
          <div className="space-y-4">
            <input
              type="number"
              min="1"
              max={quranPages.length}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder={`1 - ${quranPages.length}`}
            />
            <div className="flex gap-2">
              <Button onClick={handleJumpToPage} className="flex-1">
                انتقال
              </Button>
              <Button 
                onClick={() => setShowPageJumpModal(false)} 
                variant="outline" 
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
};

export default QuranPage;