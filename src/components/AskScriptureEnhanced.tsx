import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Sparkles, Heart, AlertTriangle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SearchLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { SearchWithHistory } from '@/components/SearchWithHistory';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useUserProgress } from '@/hooks/use-user-progress';
import { useLanguage } from '@/hooks/use-language';
import { VerseFeedback } from './VerseFeedback';

type Lang = 'ar' | 'en';

interface QuranVerse {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string | null;
}

interface Hadith {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string | null;
}

interface EnhancedResponse {
  ayat: QuranVerse[];
  ahadith: Hadith[];
  generic_tip: string; // <- backend uses generic_tip
  dua: string;
  is_sensitive: boolean;
}

interface AskScriptureEnhancedProps {
  language: string;
  tradition: string;
}

const FUNCTION_PRIMARY = 'ask-scripture';
const FUNCTION_FALLBACK = 'ask-scripture-enhanced';

// quick language guard
const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

export function AskScriptureEnhanced({ language, tradition }: AskScriptureEnhancedProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<EnhancedResponse | null>(null);

  const { toast } = useToast();
  const { saveSearch } = useSearchHistory();
  const { updateProgress } = useUserProgress();
  const { t, language: currentLanguage } = useLanguage();

  const abortRef = useRef<AbortController | null>(null);

  const totalCount = useMemo(
    () => (results?.ayat?.length || 0) + (results?.ahadith?.length || 0),
    [results]
  );

  const langToSend: Lang = (currentLanguage as Lang) || (isArabic(query) ? 'ar' : 'en');

  const invokeFunction = useCallback(
    async (fnName: string, signal?: AbortSignal) => {
      const authUser = await supabase.auth.getUser();
      const body = {
        query: query.trim(),
        lang: langToSend,
        user_id: authUser.data.user?.id,
      };
      return supabase.functions.invoke(fnName, { body, signal });
    },
    [query, langToSend]
  );

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    // cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsSearching(true);
    setResults(null);

    const timeout = setTimeout(() => ctrl.abort(), 15000); // 15s client timeout

    try {
      // Try primary function first
      let { data, error } = await invokeFunction(FUNCTION_PRIMARY, ctrl.signal);

      // Fallback to legacy function name if primary missing/not deployed
      if (error?.message?.includes('Function not found') || error?.status === 404) {
        ({ data, error } = await invokeFunction(FUNCTION_FALLBACK, ctrl.signal));
      }
      if (error) throw new Error(error.message || 'Search error occurred');

      const response = data as EnhancedResponse;
      setResults(response);

      // Save search history & progress
      await saveSearch(query.trim(), (response.ayat?.length || 0) + (response.ahadith?.length || 0));
      await updateProgress(1, 0, query.trim());

      if ((response.ayat?.length || 0) + (response.ahadith?.length || 0) > 0) {
        toast({
          title: langToSend === 'ar' ? 'تم العثور على نتائج' : 'Results Found',
          description:
            langToSend === 'ar'
              ? `وُجدت ${response.ayat?.length || 0} آيات و ${response.ahadith?.length || 0} أحاديث`
              : `Found ${response.ayat?.length || 0} verses and ${response.ahadith?.length || 0} hadiths`,
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === 'AbortError'
            ? (langToSend === 'ar' ? 'انتهت مهلة الطلب، حاول مرة أخرى.' : 'Request timed out, try again.')
            : err.message
          : langToSend === 'ar'
          ? 'حدث خطأ غير متوقع'
          : 'An unexpected error occurred';

      toast({
        title: langToSend === 'ar' ? 'خطأ في البحث' : 'Search Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      clearTimeout(timeout);
      setIsSearching(false);
      abortRef.current = null;
    }
  }, [invokeFunction, query, langToSend, saveSearch, updateProgress, toast]);

  const renderScriptureCard = (
    title: string,
    icon: React.ReactNode,
    items: Array<QuranVerse | Hadith>
  ) => {
    if (!items || items.length === 0) return null;

    return (
      <Card className="shadow-spiritual border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            <span className={langToSend === 'ar' ? 'font-arabic' : ''}>{title}</span>
            <Badge variant="secondary" className="ml-2">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => {
            const showArabic = langToSend === 'ar';
            const main = showArabic ? item.text_ar : item.text_en || item.text_ar;
            const subArabic = !showArabic && item.text_ar;

            return (
              <div key={(item.id ?? '') + index} className="border-l-2 border-l-muted pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {item.source_ref}
                  </Badge>
                </div>

                <p
                  className={`text-lg leading-relaxed mb-1 ${
                    showArabic ? 'text-right font-uthmanic' : 'text-left'
                  }`}
                  dir={showArabic ? 'rtl' : 'ltr'}
                >
                  {main}
                </p>

                {subArabic && (
                  <p className="text-sm text-muted-foreground italic font-uthmanic" dir="rtl">
                    {item.text_ar}
                  </p>
                )}

                <div className="flex justify-end mt-2">
                  <VerseFeedback verseRef={item.source_ref} query={query} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
            {t('ask.title')}
          </h1>
          <p className={`text-muted-foreground ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
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
                    <p className={`text-sm text-amber-800 ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
                      {t('ask.warning')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quran Verses */}
            {renderScriptureCard(
              langToSend === 'ar' ? 'آيات قرآنية' : 'Quranic Verses',
              <BookOpen className="h-5 w-5 text-primary" />,
              results.ayat
            )}

            {/* Hadith */}
            {renderScriptureCard(
              langToSend === 'ar' ? 'أحاديث شريفة' : 'Prophetic Traditions',
              <Sparkles className="h-5 w-5 text-secondary" />,
              results.ahadith
            )}

            {/* Practical Advice */}
            {!results.is_sensitive && results.generic_tip && (
              <Card className="shadow-spiritual border-l-4 border-l-secondary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-secondary" />
                    <span className={langToSend === 'ar' ? 'font-arabic' : ''}>
                      {langToSend === 'ar' ? 'نصيحة عملية' : 'Practical Advice'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-lg leading-relaxed ${
                      langToSend === 'ar' ? 'text-right font-arabic' : 'text-left'
                    } whitespace-pre-line`}
                    dir={langToSend === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {results.generic_tip.split('\n').map((p, i) => (
                      <p key={i} className="mb-4 last:mb-0">
                        {p}
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
                    <span className={langToSend === 'ar' ? 'font-arabic' : ''}>
                      {langToSend === 'ar' ? 'دعاء مقترح' : 'Suggested Supplication'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-lg leading-relaxed text-accent font-medium ${
                      langToSend === 'ar' ? 'text-right font-uthmanic' : 'text-left'
                    }`}
                    dir={langToSend === 'ar' ? 'rtl' : 'ltr'}
                  >
                    {results.dua}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Empty results but no error */}
            {totalCount === 0 && (
              <Card className="shadow-gentle">
                <CardContent className="p-6 text-center text-muted-foreground">
                  {langToSend === 'ar' ? 'لم يتم العثور على نصوص مرتبطة. جرّب إعادة صياغة السؤال.' : 'No related texts found. Try rephrasing your question.'}
                </CardContent>
              </Card>
            )}

            {/* Disclaimer */}
            <Card className="shadow-gentle bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className={`text-sm text-muted-foreground ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
                  <strong>{langToSend === 'ar' ? 'تنبيه مهم:' : 'Important Note:'}</strong> {t('ask.disclaimer')}
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
              <h3 className={`text-xl font-semibold mb-2 ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
                {t('ask.empty.title')}
              </h3>
              <p className={`text-muted-foreground mb-4 ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
                {t('ask.empty.description')}
              </p>
              <div className={`text-sm text-muted-foreground space-y-1 ${langToSend === 'ar' ? 'font-arabic' : ''}`}>
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
