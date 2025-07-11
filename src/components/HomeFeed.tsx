import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Share2, Play, Pause } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Video {
  id: string;
  title: string;
  creator: string;
  tags: string[];
  thumbnail: string;
  duration: string;
  tradition: string;
}

interface HomeFeedProps {
  language: string;
  tradition: string;
  goal: string;
}

export function HomeFeed({ language, tradition, goal }: HomeFeedProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [showLimiter, setShowLimiter] = useState(false);
  const [isBreathing, setIsBreathing] = useState(false);

  // Mock spiritual video data
  const mockVideos: Video[] = [
    {
      id: '1',
      title: 'دقيقة تأمل: آية الكرسي',
      creator: 'الشيخ محمد',
      tags: ['تلاوة', 'سكينة', 'تأمل'],
      thumbnail: '/api/placeholder/400/711',
      duration: '1:20',
      tradition: 'islam'
    },
    {
      id: '2', 
      title: 'لحظة صمت مع الطبيعة',
      creator: 'فريق روحاني',
      tags: ['طبيعة', 'هدوء', 'تأمل'],
      thumbnail: '/api/placeholder/400/711',
      duration: '0:45',
      tradition: 'universal'
    },
    {
      id: '3',
      title: 'دعاء الراحة النفسية',
      creator: 'أم أحمد',
      tags: ['دعاء', 'راحة', 'شفاء'],
      thumbnail: '/api/placeholder/400/711',
      duration: '2:10',
      tradition: 'islam'
    },
    {
      id: '4',
      title: 'حكمة اليوم: الصبر مفتاح الفرج',
      creator: 'دار الحكمة',
      tags: ['حكمة', 'صبر', 'أمل'],
      thumbnail: '/api/placeholder/400/711',
      duration: '1:30',
      tradition: 'universal'
    },
    {
      id: '5',
      title: 'تسبيح الفجر مع الطيور',
      creator: 'الطبيعة الروحية',
      tags: ['تسبيح', 'فجر', 'طيور'],
      thumbnail: '/api/placeholder/400/711',
      duration: '3:00',
      tradition: 'islam'
    }
  ];

  useEffect(() => {
    // Filter videos based on user preferences
    const filteredVideos = mockVideos.filter(video => 
      video.tradition === tradition || video.tradition === 'universal'
    );
    setVideos(filteredVideos);
  }, [tradition]);

  const handleVideoView = () => {
    const newCount = videoCount + 1;
    setVideoCount(newCount);
    
    if (newCount >= 10) {
      setShowLimiter(true);
    }
  };

  const nextVideo = () => {
    if (currentVideo < videos.length - 1) {
      setCurrentVideo(currentVideo + 1);
      handleVideoView();
    }
  };

  const prevVideo = () => {
    if (currentVideo > 0) {
      setCurrentVideo(currentVideo - 1);
    }
  };

  const handleBreathing = () => {
    setIsBreathing(true);
    setShowLimiter(false);
    
    // Reset video count after breathing exercise
    setTimeout(() => {
      setVideoCount(0);
      setIsBreathing(false);
    }, 30000); // 30 second breathing break
  };

  if (videos.length === 0) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  const video = videos[currentVideo];

  return (
    <div className="min-h-screen bg-background">
      {/* Video Player Area */}
      <div className="relative h-screen max-w-md mx-auto bg-black">
        {/* Video Thumbnail/Player */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${video.thumbnail})` }}
        >
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Video Overlay Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="text-white">
            <h2 className="text-xl font-bold mb-2">{video.title}</h2>
            <p className="text-white/80 mb-3">بواسطة {video.creator}</p>
            
            {/* Tags */}
            <div className="flex gap-2 mb-4">
              {video.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="bg-white/20 text-white">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Heart className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Share2 className="h-6 w-6" />
              </Button>
              <div className="ml-auto text-white/80">
                {video.duration}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={prevVideo}
            className="text-white hover:bg-white/20"
            disabled={currentVideo === 0}
          >
            ↑
          </Button>
        </div>
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={nextVideo}
            className="text-white hover:bg-white/20"
            disabled={currentVideo === videos.length - 1}
          >
            ↓
          </Button>
        </div>

        {/* Video Counter */}
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-black/50 text-white">
            {videoCount}/10 فيديو
          </Badge>
        </div>
      </div>

      {/* Feed Limiter Dialog */}
      <Dialog open={showLimiter} onOpenChange={setShowLimiter}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-4">خذ دقيقة صمت 🌱</DialogTitle>
            <DialogDescription className="text-lg">
              لقد شاهدت 10 فيديوهات. حان وقت التأمل والتنفس العميق.
            </DialogDescription>
          </DialogHeader>
          
          {/* Breathing Animation Placeholder */}
          <div className="my-8">
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-spiritual animate-pulse flex items-center justify-center">
              <div className="text-white text-lg font-bold">تنفس</div>
            </div>
          </div>

          <Button onClick={handleBreathing} variant="spiritual" size="lg">
            ابدأ تمرين التنفس
          </Button>
        </DialogContent>
      </Dialog>

      {/* Breathing Exercise */}
      <Dialog open={isBreathing} onOpenChange={() => {}}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-4">تمرين التنفس العميق</DialogTitle>
          </DialogHeader>
          
          <div className="my-8">
            <div className="w-40 h-40 mx-auto rounded-full bg-gradient-spiritual animate-ping flex items-center justify-center">
              <div className="text-white text-xl font-bold">اهدأ</div>
            </div>
          </div>

          <p className="text-lg text-muted-foreground">
            استمع لأنفاسك... اشعر بالسكينة تملأ قلبك
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}