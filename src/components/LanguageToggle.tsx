import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="min-w-[48px] bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
    >
      {language === 'ar' ? 'EN' : 'AR'}
    </Button>
  );
}