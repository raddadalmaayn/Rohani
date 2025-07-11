import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Heart, Sparkles } from 'lucide-react';

interface ScriptureResult {
  id: string;
  type: 'verse' | 'hadith' | 'text';
  source_ref: string;
  text: string;
  tradition: string;
  highlight?: string;
}

interface TipResult {
  tip_text: string;
  dua_text: string;
}

interface AskScriptureProps {
  language: string;
  tradition: string;
}

export function AskScripture({ language, tradition }: AskScriptureProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ScriptureResult[]>([]);
  const [tipResult, setTipResult] = useState<TipResult | null>(null);

  // Mock scripture data
  const mockScriptures: ScriptureResult[] = [
    {
      id: '1',
      type: 'verse',
      source_ref: 'سورة البقرة: 255',
      text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ',
      tradition: 'islam',
      highlight: 'الحي القيوم'
    },
    {
      id: '2',
      type: 'hadith',
      source_ref: 'صحيح البخاري: 6407',
      text: 'من صلى عليّ صلاة صلى الله عليه بها عشراً',
      tradition: 'islam',
      highlight: 'صلى الله عليه'
    },
    {
      id: '3',
      type: 'text',
      source_ref: 'الأذكار - النووي',
      text: 'اللهم أعني على ذكرك وشكرك وحسن عبادتك',
      tradition: 'islam',
      highlight: 'ذكرك وشكرك'
    }
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    
    // Simulate API call
    setTimeout(() => {
      // Filter results based on tradition
      const filteredResults = mockScriptures.filter(scripture => 
        scripture.tradition === tradition || tradition === 'universal'
      );
      
      setResults(filteredResults);
      
      // Generate mock tip and dua
      setTipResult({
        tip_text: 'تذكر أن الذكر يجلب السكينة للقلب. اجعل لسانك رطباً بذكر الله في كل وقت.',
        dua_text: 'اللهم اجعل قلبي مطمئناً بذكرك، واجعل لساني رطباً بشكرك.'
      });
      
      setIsSearching(false);
    }, 1500);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'verse':
        return '📖';
      case 'hadith':
        return '💫';
      default:
        return '✨';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'verse':
        return 'آية';
      case 'hadith':
        return 'حديث';
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
                variant="spiritual"
              >
                {isSearching ? 'يبحث...' : 'بحث'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-6">
            {/* Scripture Results */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                النصوص الروحية
              </h2>
              
              {results.map((scripture) => (
                <Card key={scripture.id} className="shadow-gentle hover:shadow-spiritual transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(scripture.type)}</span>
                        <Badge variant="secondary">{getTypeName(scripture.type)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {scripture.source_ref}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed text-right" dir="rtl">
                      {scripture.text}
                    </p>
                    {scripture.highlight && (
                      <div className="mt-3">
                        <Badge variant="outline" className="text-primary">
                          {scripture.highlight}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Generated Tips */}
            {tipResult && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  نصيحة عملية
                </h2>
                
                <Card className="shadow-spiritual border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <p className="text-lg leading-relaxed text-right mb-4" dir="rtl">
                      {tipResult.tip_text}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-spiritual border-l-4 border-l-secondary">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Heart className="h-5 w-5 text-secondary" />
                      دعاء مقترح
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed text-right text-secondary" dir="rtl">
                      {tipResult.dua_text}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !isSearching && (
          <Card className="shadow-gentle">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">ابحث عن الهداية</h3>
              <p className="text-muted-foreground">
                اكتب سؤالك في شريط البحث للحصول على نصوص روحية ونصائح عملية
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}