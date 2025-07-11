import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { HomeFeed } from '@/components/HomeFeed';
import { AskScripture } from '@/components/AskScripture';
import { TestEmbeddings } from '@/components/TestEmbeddings';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-spiritual.jpg';
import type { User, Session } from '@supabase/supabase-js';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [currentView, setCurrentView] = useState('feed');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleOnboardingComplete = (data: OnboardingData) => {
    setUserData(data);
    setIsOnboarded(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🕊️</div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🕊️</div>
          <h1 className="text-3xl font-bold mb-4">روحاني</h1>
          <p className="text-muted-foreground mb-6">دقيقة سكينة… كلما تعب قلبك</p>
          <Button onClick={() => navigate('/auth')} size="lg">
            تسجيل الدخول / إنشاء حساب
          </Button>
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
      case 'feed':
        return (
          <HomeFeed 
            language={userData.language}
            tradition={userData.tradition}
            goal={userData.goal}
          />
        );
      case 'scripture':
        return (
          <AskScripture 
            language={userData.language}
            tradition={userData.tradition}
          />
        );
      case 'stats':
        return (
          <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-2">الإحصائيات</h2>
              <p className="text-muted-foreground">قريباً - تتبع تقدمك الروحي</p>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold mb-4">الملف الشخصي</h2>
              <p className="text-muted-foreground mb-6">مرحباً {user.email}</p>
              <Button onClick={handleSignOut} variant="outline">
                تسجيل الخروج
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
      {/* Header with hero image for non-feed views */}
      {currentView !== 'feed' && (
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
      )}

      {/* Main Content */}
      <div className={currentView !== 'feed' ? 'pb-20' : ''}>
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
