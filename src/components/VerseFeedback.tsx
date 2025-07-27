import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VerseFeedbackProps {
  verseRef: string;
  query: string;
  className?: string;
}

export const VerseFeedback = ({ verseRef, query, className }: VerseFeedbackProps) => {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const submitFeedback = async (isHelpful: boolean) => {
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "التسجيل مطلوب",
          description: "يرجى تسجيل الدخول لتقديم التقييم",
          variant: "destructive"
        });
        return;
      }

      // Check if user already gave feedback for this verse+query combination
      const { data: existing } = await supabase
        .from('verse_feedback')
        .select('id')
        .eq('user_id', user.id)
        .eq('verse_id', verseRef)
        .eq('query', query)
        .single();

      if (existing) {
        // Update existing feedback
        const { error } = await supabase
          .from('verse_feedback')
          .update({ is_helpful: isHelpful })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new feedback
        const { error } = await supabase
          .from('verse_feedback')
          .insert({
            user_id: user.id,
            verse_id: verseRef,
            query,
            is_helpful: isHelpful
          });

        if (error) throw error;
      }

      setFeedback(isHelpful);
      toast({
        title: isHelpful ? "شكراً لك!" : "شكراً لتقييمك",
        description: isHelpful 
          ? "تقييمك يساعدنا في تحسين النتائج" 
          : "سنعمل على تحسين جودة النتائج",
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في إرسال التقييم",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">مفيد؟</span>
      <Button
        variant={feedback === true ? "default" : "outline"}
        size="sm"
        onClick={() => submitFeedback(true)}
        disabled={isSubmitting}
        className="h-8 w-8 p-0"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant={feedback === false ? "default" : "outline"}
        size="sm"
        onClick={() => submitFeedback(false)}
        disabled={isSubmitting}
        className="h-8 w-8 p-0"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
};