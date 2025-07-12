import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      
      toast({
        title: 'بدء التسجيل',
        description: 'اتحدث الآن...',
      });
    } catch (error) {
      console.error('Error starting voice recording:', error);
      toast({
        title: 'خطأ في التسجيل',
        description: 'تأكد من السماح للتطبيق بالوصول للميكروفون',
        variant: 'destructive',
      });
    }
  };

  const stopListening = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              
              const { data, error } = await supabase.functions.invoke('voice-to-text', {
                body: { audio: base64Audio }
              });

              if (error) {
                throw new Error(error.message);
              }

              setIsProcessing(false);
              
              if (data?.text) {
                toast({
                  title: 'تم التحويل بنجاح',
                  description: 'تم تحويل الصوت إلى نص',
                });
                resolve(data.text);
              } else {
                throw new Error('لم يتم التعرف على الصوت');
              }
            } catch (error) {
              setIsProcessing(false);
              console.error('Voice processing error:', error);
              toast({
                title: 'خطأ في معالجة الصوت',
                description: 'حاول مرة أخرى أو استخدم الكتابة',
                variant: 'destructive',
              });
              resolve(null);
            }
          };

          reader.readAsDataURL(audioBlob);
        } catch (error) {
          setIsProcessing(false);
          console.error('Audio processing error:', error);
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    });
  };

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
  };
}