import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, BookOpen, Trash2, Search } from 'lucide-react';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { ScriptureCard } from '@/components/ScriptureCard';

export function BookmarksView() {
  const { bookmarks, isLoading, removeBookmark, refreshBookmarks } = useBookmarks();

  const handleRemoveBookmark = async (bookmarkId: string) => {
    await removeBookmark(bookmarkId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-calm p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 font-arabic">المفضلة</h1>
            <p className="text-muted-foreground">جاري تحميل النصوص المحفوظة...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-arabic">المفضلة</h1>
          </div>
          <p className="text-muted-foreground">النصوص الروحية المحفوظة</p>
        </div>

        {/* Bookmarks List */}
        {bookmarks.length > 0 ? (
          <div className="space-y-6">
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id}>
                <ScriptureCard
                  scripture={{
                    id: bookmark.scripture_id,
                    source_ref: bookmark.scripture.source_ref,
                    text_ar: bookmark.scripture.text_ar,
                    text_type: bookmark.scripture.text_type as 'quran' | 'hadith',
                    chapter_name: bookmark.scripture.chapter_name,
                    verse_number: bookmark.scripture.verse_number,
                  }}
                  showBookmarkButton={false}
                  isBookmarkView={true}
                  onRemoveFromBookmarks={() => handleRemoveBookmark(bookmark.id)}
                />
                {bookmark.notes && (
                  <Card className="mt-2 bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground mt-1" />
                        <p className="text-sm text-muted-foreground font-arabic" dir="rtl">
                          {bookmark.notes}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="shadow-gentle">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">💖</div>
              <h3 className="text-xl font-semibold mb-2 font-arabic">لا توجد نصوص محفوظة</h3>
              <p className="text-muted-foreground mb-4">
                ابحث عن النصوص الروحية واحفظها في المفضلة
              </p>
              <Button 
                onClick={refreshBookmarks}
                variant="outline"
                className="font-arabic"
              >
                <Search className="h-4 w-4 mr-2" />
                تحديث
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}