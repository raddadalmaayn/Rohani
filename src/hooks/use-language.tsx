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
    
    // AskScripture
    'ask.title': 'نصوص وهَدى',
    'ask.subtitle': 'اسأل واحصل على نصوص روحية ونصائح عملية',
    'ask.placeholder': 'اكتب سؤالك... مثل: كيف أجد السكينة؟',
    'ask.empty.title': 'ابحث عن الهداية',
    'ask.empty.description': 'اكتب سؤالك في شريط البحث للحصول على نصوص روحية ونصائح عملية',
    'ask.empty.examples': 'أمثلة للأسئلة:',
    'ask.empty.example1': '"كيف أجد السكينة في قلبي؟"',
    'ask.empty.example2': '"ما الذكر المناسب عند الهم؟"',
    'ask.empty.example3': '"كيف أثبت على الصلاة؟"',
    'ask.practical.title': 'نصيحة عملية',
    'ask.dua.title': 'دعاء مقترح',
    'ask.warning': 'هذا السؤال يحتاج إلى استشارة أهل العلم المختصين للحصول على فتوى صحيحة.',
    'ask.disclaimer': 'تنبيه مهم: هذه نصائح عامة وليست فتوى شرعية. للاستفسارات الفقهية يُرجى الرجوع إلى أهل العلم المختصين.',
  },
  en: {
    // Navigation
    'nav.scripture': 'Ask Scripture',
    'nav.quran': 'Quran',
    'nav.calendar': 'Calendar',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    
    // Header
    'header.title': 'Rohani',
    'header.subtitle': 'A moment of peace... whenever your heart is tired',
    
    // Profile
    'profile.title': 'Profile',
    'profile.welcome': 'Welcome to Rohani',
    'profile.restart': 'Restart App',
    
    // Language switcher
    'language.current': 'English',
    'language.switch': 'العربية',
    
    // AskScripture
    'ask.title': 'Scripture & Guidance',
    'ask.subtitle': 'Ask and receive spiritual texts and practical advice',
    'ask.placeholder': 'Type your question... like: How do I find inner peace?',
    'ask.empty.title': 'Seek Guidance',
    'ask.empty.description': 'Type your question in the search bar to receive spiritual texts and practical advice',
    'ask.empty.examples': 'Example questions:',
    'ask.empty.example1': '"How can I find peace in my heart?"',
    'ask.empty.example2': '"What prayers help with anxiety?"',
    'ask.empty.example3': '"How do I stay consistent with daily prayers?"',
    'ask.practical.title': 'Practical Advice',
    'ask.dua.title': 'Suggested Prayer',
    'ask.warning': 'This question requires consultation with qualified religious scholars for proper guidance.',
    'ask.disclaimer': 'Important Note: This is general advice and not religious ruling. For specific religious inquiries, please consult qualified scholars.',
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