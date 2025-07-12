import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar,
  Star,
  BookOpen,
  Heart,
  Clock,
  Church
} from 'lucide-react';
import { useIslamicCalendar } from '@/hooks/use-islamic-calendar';

export function IslamicCalendarView() {
  const { events, isLoading, getEventsByType } = useIslamicCalendar();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-calm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 font-arabic">التقويم الإسلامي</h1>
            <p className="text-muted-foreground">جاري تحميل الأحداث...</p>
          </div>
        </div>
      </div>
    );
  }

  const religiousEvents = getEventsByType('religious');

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'religious':
        return <Church className="h-5 w-5 text-green-600" />;
      case 'historical':
        return <BookOpen className="h-5 w-5 text-blue-600" />;
      default:
        return <Calendar className="h-5 w-5 text-purple-600" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'religious':
        return 'border-l-green-500 bg-green-50/50';
      case 'historical':
        return 'border-l-blue-500 bg-blue-50/50';
      default:
        return 'border-l-purple-500 bg-purple-50/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calendar className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-arabic">التقويم الإسلامي</h1>
          </div>
          <p className="text-muted-foreground font-arabic">الأحداث والمناسبات الإسلامية المهمة</p>
        </div>

        {/* Events List */}
        <div className="space-y-6">
          {religiousEvents.map((event) => (
            <Card key={event.id} className={`shadow-spiritual border-l-4 ${getEventTypeColor(event.event_type)}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getEventIcon(event.event_type)}
                    <span className="font-arabic text-xl">{event.event_name}</span>
                  </div>
                  <Badge variant="outline" className="font-arabic">
                    {event.hijri_date}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.description && (
                  <p className="text-muted-foreground font-arabic leading-relaxed">
                    {event.description}
                  </p>
                )}

                {event.significance && (
                  <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-lg border-r-4 border-r-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="font-semibold font-arabic">الأهمية الروحية</span>
                    </div>
                    <p className="text-sm font-arabic leading-relaxed" dir="rtl">
                      {event.significance}
                    </p>
                  </div>
                )}

                {event.recommended_actions && event.recommended_actions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-semibold font-arabic">الأعمال المستحبة</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {event.recommended_actions.map((action, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <span className="font-arabic">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {event.related_verses && event.related_verses.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold font-arabic">الآيات ذات الصلة</span>
                    </div>
                    <ScrollArea className="h-20">
                      <div className="flex flex-wrap gap-2">
                        {event.related_verses.map((verse, index) => (
                          <Badge key={index} variant="secondary" className="font-arabic">
                            {verse}
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {events.length === 0 && (
          <Card className="shadow-gentle">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2 font-arabic">لا توجد أحداث</h3>
              <p className="text-muted-foreground font-arabic">
                لم يتم العثور على أحداث في التقويم الإسلامي حالياً
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}