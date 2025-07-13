import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Book } from 'lucide-react';

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
  ayah_count: number;
  revelation_place: string;
}

interface Verse {
  id: number;
  surah_id: number;
  ayah_number: number;
  text_ar: string;
}

export function QuranPage() {
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [currentAyah, setCurrentAyah] = useState(1);

  // Fetch all surahs
  const { data: surahs, isLoading: surahsLoading } = useQuery({
    queryKey: ['surahs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surahs')
        .select('*')
        .order('id');
      
      if (error) throw error;
      return data as Surah[];
    }
  });

  // Fetch verses for selected surah
  const { data: verses, isLoading: versesLoading } = useQuery({
    queryKey: ['verses', selectedSurah],
    queryFn: async () => {
      if (!selectedSurah) return [];
      
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .eq('surah_id', selectedSurah)
        .order('ayah_number');
      
      if (error) throw error;
      return data as Verse[];
    },
    enabled: !!selectedSurah
  });

  const currentSurah = surahs?.find(s => s.id === selectedSurah);
  const currentVerse = verses?.find(v => v.ayah_number === currentAyah);

  const handleNextAyah = () => {
    if (currentSurah && currentAyah < currentSurah.ayah_count) {
      setCurrentAyah(currentAyah + 1);
    }
  };

  const handlePrevAyah = () => {
    if (currentAyah > 1) {
      setCurrentAyah(currentAyah - 1);
    }
  };

  const handleNextSurah = () => {
    if (selectedSurah && selectedSurah < 114) {
      setSelectedSurah(selectedSurah + 1);
      setCurrentAyah(1);
    }
  };

  const handlePrevSurah = () => {
    if (selectedSurah && selectedSurah > 1) {
      setSelectedSurah(selectedSurah - 1);
      setCurrentAyah(1);
    }
  };

  if (!selectedSurah) {
    // Surah Index View
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">القرآن الكريم</h1>
          <p className="text-muted-foreground">اختر سورة للقراءة</p>
        </div>

        {surahsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[70vh]">
            <div className="space-y-2">
              {surahs?.map((surah) => (
                <Card 
                  key={surah.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setSelectedSurah(surah.id);
                    setCurrentAyah(1);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {surah.id}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{surah.name_ar}</h3>
                          <p className="text-sm text-muted-foreground">{surah.name_en}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {surah.ayah_count} آية
                        </Badge>
                        <Badge variant={surah.revelation_place === 'mecca' ? 'default' : 'outline'}>
                          {surah.revelation_place === 'mecca' ? 'مكية' : 'مدنية'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  // Quran Reader View
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSurah(null)}
            >
              <ChevronLeft className="w-4 h-4 ml-2" />
              العودة للفهرس
            </Button>
            <CardTitle className="text-xl text-center">
              سورة {currentSurah?.name_ar}
            </CardTitle>
            <div className="w-20" /> {/* Spacer */}
          </div>
        </CardHeader>
      </Card>

      {/* Verse Display */}
      <Card className="mb-6">
        <CardContent className="p-8">
          {versesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>جاري التحميل...</p>
            </div>
          ) : currentVerse ? (
            <div className="text-center">
              <p 
                className="text-2xl leading-relaxed mb-4 font-arabic"
                style={{ fontFamily: '"Noto Kufi Arabic", "Arial Unicode MS", Arial, sans-serif' }}
              >
                {currentVerse.text_ar}
              </p>
              <Badge variant="outline" className="text-sm">
                الآية {currentAyah} من {currentSurah?.ayah_count}
              </Badge>
            </div>
          ) : (
            <div className="text-center py-8">
              <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد آيات متاحة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevSurah}
              disabled={!selectedSurah || selectedSurah <= 1}
            >
              <ChevronRight className="w-4 h-4 ml-1" />
              السورة السابقة
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevAyah}
                disabled={currentAyah <= 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <span className="text-sm font-medium px-3">
                {currentAyah} / {currentSurah?.ayah_count}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextAyah}
                disabled={!currentSurah || currentAyah >= currentSurah.ayah_count}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextSurah}
              disabled={!selectedSurah || selectedSurah >= 114}
            >
              السورة التالية
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          </div>

          {/* Progress Bar */}
          {currentSurah && (
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentAyah / currentSurah.ayah_count) * 100}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}