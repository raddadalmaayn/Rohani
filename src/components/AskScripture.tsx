import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Heart, Sparkles, AlertTriangle, Mic, MicOff, Volume2, Bookmark, BookmarkCheck, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SearchLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { SearchWithHistory } from '@/components/SearchWithHistory';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useUserProgress } from '@/hooks/use-user-progress';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { ScriptureCard } from '@/components/ScriptureCard';

interface ScriptureResult {
  id: string;
  source_ref: string;
  text_ar: string;
  text_type: 'quran' | 'hadith';
  chapter_name: string;
  verse_number: number | null;
  similarity: number;
}

interface LLMResponse {
  scriptures: ScriptureResult[];
  practical_tip: string;
  dua: string;
  is_sensitive: boolean;
}

interface AskScriptureProps {
  language: string;
  tradition: string;
}

export function AskScripture({ language, tradition }: AskScriptureProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ScriptureResult[]>([]);
  const [practicalTip, setPracticalTip] = useState<string>('');
  const [dua, setDua] = useState<string>('');
  const [isSensitive, setIsSensitive] = useState(false);
  const { toast } = useToast();
  const { isListening, isProcessing, startListening, stopListening } = useVoiceSearch();
  const { saveSearch } = useSearchHistory();
  const { updateProgress } = useUserProgress();
  const { addBookmark, isBookmarked } = useBookmarks();
  const [duaBookmarkStatus, setDuaBookmarkStatus] = useState<boolean>(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResults([]);
    setPracticalTip('');
    setDua('');
    setIsSensitive(false);
    
    try {
      console.log('Calling ask-scripture function with query:', query);
      
      const { data, error } = await supabase.functions.invoke('ask-scripture', {
        body: { 
          query: query.trim(),
          user_id: (await supabase.auth.getUser()).data.user?.id 
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'حدث خطأ في البحث');
      }

      const response: LLMResponse = data;
      
      // If no scriptures found, try generating embeddings first
      if (!response.scriptures || response.scriptures.length === 0) {
        console.log('No results found, checking if embeddings exist...');
        
        // Check if any embeddings exist
        const { data: embeddingCheck } = await supabase
          .from('scripture')
          .select('embedding')
          .not('embedding', 'is', null)
          .limit(1);
        
        if (!embeddingCheck || embeddingCheck.length === 0) {
          console.log('No embeddings found, generating embeddings first...');
          toast({
            title: 'إعداد النظام',
            description: 'جاري إعداد قاعدة البيانات للمرة الأولى، يرجى الانتظار...',
          });
          
          // Generate embeddings
          const { data: embeddingResponse, error: embeddingError } = await supabase.functions.invoke('generate-embeddings');
          
          if (embeddingError) {
            console.error('Embedding generation error:', embeddingError);
          } else {
            console.log('Embeddings generated:', embeddingResponse);
            
            // Retry the search after a short delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const retryResponse = await supabase.functions.invoke('ask-scripture', {
              body: { 
                query: query.trim(),
                user_id: (await supabase.auth.getUser()).data.user?.id 
              }
            });
            
            if (!retryResponse.error && retryResponse.data?.scriptures?.length > 0) {
              const retryData: LLMResponse = retryResponse.data;
              setResults(retryData.scriptures || []);
              setPracticalTip(retryData.practical_tip || '');
              setDua(retryData.dua || '');
              setIsSensitive(retryData.is_sensitive || false);
              
              toast({
                title: 'تم العثور على نتائج',
                description: `وُجدت ${retryData.scriptures.length} نصوص ذات صلة`,
              });
              return;
            }
          }
        }
      }
      
      console.log('Setting response data:', {
        scriptures: response.scriptures?.length || 0,
        practical_tip: response.practical_tip,
        dua: response.dua,
        is_sensitive: response.is_sensitive
      });
      
      setResults(response.scriptures || []);
      setPracticalTip(response.practical_tip || '');
      setDua(response.dua || '');
      setIsSensitive(response.is_sensitive || false);

      // Save search to history and update progress
      await saveSearch(query.trim(), response.scriptures?.length || 0);
      await updateProgress(1, 0, query.trim());

      if (response.scriptures && response.scriptures.length > 0) {
        toast({
          title: 'تم العثور على نتائج',
          description: `وُجدت ${response.scriptures.length} نصوص ذات صلة`,
        });
      } else {
        toast({
          title: 'لا توجد نتائج',
          description: 'جرب صياغة السؤال بطريقة أخرى',
          variant: 'destructive',
        });
      }
      
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'خطأ في البحث',
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleVoiceSearch = async () => {
    if (isListening) {
      const transcribedText = await stopListening();
      if (transcribedText) {
        setQuery(transcribedText);
        // Auto-search after voice input
        setTimeout(() => handleSearch(), 500);
      }
    } else {
      startListening();
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quran':
        return '📖';
      case 'hadith':
        return '💫';
      default:
        return '✨';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'quran':
        return 'آية قرآنية';
      case 'hadith':
        return 'حديث شريف';
      default:
        return 'نص';
    }
  };

  // Handle dua bookmark
  const handleDuaBookmark = async () => {
    if (!dua) return;
    
    // Create a temporary scripture object for the dua
    const duaScripture = {
      id: `dua_${Date.now()}`, // Temporary ID for dua
      source_ref: 'دعاء مقترح',
      text_ar: dua,
      text_type: 'dua' as any,
      chapter_name: null,
      verse_number: null
    };

    try {
      // For dua, we'll add it to bookmarks as a special type
      const success = await addBookmark(duaScripture.id, 'دعاء مقترح من البحث');
      if (success) {
        setDuaBookmarkStatus(true);
        toast({
          title: 'تم حفظ الدعاء',
          description: 'تم إضافة الدعاء إلى المفضلة',
        });
      }
    } catch (error) {
      toast({
        title: 'خطأ في الحفظ',
        description: 'لم نتمكن من حفظ الدعاء',
        variant: 'destructive',
      });
    }
  };

  // Handle sharing dua
  const handleShareDua = async () => {
    if (!dua) return;
    
    const shareText = `${dua}\n\n- دعاء مقترح`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'دعاء مقترح',
          text: shareText,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: 'تم النسخ',
          description: 'تم نسخ الدعاء إلى الحافظة',
        });
      } catch (error) {
        toast({
          title: 'خطأ في النسخ',
          description: 'لم نتمكن من نسخ الدعاء',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">نصوص وهَدى</h1>
          <p className="text-muted-foreground">اسأل واحصل على نصوص روحية ونصائح عملية</p>
        </div>

        {/* Search Bar */}
        <SearchWithHistory
          onSearch={handleSearch}
          currentQuery={query}
          onQueryChange={setQuery}
          isSearching={isSearching}
        />

        {/* Voice Search Button */}
        <Card className="mb-8 shadow-gentle">
          <CardContent className="p-4">
            <div className="flex items-center justify-center">
              <Button
                onClick={handleVoiceSearch}
                disabled={isSearching || isProcessing}
                variant={isListening ? "destructive" : "outline"}
                size="lg"
                className="font-arabic"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    جاري المعالجة...
                  </div>
                ) : isListening ? (
                  <div className="flex items-center gap-2">
                    <MicOff className="h-4 w-4" />
                    إيقاف التسجيل
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    البحث بالصوت
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isSearching && <SearchLoadingSkeleton />}

        {/* Results */}
        {!isSearching && (practicalTip || dua) && (
          <div className="space-y-6">
            {/* Sensitive Topic Warning */}
            {isSensitive && (
              <Card className="shadow-gentle border-l-4 border-l-amber-500 bg-amber-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800">
                      هذا السؤال يحتاج إلى استشارة أهل العلم المختصين للحصول على فتوى صحيحة.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* AI Generated Tips */}
            {!isSensitive && practicalTip && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  نصيحة عملية
                </h2>
                
                <Card className="shadow-spiritual border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Button
                        onClick={() => speakText(practicalTip)}
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-lg leading-relaxed text-right whitespace-pre-line font-arabic" dir="rtl">
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

            {/* Dua Section */}
            {!isSensitive && dua && (
              <div className="space-y-4">
                <Card className="shadow-spiritual border-l-4 border-l-secondary bg-gradient-to-r from-secondary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-secondary" />
                        دعاء مقترح
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={handleDuaBookmark}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-secondary"
                        >
                          {duaBookmarkStatus ? (
                            <BookmarkCheck className="h-4 w-4" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => speakText(dua)}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-secondary"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleShareDua}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-secondary"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed text-right text-secondary font-medium font-quran" dir="rtl">
                      {dua}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Disclaimer */}
            <Card className="shadow-gentle bg-muted/50">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  <strong>تنبيه مهم:</strong> هذه نصائح عامة وليست فتوى شرعية. 
                  للاستفسارات الفقهية يُرجى الرجوع إلى أهل العلم المختصين.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
            
            {/* Scripture Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  النصوص ذات الصلة
                </h2>
                <div className="space-y-4">
                  {results.map((scripture) => (
                    <ScriptureCard
                      key={scripture.id}
                      scripture={scripture}
                      showBookmarkButton={true}
                    />
                  ))}
                </div>
              </div>
            )}
        {/* Empty State */}
        {!practicalTip && !dua && !isSearching && (
          <Card className="shadow-gentle">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">ابحث عن الهداية</h3>
              <p className="text-muted-foreground mb-4">
                اكتب سؤالك في شريط البحث للحصول على نصوص روحية ونصائح عملية
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>أمثلة للأسئلة:</p>
                <p>• "كيف أجد السكينة في قلبي؟"</p>
                <p>• "ما الذكر المناسب عند الهم؟"</p>
                <p>• "كيف أثبت على الصلاة؟"</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}