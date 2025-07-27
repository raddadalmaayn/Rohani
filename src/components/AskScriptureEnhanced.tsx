import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Heart, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SearchLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { SearchWithHistory } from '@/components/SearchWithHistory';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useUserProgress } from '@/hooks/use-user-progress';
import { useLanguage } from '@/hooks/use-language';
import { VerseFeedback } from './VerseFeedback';

interface QuranVerse {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string;
}

interface Hadith {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string;
}

interface EnhancedResponse {
  ayat: QuranVerse[];
  ahadith: Hadith[];
  practical_tip: string;
  dua: string;
  is_sensitive: boolean;
}

interface AskScriptureEnhancedProps {
  language: string;
  tradition: string;
}

export function AskScriptureEnhanced({ language, tradition }: AskScriptureEnhancedProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<EnhancedResponse | null>(null);
  const { toast } = useToast();
  const { saveSearch } = useSearchHistory();
  const { updateProgress } = useUserProgress();
  const { t, language: currentLanguage } = useLanguage();

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResults(null);
    
    try {
      console.log('Calling ask-scripture-enhanced function with query:', query);
      
      const { data, error } = await supabase.functions.invoke('ask-scripture-enhanced', {
        body: { 
          query: query.trim(),
          lang: currentLanguage,
          user_id: (await supabase.auth.getUser()).data.user?.id 
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Search error occurred');
      }

      const response: EnhancedResponse = data;
      console.log('Enhanced response received:', response);
      
      setResults(response);

      // Save search to history and update progress
      const totalResults = (response.ayat?.length || 0) + (response.ahadith?.length || 0);
      await saveSearch(query.trim(), totalResults);
      await updateProgress(1, 0, query.trim());

      if (totalResults > 0) {
        toast({
          title: currentLanguage === 'ar' ? 'تم العثور على نتائج' : 'Results Found',
          description: currentLanguage === 'ar' 
            ? `وُجدت ${response.ayat?.length || 0} آيات و ${response.ahadith?.length || 0} أحاديث`
            : `Found ${response.ayat?.length || 0} verses and ${response.ahadith?.length || 0} hadiths`,
        });
      } else {
        toast({
          title: currentLanguage === 'ar' ? 'لا توجد نتائج' : 'No Results',
          description: currentLanguage === 'ar' ? 'جرب صياغة السؤال بطريقة أخرى' : 'Try rephrasing your question',
          variant: 'destructive',
        });
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: currentLanguage === 'ar' ? 'خطأ في البحث' : 'Search Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const renderScriptureCard = (title: string, icon: React.ReactNode, items: any[], isQuran: boolean) => {
    if (!items || items.length === 0) return null;

    return (
      <Card className="shadow-spiritual border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            <span className={currentLanguage === 'ar' ? 'font-arabic' : ''}>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id || index} className="border-l-2 border-l-muted pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {item.source_ref}
                </Badge>
              </div>
              <p 
                className={`text-lg leading-relaxed mb-2 ${
                  currentLanguage === 'ar' ? 'text-right font-quran' : 'text-left'
                }`}
                dir={currentLanguage === 'ar' ? 'rtl' : 'ltr'}
              >
                {currentLanguage === 'ar' ? item.text_ar : (item.text_en || item.text_ar)}
              </p>
              {currentLanguage === 'en' && item.text_en && item.text_ar && (
                <p className="text-sm text-muted-foreground italic" dir="rtl">
                  {item.text_ar}
                </p>
              )}
              <div className="flex justify-end mt-2">
                <VerseFeedback 
                  verseRef={item.source_ref} 
                  query={query}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
            {t('ask.title')}
          </h1>
          <p className={`text-muted-foreground ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
            {t('ask.subtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <SearchWithHistory
          onSearch={handleSearch}
          currentQuery={query}
          onQueryChange={setQuery}
          isSearching={isSearching}
        />

        {/* Loading State */}
        {isSearching && <SearchLoadingSkeleton />}

        {/* Results */}
        {!isSearching && results && (
          <div className="space-y-6">
            {/* Sensitive Topic Warning */}
            {results.is_sensitive && (
              <Card className="shadow-gentle border-l-4 border-l-amber-500 bg-amber-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className={`text-sm text-amber-800 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
                      {t('ask.warning')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quran Verses */}
            {renderScriptureCard(
              currentLanguage === 'ar' ? 'آيات قرآنية' : 'Quranic Verses',
              <BookOpen className="h-5 w-5 text-primary" />,
              results.ayat,
              true
            )}

            {/* Hadith */}
            {renderScriptureCard(
              currentLanguage === 'ar' ? 'أحاديث شريفة' : 'Prophetic Traditions',
              <Sparkles className="h-5 w-5 text-secondary" />,
              results.ahadith,
              false
            )}

            {/* Practical Advice */}
            {!results.is_sensitive && results.practical_tip && (
              <Card className="shadow-spiritual border-l-4 border-l-secondary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-secondary" />
                    <span className={currentLanguage === 'ar' ? 'font-arabic' : ''}>
                      {currentLanguage === 'ar' ? 'نصيحة عملية' : 'Practical Advice'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-lg leading-relaxed ${
                      currentLanguage === 'ar' ? 'text-right font-arabic' : 'text-left'
                    } whitespace-pre-line`}
                    dir={currentLanguage === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {results.practical_tip.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dua Section */}
            {!results.is_sensitive && results.dua && (
              <Card className="shadow-spiritual border-l-4 border-l-accent bg-gradient-to-r from-accent/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5 text-accent" />
                    <span className={currentLanguage === 'ar' ? 'font-arabic' : ''}>
                      {currentLanguage === 'ar' ? 'دعاء مقترح' : 'Suggested Supplication'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p 
                    className={`text-lg leading-relaxed text-accent font-medium ${
                      currentLanguage === 'ar' ? 'text-right font-quran' : 'text-left'
                    }`}
                    dir={currentLanguage === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {results.dua}
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Disclaimer */}
            <Card className="shadow-gentle bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className={`text-sm text-muted-foreground ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
                  <strong>{currentLanguage === 'ar' ? 'تنبيه مهم:' : 'Important Note:'}</strong> {t('ask.disclaimer')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!results && !isSearching && (
          <Card className="shadow-gentle">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className={`text-xl font-semibold mb-2 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
                {t('ask.empty.title')}
              </h3>
              <p className={`text-muted-foreground mb-4 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
                {t('ask.empty.description')}
              </p>
              <div className={`text-sm text-muted-foreground space-y-1 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>
                <p>{t('ask.empty.examples')}</p>
                <p>• {t('ask.empty.example1')}</p>
                <p>• {t('ask.empty.example2')}</p>
                <p>• {t('ask.empty.example3')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}