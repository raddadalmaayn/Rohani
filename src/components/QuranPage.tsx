import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Navigation } from '@/components/Navigation';
import { ChevronLeft, ChevronRight, Book, BookOpen, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { initializeQuran } from '@/utils/initializeQuran';

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
  text_en: string | null;
}

interface QuranPageProps {
  onNavigate?: (view: string) => void;
}

export function QuranPage({ onNavigate }: QuranPageProps = {}) {
  const [currentView, setCurrentView] = useState<'index' | 'reader'>('index');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const versesPerPage = 10; // Standard Quran page layout

  useEffect(() => {
    loadSurahs();
    initializeQuranData();
  }, []);

  const initializeQuranData = async () => {
    try {
      // Check if we have verse data
      const { data: verseCheck } = await supabase
        .from('verses')
        .select('id')
        .limit(1);

      if (!verseCheck || verseCheck.length === 0) {
        console.log('No verses found, ingesting Quran data...');
        toast({
          title: 'إعداد المصحف',
          description: 'جاري تحميل آيات القرآن الكريم للمرة الأولى...',
        });

        const { data, error } = await supabase.functions.invoke('ingest-quran');
        
        if (error) {
          console.error('Error ingesting Quran:', error);
          toast({
            title: 'خطأ في التحميل',
            description: 'حدث خطأ أثناء تحميل القرآن الكريم',
            variant: 'destructive',
          });
        } else {
          console.log('Quran ingestion result:', data);
          toast({
            title: 'تم التحميل بنجاح',
            description: 'تم تحميل آيات القرآن الكريم بنجاح',
          });
        }
      }
    } catch (error) {
      console.error('Error initializing Quran data:', error);
    }
  };

  const loadSurahs = async () => {
    try {
      const { data, error } = await supabase
        .from('surahs')
        .select('*')
        .order('id');

      if (error) throw error;
      setSurahs(data || []);
    } catch (error) {
      console.error('Error loading surahs:', error);
      toast({
        title: 'خطأ في التحميل',
        description: 'حدث خطأ أثناء تحميل فهرس السور',
        variant: 'destructive',
      });
    }
  };

  const loadVerses = async (surahId: number) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('verses')
        .select('*')
        .eq('surah_id', surahId)
        .order('ayah_number');

      if (error) throw error;
      setVerses(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading verses:', error);
      toast({
        title: 'خطأ في التحميل',
        description: 'حدث خطأ أثناء تحميل آيات السورة',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openSurah = async (surah: Surah) => {
    setSelectedSurah(surah);
    await loadVerses(surah.id);
    setCurrentView('reader');
  };

  const goToNextSurah = () => {
    if (selectedSurah && selectedSurah.id < 114) {
      const nextSurah = surahs.find(s => s.id === selectedSurah.id + 1);
      if (nextSurah) {
        openSurah(nextSurah);
      }
    }
  };

  const goToPrevSurah = () => {
    if (selectedSurah && selectedSurah.id > 1) {
      const prevSurah = surahs.find(s => s.id === selectedSurah.id - 1);
      if (prevSurah) {
        openSurah(prevSurah);
      }
    }
  };

  const totalPages = Math.ceil(verses.length / versesPerPage);
  const currentVerses = verses.slice((currentPage - 1) * versesPerPage, currentPage * versesPerPage);

  if (currentView === 'reader' && selectedSurah) {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-primary text-primary-foreground flex items-center justify-between px-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('index')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            فهرس السور
          </Button>
          
          <div className="text-center">
            <h1 className="text-lg font-bold font-arabic">سورة {selectedSurah.name_ar}</h1>
            <p className="text-sm opacity-90">{selectedSurah.name_en}</p>
          </div>

          <div className="text-sm">
            صفحة {currentPage} من {totalPages}
          </div>
        </div>

        {/* Quran Reader */}
        <div className="flex-1 overflow-auto bg-gradient-to-b from-background to-muted/20" style={{ height: 'calc(100vh - 8rem)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">جاري تحميل الآيات...</p>
              </div>
            </div>
          ) : currentVerses.length > 0 ? (
            <div className="max-w-4xl mx-auto p-8">
              <Card className="shadow-spiritual border-0 bg-white/95 backdrop-blur">
                <CardContent className="p-12">
                  {/* Bismillah for non-Tawbah surahs */}
                  {selectedSurah.id !== 9 && currentPage === 1 && (
                    <div className="text-center mb-12">
                      <p className="text-3xl font-arabic leading-relaxed text-primary" dir="rtl">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </p>
                      <Separator className="my-8 bg-primary/20" />
                    </div>
                  )}

                  {/* Verses */}
                  <div className="space-y-8">
                    {currentVerses.map((verse, index) => (
                      <div key={verse.id} className="text-right" dir="rtl">
                        <p className="text-2xl font-arabic leading-loose text-foreground mb-4">
                          {verse.text_ar}
                          <span className="inline-block mr-3 text-lg bg-primary text-primary-foreground rounded-full w-8 h-8 text-center leading-8 font-medium">
                            {verse.ayah_number}
                          </span>
                        </p>
                        
                        {index < currentVerses.length - 1 && (
                          <Separator className="my-6 bg-border/30" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">لا توجد آيات متاحة لهذه السورة</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="h-16 bg-muted border-t flex items-center justify-between px-4">
          <Button
            variant="outline"
            onClick={goToPrevSurah}
            disabled={!selectedSurah || selectedSurah.id === 1}
          >
            <ChevronRight className="h-4 w-4 mr-2" />
            السورة السابقة
          </Button>

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <span className="text-sm px-3">
              صفحة {currentPage} من {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={goToNextSurah}
            disabled={!selectedSurah || selectedSurah.id === 114}
          >
            السورة التالية
            <ChevronLeft className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Floating Navigation - only show when onNavigate is provided */}
        {onNavigate && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-background/95 backdrop-blur-sm border rounded-full shadow-lg px-2 py-2">
              <Navigation 
                currentView="quran" 
                onViewChange={onNavigate}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Surah Index View
  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 font-arabic">المصحف الشريف</h1>
          <p className="text-muted-foreground">فهرس سور القرآن الكريم</p>
        </div>

        {/* Surahs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surahs.map((surah) => (
            <Card 
              key={surah.id} 
              className="shadow-gentle hover:shadow-spiritual transition-all duration-200 cursor-pointer group"
              onClick={() => openSurah(surah)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                      {surah.id}
                    </div>
                    <div className="text-right" dir="rtl">
                      <h3 className="text-xl font-bold font-arabic mb-1">{surah.name_ar}</h3>
                      <p className="text-sm text-muted-foreground">{surah.name_en}</p>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Book className="h-4 w-4" />
                      {surah.ayah_count} آية
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {surah.revelation_place === 'mecca' ? 'مكية' : 'مدنية'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Navigation */}
        {onNavigate && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <Navigation 
              currentView="quran" 
              onViewChange={onNavigate}
            />
          </div>
        )}
      </div>
    </div>
  );
}