// src/components/QuranPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import SwipeableViews from 'react-swipeable-views';
import { getPageUrl, surahStartPage } from '@/lib/mushafPages';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Home } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import ErrorBoundary from '@/components/ErrorBoundary';
import SkeletonPage from '@/components/SkeletonPage';
import { formatArabicNumber } from '@/hooks/useMushafPages';

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
}

interface QuranPageProps {
  surahs: Surah[];
  onNavigateHome?: () => void;
}

const TOTAL_PAGES = 604;

export default function QuranPage({ surahs, onNavigateHome }: QuranPageProps) {
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [pageIndex, setPageIndex] = useState<number>(surahStartPage(1) - 1);
  const [showTranslation, setShowTranslation] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem('qReaderShowTranslation') || 'false')
  );
  const [jumpModal, setJumpModal] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const isMobile = useIsMobile();
  const lastTap = useRef<number>(0);
  const { toast } = useToast();

  // persist translation
  useEffect(() => {
    localStorage.setItem('qReaderShowTranslation', JSON.stringify(showTranslation));
  }, [showTranslation]);

  // when surah changes, jump to its first page
  useEffect(() => {
    const start = surahStartPage(selectedSurahId) - 1;
    setPageIndex(start);
  }, [selectedSurahId]);

  const goPrev = () => setPageIndex(i => Math.max(0, i - 1));
  const goNext = () => setPageIndex(i => Math.min(TOTAL_PAGES - 1, i + 1));

  const doJump = () => {
    const n = parseInt(jumpInput);
    if (n >= 1 && n <= TOTAL_PAGES) {
      setPageIndex(n - 1);
      setJumpModal(false);
      setJumpInput('');
    } else {
      toast({ title: 'خطأ', description: 'رقم الصفحة غير صالح', variant: 'destructive' });
    }
  };

  // double-tap to toggle translation overlay (mobile)
  const onMushafTap = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (now - lastTap.current < 300) setShowTranslation(v => !v);
    lastTap.current = now;
  };

  if (!surahs.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading surahs…</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-mushaf-page relative select-none">
        {/* Edge swipe zones */}
        <button
          className="edge-swipe-zone edge-swipe-left"
          aria-label="الصفحة السابقة"
          onClick={goPrev}
        />
        <button
          className="edge-swipe-zone edge-swipe-right"
          aria-label="الصفحة التالية"
          onClick={goNext}
        />

        {/* Header */}
        <header className="bg-mushaf-header/95 backdrop-blur-sm border-b border-mushaf-badge-stroke/30 px-4 py-3">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              {onNavigateHome && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNavigateHome}
                  aria-label="الرئيسية"
                >
                  <Home className="h-4 w-4" />
                </Button>
              )}
              <div>
                <h1 className="text-lg font-arabic text-mushaf-text" lang="ar">
                  {surahs.find(s => s.id === selectedSurahId)?.name_ar ||
                    'القرآن الكريم'}
                </h1>
                <span className="text-xs text-mushaf-text/70" lang="en">
                  {surahs.find(s => s.id === selectedSurahId)?.name_en}
                </span>
              </div>
            </div>
            <div className="text-xs text-mushaf-text/70 font-arabic text-right">
              <span>
                الصفحة {formatArabicNumber(pageIndex + 1)} من{' '}
                {formatArabicNumber(TOTAL_PAGES)}
              </span>
            </div>
          </div>
        </header>

        {/* Swipeable mushaf pages */}
        <SwipeableViews
          index={pageIndex}
          onChangeIndex={setPageIndex}
          enableMouseEvents
          resistance
          className="mushaf-wrapper mx-auto"
          style={{ width: 'clamp(280px,94vw,640px)' }}
        >
          {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              className="bg-mushaf-page border border-mushaf-badge-stroke/20 rounded-lg shadow-lg min-h-[600px] flex justify-center items-center"
              onClick={onMushafTap}
            >
              <img
                src={getPageUrl(pageNum)}
                alt={`صفحة ${formatArabicNumber(pageNum)}`}
                loading="lazy"
                className="w-full h-auto"
              />
              {showTranslation && !isMobile && (
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center text-white text-lg p-4">
                  {/* You could overlay verse translations here */}
                  ترجمة الصفحة غير متوفرة حالياً
                </div>
              )}
            </div>
          ))}
        </SwipeableViews>

        {/* Footer nav */}
        <footer className="border-t border-mushaf-badge-stroke/30 bg-mushaf-header/95 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              onClick={goPrev}
              variant="ghost"
              size="sm"
              disabled={pageIndex === 0}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-3">
              {/* Surah picker */}
              <Select
                value={String(selectedSurahId)}
                onValueChange={v => setSelectedSurahId(Number(v))}
              >
                <SelectTrigger className="w-32 h-8 text-xs border-mushaf-badge-stroke bg-mushaf-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {surahs.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <span className="font-arabic">{s.name_ar}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Jump button */}
              <button
                className="text-xs font-arabic text-mushaf-text px-2 py-1 rounded hover:bg-mushaf-badge-fill/50"
                onClick={() => setJumpModal(true)}
              >
                اذهب إلى صفحة
              </button>

              {/* Translation toggle */}
              <Button
                size="sm"
                variant={showTranslation ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setShowTranslation(v => !v)}
              >
                <BookOpen className="w-3 h-3 mr-1" />
                ترجمة
              </Button>
            </div>

            <Button
              onClick={goNext}
              variant="ghost"
              size="sm"
              disabled={pageIndex === TOTAL_PAGES - 1}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </footer>

        {/* Page Jump Modal */}
        <Modal
          isOpen={jumpModal}
          onClose={() => setJumpModal(false)}
          title="الانتقال إلى صفحة"
        >
          <div className="space-y-4">
            <input
              type="number"
              min={1}
              max={TOTAL_PAGES}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              className="w-full border px-3 py-2 rounded-md"
              placeholder={`1 – ${TOTAL_PAGES}`}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={doJump}>
                انتقال
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setJumpModal(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}
