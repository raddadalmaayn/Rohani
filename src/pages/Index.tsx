import { useState } from 'react';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { AskScripture } from '@/components/AskScripture';
import { BookmarksView } from '@/components/BookmarksView';
import { UserDashboard } from '@/components/UserDashboard';
import { IslamicCalendarView } from '@/components/IslamicCalendarView';
import { QuranPage } from '@/components/QuranPage';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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

  const handleOnboardingComplete = (data: OnboardingData) => {
    setUserData(data);
    setIsOnboarded(true);
  };

  const handleSignOut = () => {
    setIsOnboarded(false);
    setUserData(null);
  };

  // Show beautiful onboarding with ayat if not completed
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
      case 'quran':
        return <QuranPage />;
      case 'bookmarks':
        return <BookmarksView />;
      case 'dashboard':
        return <UserDashboard />;
      case 'calendar':
        return <IslamicCalendarView />;
      case 'profile':
        return (
          <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">👤</div>
              <h2 className="text-2xl font-bold mb-4 font-arabic">الملف الشخصي</h2>
              <p className="text-muted-foreground mb-6 font-arabic">مرحباً بك في روحاني</p>
              <Button onClick={handleSignOut} variant="outline" className="font-arabic">
                إعادة بدء التطبيق
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Full-screen layout for Quran page
  if (currentView === 'quran') {
    return <QuranPage onNavigate={setCurrentView} />;
  }

  return (
    <div className="relative">
      {/* Header with hero image */}
      <div 
        className="h-32 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-primary/20" />
        <div className="absolute bottom-4 left-4 text-white">
          <h1 className="text-2xl font-bold font-arabic">روحاني</h1>
          <p className="text-white/90 font-arabic">دقيقة سكينة… كلما تعب قلبك</p>
        </div>
        <div className="absolute top-4 right-4">
          <ThemeToggle />
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