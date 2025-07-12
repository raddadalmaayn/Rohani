import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  BookOpen, 
  Search, 
  Heart, 
  Calendar,
  Trophy,
  Flame,
  Star
} from 'lucide-react';
import { useUserProgress } from '@/hooks/use-user-progress';

export function UserDashboard() {
  const { progress, isLoading } = useUserProgress();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-calm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 font-arabic">لوحة التحكم</h1>
            <p className="text-muted-foreground">جاري تحميل إحصائياتك...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="min-h-screen bg-gradient-calm p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 font-arabic">لوحة التحكم</h1>
            <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
          </div>
        </div>
      </div>
    );
  }

  const getSpiritalLevelName = (level: number) => {
    const levels = [
      'مبتدئ في الرحلة',
      'طالب علم',
      'باحث عن الحق',
      'متأمل',
      'ذاكر',
      'تائب',
      'مؤمن',
      'عابد',
      'زاهد',
      'ولي صالح'
    ];
    return levels[Math.min(level - 1, levels.length - 1)] || 'مبتدئ في الرحلة';
  };

  const nextLevelPoints = progress.spiritual_level * 100;
  const currentLevelProgress = (progress.experience_points % 100);

  return (
    <div className="min-h-screen bg-gradient-calm p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-arabic">لوحة التحكم</h1>
          </div>
          <p className="text-muted-foreground font-arabic">رحلتك الروحية في أرقام</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Spiritual Level */}
          <Card className="shadow-spiritual border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-arabic">
                <Star className="h-5 w-5 text-primary" />
                المستوى الروحي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-primary mb-2">{progress.spiritual_level}</div>
                <p className="text-sm text-muted-foreground font-arabic">
                  {getSpiritalLevelName(progress.spiritual_level)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-arabic">التقدم للمستوى التالي</span>
                  <span>{currentLevelProgress}/100</span>
                </div>
                <Progress value={currentLevelProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Streak Days */}
          <Card className="shadow-gentle border-l-4 border-l-orange-400">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-arabic">
                <Flame className="h-5 w-5 text-orange-400" />
                أيام التواصل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {progress.streak_days}
                </div>
                <p className="text-sm text-muted-foreground font-arabic">
                  {progress.streak_days === 1 ? 'يوم متواصل' : 'أيام متواصلة'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Experience Points */}
          <Card className="shadow-gentle border-l-4 border-l-purple-400">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-arabic">
                <Trophy className="h-5 w-5 text-purple-400" />
                نقاط الخبرة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {progress.experience_points}
                </div>
                <p className="text-sm text-muted-foreground font-arabic">نقطة</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-gentle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-arabic">
                <Search className="h-5 w-5 text-blue-500" />
                إحصائيات البحث
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {progress.total_searches}
              </div>
              <p className="text-sm text-muted-foreground font-arabic">
                إجمالي عمليات البحث
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-gentle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-arabic">
                <Heart className="h-5 w-5 text-red-500" />
                النصوص المحفوظة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 mb-2">
                {progress.total_bookmarks}
              </div>
              <p className="text-sm text-muted-foreground font-arabic">
                النصوص في المفضلة
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Favorite Topics */}
        {progress.favorite_topics && progress.favorite_topics.length > 0 && (
          <Card className="shadow-gentle mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-arabic">
                <BookOpen className="h-5 w-5 text-green-500" />
                المواضيع المفضلة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {progress.favorite_topics.map((topic, index) => (
                  <Badge key={index} variant="secondary" className="font-arabic">
                    {topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        <Card className="shadow-spiritual">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-arabic">
              <Trophy className="h-5 w-5 text-yellow-500" />
              الإنجازات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {progress.total_searches >= 10 && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl">🔍</div>
                  <div>
                    <h4 className="font-medium font-arabic">باحث مجتهد</h4>
                    <p className="text-sm text-muted-foreground font-arabic">
                      أجريت 10 عمليات بحث
                    </p>
                  </div>
                </div>
              )}
              
              {progress.total_bookmarks >= 5 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl">❤️</div>
                  <div>
                    <h4 className="font-medium font-arabic">جامع الحكمة</h4>
                    <p className="text-sm text-muted-foreground font-arabic">
                      حفظت 5 نصوص في المفضلة
                    </p>
                  </div>
                </div>
              )}

              {progress.streak_days >= 7 && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-2xl">🔥</div>
                  <div>
                    <h4 className="font-medium font-arabic">مواظب على الخير</h4>
                    <p className="text-sm text-muted-foreground font-arabic">
                      7 أيام متواصلة من النشاط
                    </p>
                  </div>
                </div>
              )}

              {progress.spiritual_level >= 5 && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-2xl">⭐</div>
                  <div>
                    <h4 className="font-medium font-arabic">سالك متقدم</h4>
                    <p className="text-sm text-muted-foreground font-arabic">
                      وصلت للمستوى الروحي 5
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}