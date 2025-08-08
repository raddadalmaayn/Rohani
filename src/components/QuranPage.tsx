/* QuranPage.tsx ─ polished, performant & a11y–friendly */

import React, { useState, useEffect, useRef } from 'react';
import SwipeableViews from 'react-swipeable-views';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMushafPages, formatArabicNumber } from '@/hooks/useMushafPages';
import ErrorBoundary from '@/components/ErrorBoundary';
import SkeletonPage from '@/components/SkeletonPage';

/* ---------------------------------- types --------------------------------- */

interface QuranPageProps {
  onNavigateHome?: () => void;
}

/* ------------------------------- helpers ---------------------------------- */

const enhanceArabic = (t: string) => t.split(' ').join('\u200d '); // zero-width joiner

const AyahBadge: React.FC<{ n: number; isSajdah?: boolean; mobile: boolean }> = ({
  n,
  isSajdah,
  mobile,
}) => {
  const size = mobile ? 22 : 26;
  return (
    <span className='inline-block mx-2 relative align-middle'>
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        aria-label={`آية ${formatArabicNumber(n)}${isSajdah ? ' سجدة' : ''}`}
      >
        <circle
          cx='12'
          cy='12'
          r='10'
          stroke={isSajdah ? 'hsl(var(--mushaf-sajdah))' : 'hsl(var(--mushaf-badge-stroke))'}
          strokeWidth='2'
          fill={isSajdah ? 'hsl(var(--mushaf-sajdah))' : 'hsl(var(--mushaf-badge-fill))'}
        />
        <text
          x='12'
          y='12'
          textAnchor='middle'
          dominantBaseline='middle'
          dy='.1em'
          fontSize='10'
          fill={isSajdah ? '#fff' : 'hsl(var(--mushaf-text))'}
        >
          {formatArabicNumber(n)}
        </text>
      </svg>
      {isSajdah && <span className='absolute -top-1 -right-1 w-2 h-2 bg-mushaf-sajdah rounded-full' />}
    </span>
  );
};

/* -------------------------------- component ------------------------------- */

