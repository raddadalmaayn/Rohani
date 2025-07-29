import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Book, Moon, Star } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/hooks/use-language';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t, language } = useLanguage();
  
  const spiritualVerses = {
    ar: [
      "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
      "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
      "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
      "وَاللَّهُ خَيْرٌ حَافِظًا وَهُوَ أَرْحَمُ الرَّاحِمِينَ"
    ],
    en: [
      "And whoever fears Allah - He will make for him a way out",
      "Verily, in the remembrance of Allah do hearts find peace",
      "Indeed, with hardship comes ease",
      "And Allah is the best guardian, and He is the most merciful of the merciful"
    ]
  };

  const [currentVerse, setCurrentVerse] = useState(0);

  const handleEnter = () => {
    const defaultData = { 
      language: language, 
      tradition: 'islam', 
      goal: 'spiritual-growth' 
    };
    onComplete(defaultData);
  };

  const nextVerse = () => {
    setCurrentVerse((prev) => (prev + 1) % spiritualVerses[language].length);
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?ixlib=rb-4.0.3&auto=format&fit=crop&w=3880&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'overlay'
      }}
    >
      {/* Language Toggle - Fixed position */}
      <div className="absolute top-6 right-6 z-10">
        <LanguageToggle />
      </div>

      {/* Floating stars animation */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <Star
            key={i}
            className={`absolute text-white/20 animate-pulse`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
            size={8 + Math.random() * 16}
          />
        ))}
      </div>

      <Card className="w-full max-w-2xl shadow-2xl bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-12 text-center">
          {/* App Icon */}
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Moon className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* App Title */}
          <h1 className={`text-4xl font-bold text-white mb-3 ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('onboarding.title')}
          </h1>
          <p className={`text-white/80 text-lg mb-8 ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('onboarding.subtitle')}
          </p>

          {/* Spiritual Verse */}
          <Card 
            className="mb-8 bg-white/5 border-white/20 cursor-pointer hover:bg-white/10 transition-all duration-300"
            onClick={nextVerse}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-center mb-4">
                <Book className="h-5 w-5 text-emerald-300 mr-2" />
                <span className={`text-emerald-300 text-sm ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('onboarding.verse.label')}
                </span>
              </div>
              <p 
                className={`text-xl text-white font-medium leading-relaxed ${language === 'ar' ? 'font-arabic' : ''}`} 
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                {spiritualVerses[language][currentVerse]}
              </p>
              <p className={`text-white/60 text-sm mt-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('onboarding.verse.next')}
              </p>
            </CardContent>
          </Card>

          {/* Enter Button */}
          <Button 
            onClick={handleEnter}
            size="lg"
            className={`bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white px-12 py-4 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${language === 'ar' ? 'font-arabic' : ''}`}
          >
            <Heart className={`h-5 w-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
            {t('onboarding.button')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}