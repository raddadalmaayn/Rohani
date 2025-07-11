import { useState, useEffect } from 'react';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { HomeFeed } from '@/components/HomeFeed';
import { AskScripture } from '@/components/AskScripture';
import { TestEmbeddings } from '@/components/TestEmbeddings';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-spiritual.jpg';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

const Index = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [currentView, setCurrentView] = useState('feed');

  const handleOnboardingComplete = (data: OnboardingData) => {
    setUserData(data);
    setIsOnboarded(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem('username');
    setUsername('');
    setIsOnboarded(false);
    setUserData(null);
  };

  // Show username input if no username is stored
  const [username, setUsername] = useState<string>('');
  const [inputUsername, setInputUsername] = useState<string>('');
  
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  if (!username) {
    return (
      <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🕊️</div>
          <h1 className="text-3xl font-bold mb-4">روحاني</h1>
          <p className="text-muted-foreground mb-6">دقيقة سكينة… كلما تعب قلبك</p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="اكتب اسمك"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-input bg-background text-foreground text-center"
              dir="rtl"
            />
            <Button 
              onClick={() => {
                if (inputUsername.trim()) {
                  localStorage.setItem('username', inputUsername.trim());
                  setUsername(inputUsername.trim());
                }
              }}
              size="lg"
              disabled={!inputUsername.trim()}
            >
              ابدأ الرحلة
            </Button>
          </div>
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
              <p className="text-muted-foreground mb-6">مرحباً {username}</p>
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
