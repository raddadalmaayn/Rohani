import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Navigation } from '@/components/Navigation';
import { ChevronLeft, ChevronRight, Search, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Surah {
  id: number;
  name_ar: string;
  name_en: string;
  ayah_count: number;
  revelation_place: string;
}

interface Verse {
  surah_no: number | bigint;
  ayah_no_surah: number | bigint;
  ayah_ar: string;
  ayah_en: string | null;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const { toast } = useToast();

  const versesPerPage = 15;

  useEffect(() => {
    loadSurahs();
  }, []);

  const loadSurahs = async () => {
    try {
      console.log('Loading surahs...');
      const { data, error } = await supabase
        .from('surahs')
        .select('*')
        .order('id');

      if (error) {
        console.error('Error loading surahs:', error);
        throw error;
      }
      
      console.log('Surahs loaded:', data?.length);
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
      console.log('🔍 Loading verses for surah:', surahId, 'type:', typeof surahId);
      
      // Test 1: Direct query with number
      console.log('📋 Trying direct number query...');
      const { data: numberQuery, error: numberError } = await supabase
        .from('verses')
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en')
        .eq('surah_no', surahId)
        .order('ayah_no_surah')
        .limit(5);
      
      console.log('📊 Number query result:', { 
        data: numberQuery, 
        error: numberError, 
        count: numberQuery?.length || 0 
      });

      if (numberQuery && numberQuery.length > 0) {
        // Success! Get all verses
        const { data: allVerses, error: allError } = await supabase
          .from('verses')
          .select('surah_no, ayah_no_surah, ayah_ar, ayah_en')
          .eq('surah_no', surahId)
          .order('ayah_no_surah');
        
        if (allError) throw allError;
        console.log('✅ Loaded', allVerses?.length, 'verses for surah', surahId);
        setVerses(allVerses || []);
        setCurrentPage(1);
        return;
      }

      // Test 2: Check if RLS is blocking access
      console.log('🔒 Testing RLS access...');
      const { data: rlsTest, error: rlsError } = await supabase
        .from('verses')
        .select('surah_no')
        .limit(1);
      
      console.log('🔐 RLS test result:', { data: rlsTest, error: rlsError });

      // Test 3: Using bigint comparison
      console.log('📊 Trying bigint comparison...');
      const { data: bigintQuery, error: bigintError } = await supabase
        .from('verses')
        .select('surah_no, ayah_no_surah, ayah_ar, ayah_en')
        .filter('surah_no', 'eq', surahId)
        .order('ayah_no_surah')
        .limit(5);
      
      console.log('📈 Bigint query result:', { 
        data: bigintQuery, 
        error: bigintError, 
        count: bigintQuery?.length || 0 
      });

      if (bigintQuery && bigintQuery.length > 0) {
        // Success! Get all verses
        const { data: allVerses, error: allError } = await supabase
          .from('verses')
          .select('surah_no, ayah_no_surah, ayah_ar, ayah_en')
          .filter('surah_no', 'eq', surahId)
          .order('ayah_no_surah');
        
        if (allError) throw allError;
        console.log('✅ Loaded', allVerses?.length, 'verses for surah', surahId);
        setVerses(allVerses || []);
        setCurrentPage(1);
        return;
      }

      // If we get here, no data found
      console.log('❌ No verses found for surah', surahId);
      setVerses([]);
      setCurrentPage(1);
      
    } catch (error) {
      console.error('💥 Error loading verses:', error);
      toast({
        title: 'خطأ في التحميل',
        description: 'حدث خطأ أثناء تحميل آيات السورة',
        variant: 'destructive',
      });
      setVerses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openSurah = async (surah: Surah) => {
    console.log('Opening surah:', surah);
    setSelectedSurah(surah);
    await loadVerses(surah.id);
    setCurrentView('reader');
    setShowSurahPicker(false);
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

  const filteredSurahs = surahs.filter(surah => 
    surah.name_ar.includes(searchTerm) || 
    surah.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    surah.id.toString().includes(searchTerm)
  );

  const totalPages = Math.ceil(verses.length / versesPerPage);
  const currentVerses = verses.slice((currentPage - 1) * versesPerPage, currentPage * versesPerPage);

  if (currentView === 'reader' && selectedSurah) {
    return (
      <div className="fixed inset-0 bg-[#faf9f6] dark:bg-[#0d0d0d] z-50 overflow-hidden">
        {/* Ornamental Surah Header */}
        <Dialog open={showSurahPicker} onOpenChange={setShowSurahPicker}>
          <DialogTrigger asChild>
            <div className="h-14 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-b-2 border-amber-200 dark:border-amber-700 flex items-center justify-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
              <div className="text-center">
                <h1 className="text-xl font-bold text-[#3c2f1b] dark:text-amber-200 font-amiri">
                  سُورَةُ {selectedSurah.name_ar}
                </h1>
                <p className="text-xs text-amber-700 dark:text-amber-300">{selectedSurah.name_en}</p>
              </div>
            </div>
          </DialogTrigger>
          
          <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-center font-amiri">فهرس السور</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="ابحث بالاسم أو الرقم"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-right"
                dir="rtl"
              />
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredSurahs.map((surah) => (
                  <Card 
                    key={surah.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openSurah(surah)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                          {surah.id}
                        </div>
                        <div className="flex-1 text-right mr-3" dir="rtl">
                          <h3 className="font-bold font-amiri">{surah.name_ar}</h3>
                          <p className="text-xs text-muted-foreground">{surah.name_en}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {surah.ayah_count} آية
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto" style={{ height: 'calc(100vh - 10rem)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                <p className="mt-4 text-amber-700 dark:text-amber-300">جاري تحميل الآيات...</p>
              </div>
            </div>
          ) : currentVerses.length > 0 ? (
            <div className="max-w-4xl mx-auto p-6">
              {/* Traditional Mushaf Page */}
              <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg shadow-xl min-h-[700px] p-8 relative">
                
                {/* Basmala - only for non-Tawbah surahs and first page */}
                {selectedSurah.id !== 9 && currentPage === 1 && (
                  <div className="text-center mb-8">
                    <div className="inline-block border border-amber-300 dark:border-amber-600 rounded-full px-8 py-3 bg-amber-50/50 dark:bg-amber-900/20">
                      <p className="text-2xl leading-relaxed text-[#3c2f1b] dark:text-amber-200 font-amiri" dir="rtl">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </p>
                    </div>
                  </div>
                )}

                {/* Verses with Traditional Layout */}
                <div className="space-y-1 text-right leading-loose font-amiri" dir="rtl" style={{ fontSize: '24px', lineHeight: '2.2' }}>
                  {currentVerses.map((verse, index) => (
                    <span key={`${verse.surah_no}-${verse.ayah_no_surah}`} className="inline">
                      <span className="text-black dark:text-gray-100 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 px-1 rounded transition-colors">
                        {verse.ayah_ar}
                      </span>
                      {/* Ayah Circle Marker */}
                      <span className="inline-block mx-1 align-middle">
                         <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 dark:bg-amber-800 border border-amber-400 dark:border-amber-600 rounded-full text-xs font-bold text-[#3c2f1b] dark:text-amber-200">
                           {Number(verse.ayah_no_surah)}
                         </span>
                      </span>
                      {/* Add spacing between verses */}
                      <span className="inline-block w-2"></span>
                    </span>
                  ))}
                </div>

                {/* Page Number Pill */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {currentPage}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-amber-600 mx-auto mb-4" />
                <p className="text-lg text-amber-700 dark:text-amber-300">لا توجد آيات متاحة لهذه السورة</p>
                <p className="text-sm text-muted-foreground mt-2">
                  السورة: {selectedSurah.name_ar} - الآيات المطلوبة: {selectedSurah.ayah_count}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  عدد الآيات المحملة: {verses.length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="h-16 bg-white dark:bg-gray-900 border-t border-amber-200 dark:border-amber-700 flex items-center justify-between px-4 relative z-50">
          <Button
            variant="outline"
            onClick={goToPrevSurah}
            disabled={!selectedSurah || selectedSurah.id === 1}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <ChevronRight className="h-4 w-4 mr-2" />
            السورة السابقة
          </Button>

          {/* Page Navigation */}
          <div className="flex items-center gap-3 relative z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="text-amber-700 border-amber-300 bg-white dark:bg-gray-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <span className="text-sm px-6 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-md font-semibold">
              صفحة {currentPage} من {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="text-amber-700 border-amber-300 bg-white dark:bg-gray-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={goToNextSurah}
            disabled={!selectedSurah || selectedSurah.id === 114}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            السورة التالية
            <ChevronLeft className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Back to Index Button */}
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('index')}
            className="text-amber-700 hover:bg-amber-100"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            فهرس السور
          </Button>
        </div>

        {/* Ask Quran Floating Button */}
        {onNavigate && (
          <div className="fixed bottom-20 right-6 z-50">
            <Button
              onClick={() => onNavigate('ask')}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg rounded-full p-4"
              size="lg"
            >
              <Search className="h-5 w-5 mr-2" />
              اسأل القرآن
            </Button>
          </div>
        )}

        {/* Floating Navigation */}
        {onNavigate && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-amber-200 dark:border-amber-700 rounded-full shadow-lg px-2 py-2">
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-amber-800 dark:text-amber-200 font-amiri">
            المصحف الشريف
          </h1>
          <p className="text-amber-600 dark:text-amber-300">فهرس سور القرآن الكريم</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="ابحث عن سورة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-right border-amber-300 focus:border-amber-500"
            dir="rtl"
          />
        </div>

        {/* Surahs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSurahs.map((surah) => (
            <Card 
              key={surah.id} 
              className="shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group border-amber-200 hover:border-amber-400"
              onClick={() => openSurah(surah)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-full flex items-center justify-center font-bold">
                      {surah.id}
                    </div>
                    <div className="text-right" dir="rtl">
                      <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-1 font-amiri">
                        {surah.name_ar}
                      </h3>
                      <p className="text-sm text-amber-600 dark:text-amber-400">{surah.name_en}</p>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 mb-1">
                      <BookOpen className="h-4 w-4" />
                      {surah.ayah_count} آية
                    </div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">
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