import { useState, useEffect } from 'react';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { AskScripture } from '@/components/AskScripture';
import { TestEmbeddings } from '@/components/TestEmbeddings';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import heroImage from '@/assets/hero-spiritual.jpg';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [currentView, setCurrentView] = useState('scripture');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const handleOnboardingComplete = async (data: OnboardingData) => {
    if (!user) return;
    
    try {
      // Update profile with onboarding data
      const { error } = await supabase
        .from('profiles')
        .update({
          spiritual_tradition: data.tradition,
          spiritual_goal: data.goal,
          language: data.language
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setUserData(data);
      setIsOnboarded(true);
      toast({
        title: "تم حفظ بياناتك بنجاح",
        description: "يمكنك الآن استخدام التطبيق"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في حفظ البيانات",
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsOnboarded(false);
    setUserData(null);
  };

  const createAnonymousUser = async () => {
    try {
      setLoading(true);
      
      // Create anonymous user session
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) throw authError;

      toast({
        title: "مرحباً بك",
        description: "تم إنشاء حسابك بنجاح"
      });
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في إنشاء الحساب",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      setProfile(profileData);
      
      // Check if user has completed onboarding
      if (profileData.spiritual_tradition && profileData.spiritual_goal && profileData.language) {
        setUserData({
          tradition: profileData.spiritual_tradition,
          goal: profileData.spiritual_goal,
          language: profileData.language
        });
        setIsOnboarded(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🕊️</div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    // Auto-create anonymous user if none exists
    if (!loading) {
      createAnonymousUser();
    }
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🕊️</div>
          <h1 className="text-3xl font-bold mb-4">روحاني</h1>
          <p className="text-muted-foreground mb-6">دقيقة سكينة… كلما تعب قلبك</p>
          <p className="text-muted-foreground">جاري إنشاء حسابك...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (!isOnboarded) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Render main app
  const renderCurrentView = () => {
    if (!userData) return null;

    switch (currentView) {
      case 'scripture':
        return (
          <AskScripture 
            language={userData.language}
            tradition={userData.tradition}
          />
        );
      case 'profile':
        return (
          <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold mb-4">الملف الشخصي</h2>
              <p className="text-muted-foreground mb-6">مرحباً {profile?.username || profile?.display_name || 'المستخدم'}</p>
              <Button onClick={handleSignOut} variant="outline">
                تغيير الاسم
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Header with hero image */}
      <div 
        className="h-32 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-primary/20" />
        <div className="absolute bottom-4 left-4 text-white">
          <h1 className="text-2xl font-bold">روحاني</h1>
          <p className="text-white/90">دقيقة سكينة… كلما تعب قلبك</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-20">
        {renderCurrentView()}
      </div>

      {/* Bottom Navigation */}
      <Navigation 
        currentView={currentView}
        onViewChange={setCurrentView}
      />
    </div>
  );
};

export default Index;