const QuranPage: React.FC<QuranPageProps> = ({ onNavigateHome }) => {
  /* ─────────────────────────── UI state ──────────────────────────── */
  const [showTranslation, setShowTranslation] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem('qReaderShowTranslation') ?? 'false'),
  );
  const [jumpModal, setJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const isMobile = useIsMobile();
  const lastTap = useRef<number>(0);

  /* ─────────────────────── business-logic hooks ───────────────────── */
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

  /* ───────────────────────────── effects ──────────────────────────── */
  useEffect(() => localStorage.setItem('qReaderShowTranslation', JSON.stringify(showTranslation)), [
    showTranslation,
  ]);

  /* ───────────────────────── double-tap toggle ────────────────────── */
  const onMushafTap = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (now - lastTap.current < 300) setShowTranslation(p => !p);
    lastTap.current = now;
  };

  /* ────────────────────────── page jump modal ─────────────────────── */
  const doJump = () => {
    const num = parseInt(jumpInput);
    if (num >= 1 && num <= quranPages.length) {
      jumpToPage(num);
      setJumpModal(false);
      setJumpInput('');
    }
  };

  /* ───────────────────────────── render ───────────────────────────── */
  if (loading)
    return (
      <div className='min-h-screen flex items-center justify-center bg-mushaf-page'>
        <SkeletonPage />
      </div>
    );

  const page = quranPages[currentPageIndex];

  return (
    <ErrorBoundary>
      <div className='min-h-screen bg-mushaf-page relative select-none'>
        {/* edge-zones */}
        <button
          className='edge-swipe-zone edge-swipe-left'
          aria-label='الصفحة السابقة'
          onClick={goToPreviousPage}
        />
        <button
          className='edge-swipe-zone edge-swipe-right'
          aria-label='الصفحة التالية'
          onClick={goToNextPage}
        />

        {/* ───────────────────────── header ───────────────────────── */}
        <header className='bg-mushaf-header/95 backdrop-blur border-b border-mushaf-badge-stroke/30 px-4 py-3'>
          <div className='max-w-4xl mx-auto flex justify-between items-center'>
            {/* left */}
            <div className='flex items-center gap-3'>
              {onNavigateHome && (
                <Button variant='ghost' size='sm' onClick={onNavigateHome} aria-label='الرئيسية'>
                  <Home className='h-4 w-4' />
                </Button>
              )}
              <div>
                <h1 className='text-lg font-arabic text-mushaf-text' lang='ar'>
                  {selectedSurah?.name_ar ?? 'القرآن الكريم'}
                </h1>
                <span className='text-xs text-mushaf-text/70' lang='en'>
                  {selectedSurah?.name_en}
                </span>
              </div>
            </div>
            {/* right meta */}
            <div className='text-xs text-mushaf-text/70 font-arabic text-right'>
              {page?.juzNumber && <span>الجزء {formatArabicNumber(page.juzNumber)}</span>}
              {page?.verses[0]?.ruko_no && (
                <span>الركوع {formatArabicNumber(page.verses[0].ruko_no)}</span>
              )}
            </div>
          </div>
        </header>

        {/* ───────────────────── mushaf viewer ───────────────────── */}
        {selectedSurah && page ? (
          <SwipeableViews
            index={currentPageIndex}
            onChangeIndex={setCurrentPageIndex}
            resistance
            enableMouseEvents
            className='mushaf-wrapper mx-auto'
            style={{ width: 'clamp(280px,94vw,640px)' }}
          >
            {quranPages.map((p, idx) => (
              <article
                key={idx}
                className='bg-mushaf-page border border-mushaf-badge-stroke/20 rounded-lg shadow-lg min-h-[600px]'
                onClick={onMushafTap}
              >
                {/* surah header & basmala */}
                {idx === 0 && (
                  <>
                    <div className='text-center py-6 border-b border-mushaf-badge-stroke/30'>
                      <div className='inline-block border-2 border-mushaf-badge-stroke rounded-lg p-4 bg-gradient-to-r from-mushaf-badge-fill to-mushaf-page'>
                        <h2 className='font-uthmanic text-xl text-mushaf-text mb-1' dir='rtl' lang='ar'>
                          سُورَةُ {selectedSurah.name_ar}
                        </h2>
                        <p className='text-xs text-mushaf-text/70' lang='en'>
                          {selectedSurah.name_en}
                        </p>
                      </div>
                    </div>
                    {selectedSurah.id !== 9 && (
                      <p
                        className='text-center py-6 font-uthmanic text-2xl text-mushaf-text'
                        dir='rtl'
                        lang='ar'
                      >
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </p>
                    )}
                  </>
                )}

                {/* verses */}
                <div className='px-6 py-8'>
                  {showTranslation && !isMobile ? (
                    /* grid layout for large screens */
                    <div className='grid grid-cols-[64%_36%] gap-x-8'>
                      <div
                        className='font-uthmanic text-mushaf-text leading-loose'
                        dir='rtl'
                        style={{ fontSize: 'clamp(20px,4.5vw,32px)' }}
                      >
                        {p.verses.map(v => (
                          <div key={`ar-${v.surah_no}-${v.ayah_no_surah}`} className='mb-4'>
                            {enhanceArabic(v.ayah_ar)}{' '}
                            <AyahBadge n={v.ayah_no_surah} isSajdah={v.sajah_ayah} mobile={isMobile} />
                          </div>
                        ))}
                      </div>
                      <div dir='ltr' className='text-sm text-mushaf-text/70 space-y-4'>
                        {p.verses.map(
                          v =>
                            v.ayah_en && (
                              <p key={`en-${v.surah_no}-${v.ayah_no_surah}`}>
                                <span className='font-medium text-mushaf-text'>
                                  ({v.ayah_no_surah})
                                </span>{' '}
                                {v.ayah_en}
                              </p>
                            ),
                        )}
                      </div>
                    </div>
                  ) : (
                    /* stacked layout (mobile) */
                    <div
                      className='font-uthmanic text-mushaf-text leading-loose'
                      dir='rtl'
                      style={{ fontSize: 'clamp(20px,4.5vw,32px)' }}
                    >
                      {p.verses.map(v => (
                        <span key={`mk-${v.surah_no}-${v.ayah_no_surah}`} className='inline'>
                          {enhanceArabic(v.ayah_ar)}{' '}
                          <AyahBadge n={v.ayah_no_surah} isSajdah={v.sajah_ayah} mobile={isMobile} />
                          {showTranslation && v.ayah_en && (
                            <div dir='ltr' className='mt-1 mb-3 text-sm text-mushaf-text/60'>
                              {v.ayah_en}
                            </div>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </SwipeableViews>
        ) : (
          <div className='mushaf-wrapper mx-auto p-8 bg-mushaf-page border border-mushaf-badge-stroke/20 rounded-lg shadow-lg text-center'>
            <BookOpen className='w-12 h-12 text-mushaf-text/50 mx-auto mb-4' />
            <h3 className='font-arabic text-xl text-mushaf-text mb-2'>القرآن الكريم</h3>
            <p className='text-mushaf-text/70 font-arabic'>اختر سورة للبدء في القراءة</p>
          </div>
        )}

        {/* ─────────────────── bottom nav ─────────────────── */}
        <footer className='border-t border-mushaf-badge-stroke/30 bg-mushaf-header/95 px-6 py-4'>
          <div className='max-w-4xl mx-auto flex items-center justify-between'>
            <Button
              onClick={goToPreviousPage}
              variant='ghost'
              size='sm'
              disabled={currentPageIndex === 0}
              aria-label='الصفحة السابقة'
            >
              <ChevronRight className='h-4 w-4' />
            </Button>

            {/* center controls */}
            <div className='flex items-center gap-3'>
              {/* surah selector */}
              <Select
                value={selectedSurah?.id.toString()}
                onValueChange={v => {
                  const s = surahs.find(su => su.id === +v);
                  if (s) handleSurahSelection(s);
                }}
              >
                <SelectTrigger className='w-32 h-8 text-xs border-mushaf-badge-stroke bg-mushaf-page'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {surahs.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      <span className='font-arabic'>{s.name_ar}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* page counter */}
              <button
                className='text-xs font-arabic text-mushaf-text px-2 py-1 rounded hover:bg-mushaf-badge-fill/50'
                onClick={() => setJumpModal(true)}
              >
                صفحة {formatArabicNumber(currentPageIndex + 1)} من{' '}
                {formatArabicNumber(quranPages.length)}
              </button>

              {/* translation toggle */}
              <Button
                size='sm'
                variant={showTranslation ? 'default' : 'outline'}
                className='h-8 text-xs'
                onClick={() => setShowTranslation(p => !p)}
              >
                <BookOpen className='w-3 h-3 mr-1' />
                ترجمة
              </Button>
            </div>

            <Button
              onClick={goToNextPage}
              variant='ghost'
              size='sm'
              disabled={currentPageIndex === quranPages.length - 1}
              aria-label='الصفحة التالية'
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
          </div>
        </footer>

        {/* ────────────────── page-jump modal ───────────────── */}
        <Modal
          isOpen={jumpModal}
          onClose={() => setJumpModal(false)}
          title='الانتقال إلى صفحة'
        >
          <div className='space-y-4'>
            <input
              type='number'
              min={1}
              max={quranPages.length}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              className='w-full border px-3 py-2 rounded-md'
              placeholder={`1 – ${quranPages.length}`}
            />
            <div className='flex gap-2'>
              <Button className='flex-1' onClick={doJump}>
                انتقال
              </Button>
              <Button variant='outline' className='flex-1' onClick={() => setJumpModal(false)}>
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
