import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Zap, Users } from 'lucide-react';

interface OnboardingData {
  language: string;
  tradition: string;
  goal: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [data, setData] = useState<OnboardingData>({
    language: 'ar',
    tradition: 'islam',
    goal: ''
  });

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

  const handleGoalSelect = (goalId: string) => {
    const finalData = { ...data, goal: goalId };
    setData(finalData);
    onComplete(finalData);
  };

  return (
    <div className="min-h-screen bg-gradient-calm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-spiritual">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">ما هدفك؟</CardTitle>
          <CardDescription className="text-base">What is your goal?</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}