import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  History, 
  X, 
  Clock, 
  TrendingUp,
  Lightbulb
} from 'lucide-react';
import { useSearchHistory } from '@/hooks/use-search-history';

interface SearchWithHistoryProps {
  onSearch: (query: string) => void;
  currentQuery: string;
  onQueryChange: (query: string) => void;
  isSearching: boolean;
}

export function SearchWithHistory({ 
  onSearch, 
  currentQuery, 
  onQueryChange, 
  isSearching 
}: SearchWithHistoryProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { 
    searchHistory, 
    suggestions, 
    isLoading: suggestionsLoading,
    getSuggestions, 
    clearHistory 
  } = useSearchHistory();

  const commonQueries = [
    "كيف أجد السكينة؟",
    "دعاء الهم والحزن",
    "آيات الصبر",
    "أحاديث الرحمة",
    "الاستغفار وفضله",
    "آيات التوبة",
    "دعاء المريض",
    "فضل الذكر"
  ];

  useEffect(() => {
    if (currentQuery.length > 0) {
      getSuggestions(currentQuery);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [currentQuery]);

  const handleSuggestionClick = (query: string) => {
    onQueryChange(query);
    setShowSuggestions(false);
    onSearch(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      onSearch(currentQuery);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <Card className="shadow-gentle">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="اكتب سؤالك... مثل: كيف أجد السكينة؟"
              value={currentQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => currentQuery.length > 0 && setShowSuggestions(true)}
              className="pl-10 font-arabic"
            />
            {currentQuery && (
              <Button
                onClick={() => {
                  onQueryChange('');
                  setShowSuggestions(false);
                }}
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-10 shadow-lg border">
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              {/* Current query suggestions */}
              {suggestions.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">اقتراحات شائعة</span>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.query)}
                        variant="ghost"
                        className="w-full justify-between text-right h-auto p-2"
                      >
                        <span className="font-arabic">{suggestion.query}</span>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.frequency}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search History */}
              {searchHistory.length > 0 && (
                <>
                  {suggestions.length > 0 && <Separator />}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">البحث السابق</span>
                      </div>
                      <Button
                        onClick={clearHistory}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                      >
                        <X className="h-3 w-3 mr-1" />
                        مسح
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {searchHistory.slice(0, 5).map((query, index) => (
                        <Button
                          key={index}
                          onClick={() => handleSuggestionClick(query)}
                          variant="ghost"
                          className="w-full justify-start text-right h-auto p-2 font-arabic"
                        >
                          <Clock className="h-3 w-3 ml-2 text-muted-foreground" />
                          {query}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Common queries when no history or suggestions */}
              {suggestions.length === 0 && searchHistory.length === 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">أمثلة للبحث</span>
                  </div>
                  <div className="space-y-1">
                    {commonQueries.map((query, index) => (
                      <Button
                        key={index}
                        onClick={() => handleSuggestionClick(query)}
                        variant="ghost"
                        className="w-full justify-start text-right h-auto p-2 font-arabic text-sm"
                      >
                        {query}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}