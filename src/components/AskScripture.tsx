import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Heart, Sparkles, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
      
      setResults(response.scriptures || []);
      setPracticalTip(response.practical_tip || '');
      setDua(response.dua || '');
      setIsSensitive(response.is_sensitive || false);

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

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">نصوص وهَدى</h1>
          <p className="text-muted-foreground">اسأل واحصل على نصوص روحية ونصائح عملية</p>
        </div>

        {/* Search Bar */}
        <Card className="mb-8 shadow-gentle">
          <CardContent className="p-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="اكتب سؤالك... مثل: كيف أجد السكينة؟"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !query.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                {isSearching ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    جاري البحث...
                  </div>
                ) : (
                  'بحث'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
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

            {/* Scripture Results */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                النصوص الروحية ذات الصلة
              </h2>
              
              {results.map((scripture) => (
                <Card key={scripture.id} className="shadow-gentle hover:shadow-spiritual transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(scripture.text_type)}</span>
                        <Badge variant="secondary">{getTypeName(scripture.text_type)}</Badge>
                        {scripture.similarity && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(scripture.similarity * 100)}% تطابق
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {scripture.source_ref}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed text-right mb-3" dir="rtl">
                      {scripture.text_ar}
                    </p>
                    {scripture.chapter_name && (
                      <div className="text-sm text-muted-foreground">
                        {scripture.text_type === 'quran' ? 'سورة' : 'كتاب'}: {scripture.chapter_name}
                        {scripture.verse_number && ` - آية ${scripture.verse_number}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Generated Tips */}
            {!isSensitive && practicalTip && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  نصيحة عملية
                </h2>
                
                <Card className="shadow-spiritual border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <p className="text-lg leading-relaxed text-right" dir="rtl">
                      {practicalTip}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Dua Section */}
            {!isSensitive && dua && (
              <div className="space-y-4">
                <Card className="shadow-spiritual border-l-4 border-l-secondary bg-gradient-to-r from-secondary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Heart className="h-5 w-5 text-secondary" />
                      دعاء مقترح
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed text-right text-secondary font-medium" dir="rtl">
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

        {/* Empty State */}
        {results.length === 0 && !isSearching && (
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