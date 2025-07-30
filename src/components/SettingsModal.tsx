import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Sun, Moon } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onOpenChange,
  fontScale,
  onFontScaleChange,
  theme,
  onThemeChange
}) => {
  const { t, language } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={language === 'ar' ? 'font-arabic text-right' : ''}>
            {t('reader.settings')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Font Size */}
          <div className="space-y-3">
            <Label className={language === 'ar' ? 'font-arabic' : ''}>
              {t('reader.fontSize')}
            </Label>
            <div className="space-y-2">
              <Slider
                value={[fontScale]}
                onValueChange={(value) => onFontScaleChange(value[0])}
                min={0.8}
                max={1.5}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('reader.small')}</span>
                <span>{t('reader.large')}</span>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="space-y-3">
            <Label className={language === 'ar' ? 'font-arabic' : ''}>
              {t('reader.theme')}
            </Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onThemeChange('light')}
                className="flex-1"
              >
                <Sun className="w-4 h-4 mr-2" />
                {t('reader.light')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onThemeChange('dark')}
                className="flex-1"
              >
                <Moon className="w-4 h-4 mr-2" />
                {t('reader.dark')}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className={language === 'ar' ? 'font-arabic' : ''}>
              {t('reader.preview')}
            </Label>
            <div 
              className={`p-4 rounded-lg border ${
                theme === 'light' 
                  ? 'bg-[#FFFDF8] border-[#E9D89F]/30' 
                  : 'bg-[#1C1B16] border-[#3A3220]/30'
              }`}
            >
              <p 
                className={`font-quran text-right leading-relaxed ${
                  theme === 'light' ? 'text-[#2F2F2F]' : 'text-[#F5F5F5]'
                }`}
                style={{ fontSize: `${20 * fontScale}px` }}
              >
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};