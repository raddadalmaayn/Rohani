import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Languages, Heart, Zap, Users } from 'lucide-react';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    language: '',
    tradition: '',
    goal: ''
  });

  const languages = [
    { id: 'ar', name: 'العربية', flag: '🇸🇦' },
    { id: 'en', name: 'English', flag: '🇺🇸' },
    { id: 'he', name: 'עברית', flag: '🇮🇱' }
  ];

  const traditions = [
    { id: 'islam', name: 'الإسلام', icon: '☪️', description: 'القرآن والسنة' },
    { id: 'christian', name: 'المسيحية', icon: '✝️', description: 'الكتاب المقدس' },
    { id: 'jewish', name: 'اليهودية', icon: '✡️', description: 'التوراة والتلمود' },
    { id: 'universal', name: 'عام', icon: '🌟', description: 'حكمة روحية شاملة' }
  ];

  const goals = [
    { 
      id: 'reduce-scroll', 
      title: 'تقليل التمرير', 
      description: 'أريد قضاء وقت أقل على التيك توك والريلز',
      icon: Zap 
    },
    { 
      id: 'inner-calm', 
      title: 'السكينة الداخلية', 
      description: 'أبحث عن السلام والهدوء النفسي',
      icon: Heart 
    },
    { 
      id: 'fill-void', 
      title: 'ملء الفراغ الروحي', 
      description: 'أريد المحتوى الذي يغذي روحي',
      icon: Users 
    }
  ];

  const handleLanguageSelect = (languageId: string) => {
    setData(prev => ({ ...prev, language: languageId }));
    setStep(1);
  };

  const handleTraditionSelect = (traditionId: string) => {
    setData(prev => ({ ...prev, tradition: traditionId }));
    setStep(2);
  };

  const handleGoalSelect = (goalId: string) => {
    const finalData = { ...data, goal: goalId };
    setData(finalData);
    onComplete(finalData);
  };

  const steps = [
    {
      title: 'اختر لغتك',
      subtitle: 'Choose your language',
      content: (
        <div className="grid gap-4">
          {languages.map((lang) => (
            <Button
              key={lang.id}
              variant="outline"
              size="lg"
              onClick={() => handleLanguageSelect(lang.id)}
              className="h-16 text-lg justify-start gap-4 hover:bg-gradient-calm"
            >
              <span className="text-2xl">{lang.flag}</span>
              <span>{lang.name}</span>
            </Button>
          ))}
        </div>
      )
    },
    {
      title: 'اختر تقليدك الروحي',
      subtitle: 'Choose your spiritual tradition',
      content: (
        <div className="grid gap-4">
          {traditions.map((tradition) => (
            <Card 
              key={tradition.id}
              className="cursor-pointer hover:shadow-gentle transition-all duration-300 hover:scale-[1.02]"
              onClick={() => handleTraditionSelect(tradition.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{tradition.icon}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{tradition.name}</h3>
                    <p className="text-muted-foreground">{tradition.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: 'ما هدفك؟',
      subtitle: 'What is your goal?',
      content: (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const IconComponent = goal.icon;
            return (
              <Card 
                key={goal.id}
                className="cursor-pointer hover:shadow-spiritual transition-all duration-300 hover:scale-[1.02]"
                onClick={() => handleGoalSelect(goal.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{goal.title}</h3>
                      <p className="text-muted-foreground">{goal.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )
    }
  ];

  const currentStep = steps[step];

  return (
    <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-spiritual">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Badge variant="secondary" className="px-4 py-2">
              {step + 1} من 3
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold">{currentStep.title}</CardTitle>
          <CardDescription className="text-base">{currentStep.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep.content}
        </CardContent>
      </Card>
    </div>
  );
}