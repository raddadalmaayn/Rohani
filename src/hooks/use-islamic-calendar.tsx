import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IslamicEvent {
  id: string;
  event_name: string;
  event_type: string;
  hijri_date: string;
  gregorian_date: string | null;
  description: string | null;
  significance: string | null;
  recommended_actions: string[];
  related_verses: string[];
  is_recurring: boolean;
}

export function useIslamicCalendar() {
  const [events, setEvents] = useState<IslamicEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('islamic_events')
        .select('*')
        .order('hijri_date');

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching Islamic events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUpcomingEvents = (limit = 3) => {
    return events.slice(0, limit);
  };

  const getEventsByType = (type: string) => {
    return events.filter(event => event.event_type === type);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    isLoading,
    getUpcomingEvents,
    getEventsByType,
    refreshEvents: fetchEvents,
  };
}