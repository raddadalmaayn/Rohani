export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          scripture_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          scripture_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          scripture_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_scripture_id_fkey"
            columns: ["scripture_id"]
            isOneToOne: false
            referencedRelation: "scripture"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reminders: {
        Row: {
          content: string
          created_at: string
          days_of_week: number[]
          id: string
          is_active: boolean | null
          reminder_type: string
          scheduled_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          days_of_week: number[]
          id?: string
          is_active?: boolean | null
          reminder_type: string
          scheduled_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          days_of_week?: number[]
          id?: string
          is_active?: boolean | null
          reminder_type?: string
          scheduled_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hadith: {
        Row: {
          created_at: string
          embedding: string | null
          has_dua: boolean | null
          id: string
          source_ref: string
          text_ar: string
          text_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          has_dua?: boolean | null
          id?: string
          source_ref: string
          text_ar: string
          text_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          has_dua?: boolean | null
          id?: string
          source_ref?: string
          text_ar?: string
          text_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      islamic_events: {
        Row: {
          created_at: string
          description: string | null
          event_name: string
          event_type: string
          gregorian_date: string | null
          hijri_date: string
          id: string
          is_recurring: boolean | null
          recommended_actions: string[] | null
          related_verses: string[] | null
          significance: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_name: string
          event_type: string
          gregorian_date?: string | null
          hijri_date: string
          id?: string
          is_recurring?: boolean | null
          recommended_actions?: string[] | null
          related_verses?: string[] | null
          significance?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_name?: string
          event_type?: string
          gregorian_date?: string | null
          hijri_date?: string
          id?: string
          is_recurring?: boolean | null
          recommended_actions?: string[] | null
          related_verses?: string[] | null
          significance?: string | null
        }
        Relationships: []
      }
      keywords_map: {
        Row: {
          created_at: string
          keyword: string
          synonyms: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          keyword: string
          synonyms: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          keyword?: string
          synonyms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email_notifications: boolean | null
          facebook_url: string | null
          first_name: string | null
          github_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean | null
          is_verified: boolean | null
          language: string | null
          last_name: string | null
          last_seen_at: string | null
          linkedin_url: string | null
          location: string | null
          marketing_emails: boolean | null
          notifications_enabled: boolean | null
          phone: string | null
          preferred_scripture_language: string | null
          spiritual_goal: string | null
          spiritual_tradition: string | null
          subscription_tier: string | null
          theme: string | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean | null
          facebook_url?: string | null
          first_name?: string | null
          github_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          marketing_emails?: boolean | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_scripture_language?: string | null
          spiritual_goal?: string | null
          spiritual_tradition?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean | null
          facebook_url?: string | null
          first_name?: string | null
          github_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          marketing_emails?: boolean | null
          notifications_enabled?: boolean | null
          phone?: string | null
          preferred_scripture_language?: string | null
          spiritual_goal?: string | null
          spiritual_tradition?: string | null
          subscription_tier?: string | null
          theme?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      quran: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          source_ref: string
          text_ar: string
          text_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          source_ref: string
          text_ar: string
          text_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          source_ref?: string
          text_ar?: string
          text_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scripture: {
        Row: {
          chapter_name: string | null
          created_at: string
          embedding: string | null
          id: string
          source_ref: string
          text_ar: string
          text_type: string
          updated_at: string
          verse_number: number | null
        }
        Insert: {
          chapter_name?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_ref: string
          text_ar: string
          text_type: string
          updated_at?: string
          verse_number?: number | null
        }
        Update: {
          chapter_name?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          source_ref?: string
          text_ar?: string
          text_type?: string
          updated_at?: string
          verse_number?: number | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      surahs: {
        Row: {
          ayah_count: number
          created_at: string
          id: number
          name_ar: string
          name_en: string
          revelation_order: number | null
          revelation_place: string | null
          updated_at: string
        }
        Insert: {
          ayah_count: number
          created_at?: string
          id: number
          name_ar: string
          name_en: string
          revelation_order?: number | null
          revelation_place?: string | null
          updated_at?: string
        }
        Update: {
          ayah_count?: number
          created_at?: string
          id?: number
          name_ar?: string
          name_en?: string
          revelation_order?: number | null
          revelation_place?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          created_at: string
          experience_points: number | null
          favorite_topics: string[] | null
          id: string
          last_activity_date: string | null
          spiritual_level: number | null
          streak_days: number | null
          total_bookmarks: number | null
          total_searches: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          experience_points?: number | null
          favorite_topics?: string[] | null
          id?: string
          last_activity_date?: string | null
          spiritual_level?: number | null
          streak_days?: number | null
          total_bookmarks?: number | null
          total_searches?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          experience_points?: number | null
          favorite_topics?: string[] | null
          id?: string
          last_activity_date?: string | null
          spiritual_level?: number | null
          streak_days?: number | null
          total_bookmarks?: number | null
          total_searches?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verse_feedback: {
        Row: {
          created_at: string
          id: string
          is_helpful: boolean
          query: string
          user_id: string
          verse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_helpful: boolean
          query: string
          user_id: string
          verse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_helpful?: boolean
          query?: string
          user_id?: string
          verse_id?: string
        }
        Relationships: []
      }
      verses: {
        Row: {
          ayah_ar: string | null
          ayah_en: string | null
          ayah_no_quran: number | null
          ayah_no_surah: number | null
          embedding: string | null
          hizb_quarter: number | null
          juz_no: number | null
          list_of_words: string | null
          manzil_no: number | null
          no_of_word_ayah: number | null
          normalized_en: string | null
          normalized_text: string | null
          place_of_revelation: string | null
          ruko_no: number | null
          sajah_ayah: boolean | null
          sajdah_no: string | null
          surah_name_ar: string | null
          surah_name_en: string | null
          surah_name_roman: string | null
          surah_no: number | null
          total_ayah_quran: number | null
          total_ayah_surah: number | null
        }
        Insert: {
          ayah_ar?: string | null
          ayah_en?: string | null
          ayah_no_quran?: number | null
          ayah_no_surah?: number | null
          embedding?: string | null
          hizb_quarter?: number | null
          juz_no?: number | null
          list_of_words?: string | null
          manzil_no?: number | null
          no_of_word_ayah?: number | null
          normalized_en?: string | null
          normalized_text?: string | null
          place_of_revelation?: string | null
          ruko_no?: number | null
          sajah_ayah?: boolean | null
          sajdah_no?: string | null
          surah_name_ar?: string | null
          surah_name_en?: string | null
          surah_name_roman?: string | null
          surah_no?: number | null
          total_ayah_quran?: number | null
          total_ayah_surah?: number | null
        }
        Update: {
          ayah_ar?: string | null
          ayah_en?: string | null
          ayah_no_quran?: number | null
          ayah_no_surah?: number | null
          embedding?: string | null
          hizb_quarter?: number | null
          juz_no?: number | null
          list_of_words?: string | null
          manzil_no?: number | null
          no_of_word_ayah?: number | null
          normalized_en?: string | null
          normalized_text?: string | null
          place_of_revelation?: string | null
          ruko_no?: number | null
          sajah_ayah?: boolean | null
          sajdah_no?: string | null
          surah_name_ar?: string | null
          surah_name_en?: string | null
          surah_name_roman?: string | null
          surah_no?: number | null
          total_ayah_quran?: number | null
          total_ayah_surah?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      expand_query_with_synonyms: {
        Args: { input_query: string; input_lang?: string }
        Returns: string
      }
      get_search_suggestions: {
        Args: { search_term?: string; limit_count?: number }
        Returns: {
          query: string
          frequency: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_hadith: {
        Args: { embedding_input: string; match_count?: number }
        Returns: {
          id: string
          source_ref: string
          text_ar: string
          text_en: string
          similarity: number
        }[]
      }
      match_quran: {
        Args: { embedding_input: string; match_count?: number }
        Returns: {
          id: string
          source_ref: string
          text_ar: string
          text_en: string
          similarity: number
        }[]
      }
      match_scripture: {
        Args:
          | { embedding_input: string; match_count?: number }
          | {
              query_embedding: string
              match_count?: number
              filter_type?: string
            }
        Returns: {
          id: string
          source_ref: string
          text_ar: string
          text_type: string
          chapter_name: string
          verse_number: number
          similarity: number
        }[]
      }
      match_verses: {
        Args: {
          query_embedding: string
          match_count?: number
          filter_surah_id?: number
        }
        Returns: {
          id: number
          surah_id: number
          ayah_number: number
          text_ar: string
          text_en: string
          surah_name_ar: string
          surah_name_en: string
          similarity: number
        }[]
      }
      normalize_arabic: {
        Args: { input_text: string }
        Returns: string
      }
      search_verses_local: {
        Args: {
          q: string
          lang?: string
          q_embedding?: string
          limit_n?: number
        }
        Returns: {
          id: number
          surah_id: number
          ayah_number: number
          text_ar: string
          text_en: string
          surah_name_ar: string
          surah_name_en: string
          score: number
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_user_progress: {
        Args: {
          p_user_id: string
          p_search_increment?: number
          p_bookmark_increment?: number
          p_topic?: string
        }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
