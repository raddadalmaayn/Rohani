import React from 'react';
import { cn } from '@/lib/utils';

interface AyahBadgeProps {
  number: number;
  theme?: 'light' | 'dark';
  className?: string;
  onClick?: () => void;
}

export const AyahBadge: React.FC<AyahBadgeProps> = ({ 
  number, 
  theme = 'light', 
  className,
  onClick 
}) => {
  const formatArabicNumber = (num: number): string => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(digit => arabicNumerals[parseInt(digit)]).join('');
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full transition-transform duration-150",
        "hover:scale-110 active:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1",
        theme === 'light' 
          ? "bg-[#E9D89F] text-[#2F2F2F] focus:ring-[#D4B14D]" 
          : "bg-[#3A3220] text-[#F5F5F5] focus:ring-[#C7A240]",
        className
      )}
      style={{
        fontSize: '12px',
        fontFamily: 'Noto Kufi Arabic, sans-serif'
      }}
    >
      {formatArabicNumber(number)}
    </button>
  );
};