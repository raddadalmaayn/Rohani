import { Button } from '@/components/ui/button';
import { Home, Search, BarChart3, User, Heart, Calendar, TrendingUp, BookOpen } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const navItems = [
    { id: 'scripture', label: 'اسأل القرآن', icon: Search },
    { id: 'quran', label: 'المصحف', icon: BookOpen },
    { id: 'calendar', label: 'التقويم', icon: Calendar },
    { id: 'dashboard', label: 'إحصائيات', icon: TrendingUp },
    { id: 'profile', label: 'الملف', icon: User }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto px-2 py-2">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={`flex flex-col gap-1 h-auto py-2 px-2 min-w-0 text-xs ${
                  isActive ? 'bg-primary text-primary-foreground' : ''
                }`}
                onClick={() => onViewChange(item.id)}
              >
                <IconComponent className="h-4 w-4" />
                <span className="text-xs font-arabic leading-none">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}