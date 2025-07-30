import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Settings, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReaderToolbarProps {
  currentPage: number;
  totalPages?: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageSelect: () => void;
  onSettings: () => void;
  theme?: 'light' | 'dark';
  visible: boolean;
  className?: string;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  currentPage,
  totalPages = 604,
  onPreviousPage,
  onNextPage,
  onPageSelect,
  onSettings,
  theme = 'light',
  visible,
  className
}) => {
  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 transform -translate-x-1/2 transition-all duration-300",
      "flex items-center gap-3 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm",
      theme === 'light' 
        ? "bg-white/90 border border-[#E9D89F]/30" 
        : "bg-[#1C1B16]/90 border border-[#3A3220]/30",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none",
      className
    )}>
      {/* Previous Surah */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onPreviousPage}
        disabled={currentPage <= 1}
        className={cn(
          "p-2 rounded-full",
          theme === 'light' 
            ? "text-[#2F2F2F] hover:bg-[#F9F5E5]" 
            : "text-[#F5F5F5] hover:bg-[#3A3220]"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="sr-only">صفحة سابقة</span>
      </Button>

      {/* Page Counter */}
      <button
        onClick={onPageSelect}
        className={cn(
          "px-3 py-1 rounded-lg font-medium transition-colors",
          "font-playfair text-sm",
          theme === 'light' 
            ? "text-[#2F2F2F] hover:bg-[#F9F5E5]" 
            : "text-[#F5F5F5] hover:bg-[#3A3220]"
        )}
      >
        {currentPage}/{totalPages}
      </button>

      {/* Next Surah */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        className={cn(
          "p-2 rounded-full",
          theme === 'light' 
            ? "text-[#2F2F2F] hover:bg-[#F9F5E5]" 
            : "text-[#F5F5F5] hover:bg-[#3A3220]"
        )}
      >
        <ChevronRight className="w-4 h-4" />
        <span className="sr-only">صفحة تالية</span>
      </Button>

      {/* Settings */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSettings}
        className={cn(
          "p-2 rounded-full",
          theme === 'light' 
            ? "text-[#2F2F2F] hover:bg-[#F9F5E5]" 
            : "text-[#F5F5F5] hover:bg-[#3A3220]"
        )}
      >
        <Settings className="w-4 h-4" />
        <span className="sr-only">إعدادات</span>
      </Button>

      {/* Audio placeholder */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "p-2 rounded-full opacity-50 cursor-not-allowed",
          theme === 'light' 
            ? "text-[#2F2F2F]" 
            : "text-[#F5F5F5]"
        )}
        disabled
      >
        <Play className="w-4 h-4" />
        <span className="sr-only">تشغيل الصوت</span>
      </Button>
    </div>
  );
};