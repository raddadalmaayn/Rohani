import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  ar: {
    // Navigation
    'nav.scripture': 'اسأل روحاني',
    'nav.quran': 'المصحف',
    'nav.calendar': 'التقويم',
    'nav.dashboard': 'إحصائيات',
    'nav.profile': 'الملف',
    
    // Header
    'header.title': 'روحاني',
    'header.subtitle': 'دقيقة سكينة… كلما تعب قلبك',
    
    // Profile
    'profile.title': 'الملف الشخصي',
    'profile.welcome': 'مرحباً بك في روحاني',
    'profile.restart': 'إعادة بدء التطبيق',
    
    // Language switcher
    'language.current': 'العربية',
    'language.switch': 'English',
  },
  en: {
    // Navigation
    'nav.scripture': 'Ask Scripture',
    'nav.quran': 'Quran',
    'nav.calendar': 'Calendar',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    
    // Header
    'header.title': 'Roohani',
    'header.subtitle': 'A moment of peace... whenever your heart is tired',
    
    // Profile
    'profile.title': 'Profile',
    'profile.welcome': 'Welcome to Roohani',
    'profile.restart': 'Restart App',
    
    // Language switcher
    'language.current': 'English',
    'language.switch': 'العربية',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('roohani-language') as Language;
    if (saved && (saved === 'ar' || saved === 'en')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('roohani-language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}