import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Heart, Sparkles, AlertTriangle, Book } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SearchLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { SearchWithHistory } from '@/components/SearchWithHistory';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useUserProgress } from '@/hooks/use-user-progress';
import { useLanguage } from '@/hooks/use-language';

interface VerseResult {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string;
}

interface HadithResult {
  id: string;
  source_ref: string;
  text_ar: string;
  text_en?: string;
}

interface LLMResponse {
  ayat: VerseResult[];
  ahadith: HadithResult[];
  generic_tip: string;
  dua: string;
  is_sensitive: boolean;
  no_scripture_notice?: boolean;
}

interface AskScriptureProps {
  language: string;
  tradition: string;
}

export function AskScripture({ language, tradition }: AskScriptureProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [ayat, setAyat] = useState<VerseResult[]>([]);
  const [ahadith, setAhadith] = useState<HadithResult[]>([]);
  const [practicalTip, setPracticalTip] = useState<string>('');
  const [dua, setDua] = useState<string>('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [noScriptureNotice, setNoScriptureNotice] = useState(false);
  const { toast } = useToast();
  const { saveSearch } = useSearchHistory();
  const { updateProgress } = useUserProgress();
  const { t, language: currentLanguage } = useLanguage();

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setAyat([]);
    setAhadith([]);
      setPracticalTip('');
      setDua('');
      setIsSensitive(false);
      setNoScriptureNotice(false);
    
    try {
      console.log('Calling ask-scripture function with query:', query);
      
      const { data, error } = await supabase.functions.invoke('ask-scripture', {
        body: { 
          query: query.trim(),
          lang: currentLanguage,
          user_id: (await supabase.auth.getUser()).data.user?.id 
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || (currentLanguage === 'ar' ? 'حدث خطأ في البحث' : 'Search error occurred'));
      }

      const response: LLMResponse = data;
      
      // If no results found, try generating embeddings first
      if ((!response.ayat || response.ayat.length === 0) && (!response.ahadith || response.ahadith.length === 0)) {
        console.log('No results found, checking if embeddings exist...');
        
        // Check if any embeddings exist
        const { data: embeddingCheck } = await supabase
          .from('quran')
          .select('embedding')
          .not('embedding', 'is', null)
          .limit(1);
        
        if (!embeddingCheck || embeddingCheck.length === 0) {
          console.log('No embeddings found, generating embeddings first...');
          toast({
            title: currentLanguage === 'ar' ? 'إعداد النظام' : 'System Setup',
            description: currentLanguage === 'ar' 
              ? 'جاري إعداد قاعدة البيانات للمرة الأولى، يرجى الانتظار...' 
              : 'Setting up database for the first time, please wait...',
          });
          
          // Generate embeddings
          const { data: embeddingResponse, error: embeddingError } = await supabase.functions.invoke('generate-embeddings-enhanced');
          
          if (embeddingError) {
            console.error('Embedding generation error:', embeddingError);
          } else {
            console.log('Embeddings generated:', embeddingResponse);
            
            // Retry the search after a short delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const retryResponse = await supabase.functions.invoke('ask-scripture', {
              body: { 
                query: query.trim(),
                lang: currentLanguage,
                user_id: (await supabase.auth.getUser()).data.user?.id 
              }
            });
            
            if (!retryResponse.error && (retryResponse.data?.ayat?.length > 0 || retryResponse.data?.ahadith?.length > 0)) {
              const retryData: LLMResponse = retryResponse.data;
              setAyat(retryData.ayat || []);
              setAhadith(retryData.ahadith || []);
              setPracticalTip(retryData.generic_tip || '');
              setDua(retryData.dua || '');
              setIsSensitive(retryData.is_sensitive || false);
              setNoScriptureNotice(retryData.no_scripture_notice || false);
              
              toast({
                title: currentLanguage === 'ar' ? 'تم العثور على نتائج' : 'Results Found',
                description: currentLanguage === 'ar' 
                  ? `وُجدت ${(retryData.ayat?.length || 0) + (retryData.ahadith?.length || 0)} نصوص ذات صلة`
                  : `Found ${(retryData.ayat?.length || 0) + (retryData.ahadith?.length || 0)} relevant texts`,
              });
              return;
            }
          }
        }
      }
      
      console.log('Setting response data:', {
        ayat: response.ayat?.length || 0,
        ahadith: response.ahadith?.length || 0,
        generic_tip: response.generic_tip,
        dua: response.dua,
        is_sensitive: response.is_sensitive
      });
      
      setAyat(response.ayat || []);
      setAhadith(response.ahadith || []);
      setPracticalTip(response.generic_tip || '');
      setDua(response.dua || '');
      setIsSensitive(response.is_sensitive || false);
      setNoScriptureNotice(response.no_scripture_notice || false);

      // Save search to history and update progress
      await saveSearch(query.trim(), (response.ayat?.length || 0) + (response.ahadith?.length || 0));
      await updateProgress(1, 0, query.trim());

      if ((response.ayat && response.ayat.length > 0) || (response.ahadith && response.ahadith.length > 0)) {
        toast({
          title: currentLanguage === 'ar' ? 'تم العثور على نتائج' : 'Results Found',
          description: currentLanguage === 'ar' 
            ? `وُجدت ${(response.ayat?.length || 0) + (response.ahadith?.length || 0)} نصوص ذات صلة`
            : `Found ${(response.ayat?.length || 0) + (response.ahadith?.length || 0)} relevant texts`,
        });
      } else {
        toast({
          title: currentLanguage === 'ar' ? 'لا توجد نتائج' : 'No Results',
          description: currentLanguage === 'ar' 
            ? 'جرب صياغة السؤال بطريقة أخرى' 
            : 'Try rephrasing your question',
          variant: 'destructive',
        });
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: currentLanguage === 'ar' ? 'خطأ في البحث' : 'Search Error',
        description: error instanceof Error ? error.message : (currentLanguage === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };



  const isAR = currentLanguage === 'ar';

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>{t('ask.title')}</h1>
          <p className={`text-muted-foreground ${currentLanguage === 'ar' ? 'font-arabic' : ''}`}>{t('ask.subtitle')}</p>
        </div>

        {/* Search Bar */}
        <SearchWithHistory
          onSearch={handleSearch}
          currentQuery={query}
          onQueryChange={setQuery}
          isSearching={isSearching}
        />

        {/* No Scripture Notice */}
        {noScriptureNotice && !isSearching && (
          <div className="mb-4">
            <p className={`text-sm text-muted-foreground text-center ${isAR ? 'font-arabic' : ''}`}>
              {isAR 
                ? 'لم أجد نصوص مناسبة للسؤال، لكن إليك نصيحة عملية مفيدة:'
                : 'No specific scriptures found for your question, but here is practical advice:'}
            </p>
          </div>
        )}


        {/* Loading State */}
        {isSearching && <SearchLoadingSkeleton />}

        {/* Results */}
        {!isSearching && (ayat.length > 0 || ahadith.length > 0 || practicalTip || dua) && (
          <div className="space-y-6">
            {/* Sensitive Topic Warning */}
            {isSensitive && (
              <Card className="shadow-gentle border-l-4 border-l-amber-500 bg-amber-50/50">
                <CardContent className="p-4">
                   <div className="flex items-center gap-3">
                     <AlertTriangle className="h-5 w-5 text-amber-600" />
                     <p className={`text-sm text-amber-800 ${isAR ? 'font-arabic' : ''}`}>
                       {t('ask.warning')}
                     </p>
                   </div>
                </CardContent>
              </Card>
            )}

            {/* 1. Quran Verses - Only show if there are results */}
            {ayat.length > 0 && (
              <div className="space-y-4">
                <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAR ? 'font-arabic' : ''}`}>
                  🌿 {isAR ? 'آيات قرآنية' : 'Quran Verses'}
                </h2>
                {ayat.map((verse, index) => (
                  <Card key={verse.id} className="shadow-spiritual border-l-4 border-l-primary">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <Badge variant="secondary" className="mb-2">
                          {verse.source_ref}
                        </Badge>
                        <p className={`text-lg leading-relaxed font-quran ${isAR ? 'text-right' : 'text-left'}`} dir="rtl">
                          {verse.text_ar}
                        </p>
                        {!isAR && verse.text_en && (
                          <p className="text-md italic text-muted-foreground leading-relaxed" dir="ltr">
                            {verse.text_en}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 2. Hadith - Only show if there are results */}
            {ahadith.length > 0 && (
              <div className="space-y-4">
                <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAR ? 'font-arabic' : ''}`}>
                  📜 {isAR ? 'أحاديث شريفة' : 'Hadith'}
                </h2>
                {ahadith.map((hadith, index) => (
                  <Card key={hadith.id} className="shadow-spiritual border-l-4 border-l-accent">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <Badge variant="outline" className="mb-2">
                          {hadith.source_ref}
                        </Badge>
                        <p className={`text-lg leading-relaxed font-arabic ${isAR ? 'text-right' : 'text-left'}`} dir="rtl">
                          {hadith.text_ar}
                        </p>
                        {!isAR && hadith.text_en && (
                          <p className="text-md italic text-muted-foreground leading-relaxed" dir="ltr">
                            {hadith.text_en}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 3. Practical Advice */}
            {!isSensitive && practicalTip && (
              <div className="space-y-4">
                <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAR ? 'font-arabic' : ''}`}>
                  💡 {t('ask.practical.title')}
                </h2>
                <Card className="shadow-spiritual border-l-4 border-l-secondary">
                  <CardContent className="p-6">
                    <div className={`text-lg leading-relaxed ${isAR ? 'text-right font-arabic' : 'text-left'} whitespace-pre-line`} dir={isAR ? 'rtl' : 'ltr'}>
                      {practicalTip.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-4 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 4. Suggested Dua */}
            {!isSensitive && dua && (
              <div className="space-y-4">
                <h2 className={`text-xl font-semibold flex items-center gap-2 ${isAR ? 'font-arabic' : ''}`}>
                  🤲 {t('ask.dua.title')}
                </h2>
                <Card className="shadow-spiritual border-l-4 border-l-accent bg-gradient-to-r from-accent/5 to-transparent">
                  <CardContent className="p-6">
                    <p className={`text-lg leading-relaxed font-medium ${isAR ? 'text-right font-quran' : 'text-left'}`} dir={isAR ? 'rtl' : 'ltr'}>
                      {dua}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Disclaimer */}
            <Card className="shadow-gentle bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className={`text-sm text-muted-foreground ${isAR ? 'font-arabic' : ''}`}>
                  <strong>{isAR ? 'تنبيه مهم:' : 'Important Note:'}</strong> {t('ask.disclaimer')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {ayat.length === 0 && ahadith.length === 0 && !practicalTip && !dua && !isSearching && (
           <Card className="shadow-gentle">
             <CardContent className="p-12 text-center">
               <div className="text-6xl mb-4">🌱</div>
               <h3 className={`text-xl font-semibold mb-2 ${isAR ? 'font-arabic' : ''}`}>{t('ask.empty.title')}</h3>
               <p className={`text-muted-foreground mb-4 ${isAR ? 'font-arabic' : ''}`}>
                 {t('ask.empty.description')}
               </p>
               <div className={`text-sm text-muted-foreground space-y-1 ${isAR ? 'font-arabic' : ''}`}>
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