import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, BookmarkCheck, Heart, Share2, Trash2 } from 'lucide-react';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { VerseFeedback } from './VerseFeedback';

interface ScriptureCardProps {
  scripture: {
    id: string;
    source_ref: string;
    text_ar: string;
    text_type: 'quran' | 'hadith';
    chapter_name: string | null;
    verse_number: number | null;
    similarity?: number;
  };
  showBookmarkButton?: boolean;
  isBookmarkView?: boolean;
  onRemoveFromBookmarks?: (id: string) => void;
  query?: string; // For feedback tracking
}

export function ScriptureCard({ 
  scripture, 
  showBookmarkButton = true, 
  isBookmarkView = false,
  onRemoveFromBookmarks,
  query 
}: ScriptureCardProps) {
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarks();
  const [bookmarkStatus, setBookmarkStatus] = useState<boolean | null>(null);
  const { toast } = useToast();

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


  const handleBookmark = async () => {
    if (bookmarkStatus === null) {
      const status = await isBookmarked(scripture.id);
      setBookmarkStatus(status);
    }

    if (bookmarkStatus) {
      // Remove bookmark logic would need bookmark ID
      toast({
        title: 'محفوظ مسبقاً',
        description: 'هذا النص محفوظ في المفضلة',
      });
    } else {
      const success = await addBookmark(scripture.id);
      if (success) {
        setBookmarkStatus(true);
      }
    }
  };

  const handleShare = async () => {
    const shareText = `${scripture.text_ar}\n\n${scripture.source_ref}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: getTypeName(scripture.text_type),
          text: shareText,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: 'تم النسخ',
          description: 'تم نسخ النص إلى الحافظة',
        });
      } catch (error) {
        toast({
          title: 'خطأ في النسخ',
          description: 'لم نتمكن من نسخ النص',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Card className="shadow-gentle hover:shadow-spiritual transition-shadow duration-300 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getTypeIcon(scripture.text_type)}</span>
            <Badge variant="secondary" className="text-xs">
              {getTypeName(scripture.text_type)}
            </Badge>
            {scripture.similarity && (
              <Badge variant="outline" className="text-xs">
                {Math.round(scripture.similarity * 100)}% مطابقة
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {showBookmarkButton && (
              <Button
                onClick={handleBookmark}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary"
              >
                {bookmarkStatus ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            )}
            {isBookmarkView && onRemoveFromBookmarks && (
              <Button
                onClick={() => onRemoveFromBookmarks(scripture.id)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleShare}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-lg leading-relaxed text-right font-quran" dir="rtl">
            {scripture.text_ar}
          </p>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-4">
              <span className="font-medium">{scripture.source_ref}</span>
              {scripture.chapter_name && (
                <span>{scripture.chapter_name}</span>
              )}
              {scripture.verse_number && (
                <span>الآية {scripture.verse_number}</span>
              )}
            </div>
            {query && (
              <VerseFeedback 
                verseRef={scripture.source_ref} 
                query={query}
                className="mr-auto"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}