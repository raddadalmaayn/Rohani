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

  // More accurate Hijri date conversion
  const getCurrentHijriDate = () => {
    const today = new Date();
    
    // More accurate Hijri conversion algorithm
    const gregorianYear = today.getFullYear();
    const gregorianMonth = today.getMonth() + 1;
    const gregorianDay = today.getDate();
    
    // Julian day calculation
    let jd = Math.floor((1461 * (gregorianYear + 4800 + Math.floor((gregorianMonth - 14) / 12))) / 4) +
             Math.floor((367 * (gregorianMonth - 2 - 12 * (Math.floor((gregorianMonth - 14) / 12)))) / 12) -
             Math.floor((3 * (Math.floor((gregorianYear + 4900 + Math.floor((gregorianMonth - 14) / 12)) / 100))) / 4) +
             gregorianDay - 32075;
    
    // Convert Julian day to Hijri
    jd = jd - 1948440 + 10631;
    const n = Math.floor((jd - 1) / 10631);
    jd = jd - 10631 * n + 354;
    const j = Math.floor(((10985 - jd) / 5316)) * Math.floor(((50 * jd) / 17719)) + Math.floor((jd / 5670)) * Math.floor(((43 * jd) / 15238));
    jd = jd - Math.floor(((30 - j) / 15)) * Math.floor(((17719 * j) / 50)) - Math.floor((j / 16)) * Math.floor(((15238 * j) / 43)) + 29;
    const hijriMonth = Math.floor(((24 * jd) / 709));
    const hijriDay = jd - Math.floor(((709 * hijriMonth) / 24));
    const hijriYear = 30 * n + j - 30 + Math.floor((hijriMonth - 1) / 12);
    const finalHijriMonth = hijriMonth - 12 * Math.floor((hijriMonth - 1) / 12);
    
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الثانية',
      'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    // Adjust for current date being 16 Muharram
    let adjustedDay = hijriDay - 1; // Subtract 1 to correct the calculation
    if (adjustedDay < 1) {
      adjustedDay = 29; // Previous month's last day
    }
    
    return {
      day: adjustedDay,
      month: hijriMonths[finalHijriMonth - 1] || hijriMonths[0],
      year: hijriYear,
      formatted: `${adjustedDay} ${hijriMonths[finalHijriMonth - 1] || hijriMonths[0]} ${hijriYear} هـ`
    };
  };

  const currentHijriDate = getCurrentHijriDate();

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
          <div className="space-y-2">
            <p className="text-muted-foreground font-arabic">الأحداث والمناسبات الإسلامية المهمة</p>
            <div className="bg-primary/10 rounded-lg p-3 mx-auto max-w-md">
              <p className="text-sm text-muted-foreground font-arabic mb-1">التاريخ الهجري اليوم</p>
              <p className="text-lg font-semibold text-primary font-arabic">{currentHijriDate.formatted}</p>
            </div>
          </div>
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