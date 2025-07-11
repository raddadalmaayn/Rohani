import { Button } from '@/components/ui/button';
import { Home, Search, BarChart3, User } from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const navItems = [
    { id: 'feed', label: 'الرئيسية', icon: Home },
    { id: 'scripture', label: 'نصوص', icon: Search },
    { id: 'stats', label: 'إحصائيات', icon: BarChart3 },
    { id: 'profile', label: 'الملف', icon: User }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
      <div className="max-w-md mx-auto px-4 py-2">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={`flex flex-col gap-1 h-auto py-2 px-3 min-w-0 ${
                  isActive ? 'bg-primary text-primary-foreground' : ''
                }`}
                onClick={() => onViewChange(item.id)}
              >
                <IconComponent className="h-5 w-5" />
                <span className="text-xs">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}