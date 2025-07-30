import React, { useState, useEffect, useCallback } from 'react';
import { useQuranPaging } from '@/hooks/useQuranPaging';
import { QuranPage } from './QuranPage';
import { cn } from '@/lib/utils';
import { ReaderToolbar } from './ReaderToolbar';
import { SettingsModal } from './SettingsModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/hooks/use-language';
import { supabase } from '@/integrations/supabase/client';

interface QuranReaderProps {
  onNavigateHome?: () => void;
}

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
  ayah_count: number;
}

export const QuranReader: React.FC<QuranReaderProps> = ({ onNavigateHome }) => {
  const {
    currentPage,
    fetchPage,
    goToPage,
    nextPage,
    previousPage,
    jumpToSurah,
    fontScale,
    theme,
    setFontScale,
    setTheme,
    loading
  } = useQuranPaging();

  const { t, language } = useLanguage();
  const [currentPageData, setCurrentPageData] = useState<any>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [surahListOpen, setSurahListOpen] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [toolbarTimeout, setToolbarTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load current page data
  useEffect(() => {
    const loadPage = async () => {
      try {
        const page = await fetchPage(currentPage);
        setCurrentPageData(page);
      } catch (error) {
        console.error('Error loading page:', error);
      }
    };
    loadPage();
  }, [currentPage, fetchPage]);

  // Load surahs for navigation
  useEffect(() => {
    const loadSurahs = async () => {
      try {
        const { data, error } = await supabase
          .from('surahs')
          .select('id, name_ar, name_en, ayah_count')
          .order('id');
        
        if (error) throw error;
        setSurahs(data || []);
      } catch (error) {
        console.error('Error loading surahs:', error);
      }
    };
    loadSurahs();
  }, []);

  // Handle swipe gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Store initial touch position for swipe detection
    (e.currentTarget as any).startX = touch.clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const startX = (e.currentTarget as any).startX;
    const deltaX = touch.clientX - startX;
    
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        previousPage(); // Swipe right = previous
      } else {
        nextPage(); // Swipe left = next
      }
    }
  }, [nextPage, previousPage]);

  // Handle single tap to show/hide toolbar
  const handleSingleTap = useCallback(() => {
    setToolbarVisible(true);
    
    if (toolbarTimeout) {
      clearTimeout(toolbarTimeout);
    }
    
    const timeout = setTimeout(() => {
      setToolbarVisible(false);
    }, 3000);
    
    setToolbarTimeout(timeout);
  }, [toolbarTimeout]);

  // Handle double tap for page picker
  const handleDoubleTap = useCallback(() => {
    setPagePickerOpen(true);
  }, []);

  const handlePageJump = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= 604) {
      goToPage(pageNum);
      setPagePickerOpen(false);
      setPageInput('');
    }
  };

  const handleSurahSelect = (surahId: number) => {
    jumpToSurah(surahId);
    setSurahListOpen(false);
  };

  if (loading && !currentPageData) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FFFDF8]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4B14D] mx-auto mb-4"></div>
          <p className="font-arabic text-[#2F2F2F]">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-full overflow-hidden ${theme === 'light' ? 'bg-[#FBFAF7]' : 'bg-[#1A1A1A]'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleSingleTap}
      onDoubleClick={handleDoubleTap}
    >
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-transparent">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSurahListOpen(true)}
          className={cn(
            "rounded-full p-2",
            theme === 'light' 
              ? 'text-[#2F2F2F] hover:bg-white/20' 
              : 'text-[#F5F5F5] hover:bg-black/20'
          )}
        >
          <List className="w-5 h-5" />
        </Button>

        {onNavigateHome && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateHome}
            className={cn(
              "rounded-full p-2",
              theme === 'light' 
                ? 'text-[#2F2F2F] hover:bg-white/20' 
                : 'text-[#F5F5F5] hover:bg-black/20'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Main Content */}
      {currentPageData && (
        <QuranPage 
          page={currentPageData}
          fontScale={fontScale}
          theme={theme}
        />
      )}

      {/* Toolbar */}
      <ReaderToolbar
        currentPage={currentPage}
        onPreviousPage={previousPage}
        onNextPage={nextPage}
        onPageSelect={() => setPagePickerOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        theme={theme}
        visible={toolbarVisible}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Page Picker Modal */}
      <Dialog open={pagePickerOpen} onOpenChange={setPagePickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={language === 'ar' ? 'font-arabic text-right' : ''}>
              {t('reader.goToPage')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="page-input" className={language === 'ar' ? 'font-arabic' : ''}>
                {t('reader.pageNumber')} (1-604)
              </Label>
              <Input
                id="page-input"
                type="number"
                min="1"
                max="604"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePageJump()}
                className="text-center"
              />
            </div>
            <Button onClick={handlePageJump} className="w-full">
              {t('reader.go')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Surah List Modal */}
      <Dialog open={surahListOpen} onOpenChange={setSurahListOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className={language === 'ar' ? 'font-arabic text-right' : ''}>
              {t('reader.surahList')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 p-2">
              {surahs.map((surah) => (
                <Button
                  key={surah.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-between text-left p-3 h-auto",
                    language === 'ar' ? 'text-right' : ''
                  )}
                  onClick={() => handleSurahSelect(surah.id)}
                >
                  <div className={`flex flex-col ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                    <span className={`font-medium ${language === 'ar' ? 'font-arabic' : ''}`}>
                      {language === 'ar' ? surah.name_ar : surah.name_en}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {surah.ayah_count} {t('reader.verses')}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {surah.id}
                  </span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};