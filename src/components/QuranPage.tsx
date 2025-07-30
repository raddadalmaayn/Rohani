import React, { useState } from 'react';
import { AyahBadge } from './AyahBadge';
import { cn } from '@/lib/utils';

interface Verse {
  surah_no: number;
  ayah_no_surah: number;
  ayah_ar: string;
  ayah_en: string;
  surah_name_ar: string;
  surah_name_en: string;
  surah_name_roman: string;
}

interface QuranPageData {
  pageNumber: number;
  verses: Verse[];
  surahInfo?: {
    name_ar: string;
    name_en: string;
    name_roman: string;
    isNewSurah: boolean;
  };
}

interface QuranPageProps {
  page: QuranPageData;
  fontScale: number;
  theme: 'light' | 'dark';
  onAyahTap?: (verse: Verse) => void;
}

export const QuranPage: React.FC<QuranPageProps> = ({
  page,
  fontScale,
  theme,
  onAyahTap
}) => {
  const [highlightedAyah, setHighlightedAyah] = useState<number | null>(null);

  const handleAyahLongPress = (verse: Verse) => {
    setHighlightedAyah(verse.ayah_no_surah);
    setTimeout(() => setHighlightedAyah(null), 2000);
  };

  const formatAyahText = (verse: Verse) => {
    return verse.ayah_ar;
  };

  const shouldShowBismillah = () => {
    return page.surahInfo?.isNewSurah && page.verses[0]?.surah_no !== 1 && page.verses[0]?.surah_no !== 9;
  };

  const baseFontSize = () => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth;
      if (screenWidth <= 320) return 24; // Small phones
      if (screenWidth <= 480) return 26; // Regular phones
      return 32; // Tablets and larger
    }
    return 26;
  };

  return (
    <div className={cn(
      "w-[92%] mx-auto h-screen flex flex-col relative",
      theme === 'light' ? 'bg-[#FFFDF8]' : 'bg-[#1C1B16]'
    )}>
      {/* Gold vertical bar on left edge */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: theme === 'light' ? '#D4B14D' : '#C7A240' }}
      />

      {/* Content area with padding from left bar */}
      <div className="flex-1 pl-6 pr-4 py-6 overflow-y-auto">
        {/* Surah Header Banner */}
        {page.surahInfo?.isNewSurah && (
          <div className="mb-8">
            {/* Decorative banner */}
            <div 
              className={cn(
                "text-center py-6 px-4 rounded-lg mb-4",
                theme === 'light' 
                  ? 'bg-gradient-to-b from-[#F9F5E5] to-white' 
                  : 'bg-gradient-to-b from-[#3A3220] to-[#2A2418]'
              )}
            >
              <h2 
                className={cn(
                  "font-quran text-2xl mb-2",
                  theme === 'light' ? 'text-[#2F2F2F]' : 'text-[#F5F5F5]'
                )}
              >
                {page.surahInfo.name_ar}
              </h2>
              <p 
                className={cn(
                  "font-playfair text-sm uppercase tracking-wider",
                  theme === 'light' ? 'text-[#2F2F2F]/70' : 'text-[#F5F5F5]/70'
                )}
              >
                {page.surahInfo.name_roman}
              </p>
            </div>

            {/* Bismillah */}
            {shouldShowBismillah() && (
              <div className="text-center mb-6">
                <div 
                  className={cn(
                    "inline-block px-8 py-4 rounded-full",
                    theme === 'light' 
                      ? 'bg-[#F6E9BE] shadow-lg' 
                      : 'bg-[#3A3220] shadow-xl'
                  )}
                  style={{
                    boxShadow: theme === 'light' 
                      ? '0 4px 20px rgba(212, 177, 77, 0.3)' 
                      : '0 4px 20px rgba(199, 162, 64, 0.3)'
                  }}
                >
                  <p 
                    className={cn(
                      "font-quran",
                      theme === 'light' ? 'text-[#2F2F2F]' : 'text-[#F5F5F5]'
                    )}
                    style={{ fontSize: `${28 * fontScale}px` }}
                  >
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Verses */}
        <div className="space-y-1">
          {page.verses.map((verse, index) => (
            <div key={`${verse.surah_no}-${verse.ayah_no_surah}`} className="relative">
              <p
                className={cn(
                  "font-quran leading-relaxed text-right transition-all duration-200",
                  "cursor-pointer select-text",
                  highlightedAyah === verse.ayah_no_surah && "bg-[#FFF9E0] rounded-md px-2 py-1",
                  theme === 'light' ? 'text-[#2F2F2F]' : 'text-[#F5F5F5]'
                )}
                style={{ 
                  fontSize: `${baseFontSize() * fontScale}px`,
                  lineHeight: 1.6,
                  textAlign: 'justify',
                  textJustify: 'inter-word'
                }}
                onClick={() => onAyahTap?.(verse)}
                onTouchStart={() => handleAyahLongPress(verse)}
                dir="rtl"
              >
                {formatAyahText(verse)}
                {' '}
                <span className="inline-flex items-center align-middle mx-1">
                  <AyahBadge 
                    number={verse.ayah_no_surah} 
                    theme={theme}
                    onClick={() => onAyahTap?.(verse)}
                  />
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* Page number at bottom */}
        <div className="mt-8 text-center">
          <p 
            className={cn(
              "font-playfair text-sm",
              theme === 'light' ? 'text-[#2F2F2F]/50' : 'text-[#F5F5F5]/50'
            )}
          >
            {page.pageNumber}
          </p>
        </div>
      </div>
    </div>
  );
};