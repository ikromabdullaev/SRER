export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      article_authors: {
        Row: {
          article_id: string
          author_id: string
          is_corresponding: boolean
          position: number
        }
        Insert: {
          article_id: string
          author_id: string
          is_corresponding?: boolean
          position: number
        }
        Update: {
          article_id?: string
          author_id?: string
          is_corresponding?: boolean
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_authors_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_authors_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles_localised"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      article_translations: {
        Row: {
          abstract: string | null
          article_id: string
          keywords: string[]
          locale: Database["public"]["Enums"]["locale_code"]
          search_vector: unknown
          title: string
        }
        Insert: {
          abstract?: string | null
          article_id: string
          keywords?: string[]
          locale: Database["public"]["Enums"]["locale_code"]
          search_vector?: unknown
          title: string
        }
        Update: {
          abstract?: string | null
          article_id?: string
          keywords?: string[]
          locale?: Database["public"]["Enums"]["locale_code"]
          search_vector?: unknown
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_translations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_translations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles_localised"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          accepted_at: string | null
          created_at: string
          doi: string | null
          first_page: number | null
          id: string
          issue_id: string | null
          jel_codes: string[]
          last_page: number | null
          license: string
          pdf_size_bytes: number | null
          pdf_url: string | null
          position: number | null
          primary_language: Database["public"]["Enums"]["locale_code"]
          published_at: string | null
          received_at: string | null
          slug: string
          state: Database["public"]["Enums"]["publish_state"]
          supersedes_id: string | null
          type: Database["public"]["Enums"]["article_type"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          doi?: string | null
          first_page?: number | null
          id?: string
          issue_id?: string | null
          jel_codes?: string[]
          last_page?: number | null
          license?: string
          pdf_size_bytes?: number | null
          pdf_url?: string | null
          position?: number | null
          primary_language: Database["public"]["Enums"]["locale_code"]
          published_at?: string | null
          received_at?: string | null
          slug: string
          state?: Database["public"]["Enums"]["publish_state"]
          supersedes_id?: string | null
          type?: Database["public"]["Enums"]["article_type"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          doi?: string | null
          first_page?: number | null
          id?: string
          issue_id?: string | null
          jel_codes?: string[]
          last_page?: number | null
          license?: string
          pdf_size_bytes?: number | null
          pdf_url?: string | null
          position?: number | null
          primary_language?: Database["public"]["Enums"]["locale_code"]
          published_at?: string | null
          received_at?: string | null
          slug?: string
          state?: Database["public"]["Enums"]["publish_state"]
          supersedes_id?: string | null
          type?: Database["public"]["Enums"]["article_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "published_articles_localised"
            referencedColumns: ["id"]
          },
        ]
      }
      author_translations: {
        Row: {
          affiliation: string | null
          author_id: string
          display_name: string
          locale: Database["public"]["Enums"]["locale_code"]
        }
        Insert: {
          affiliation?: string | null
          author_id: string
          display_name: string
          locale: Database["public"]["Enums"]["locale_code"]
        }
        Update: {
          affiliation?: string | null
          author_id?: string
          display_name?: string
          locale?: Database["public"]["Enums"]["locale_code"]
        }
        Relationships: [
          {
            foreignKeyName: "author_translations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          created_at: string
          email: string | null
          family_name: string
          given_name: string
          id: string
          orcid: string | null
          slug: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          family_name: string
          given_name: string
          id?: string
          orcid?: string | null
          slug: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          family_name?: string
          given_name?: string
          id?: string
          orcid?: string | null
          slug?: string
          website_url?: string | null
        }
        Relationships: []
      }
      editorial_decisions: {
        Row: {
          article_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["review_recommendation"]
          editor_id: string | null
          id: string
          note: string | null
          round: number
        }
        Insert: {
          article_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["review_recommendation"]
          editor_id?: string | null
          id?: string
          note?: string | null
          round?: number
        }
        Update: {
          article_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["review_recommendation"]
          editor_id?: string | null
          id?: string
          note?: string | null
          round?: number
        }
        Relationships: [
          {
            foreignKeyName: "editorial_decisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_decisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles_localised"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "editorial_decisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_translations: {
        Row: {
          description: string | null
          issue_id: string
          locale: Database["public"]["Enums"]["locale_code"]
          title: string | null
        }
        Insert: {
          description?: string | null
          issue_id: string
          locale: Database["public"]["Enums"]["locale_code"]
          title?: string | null
        }
        Update: {
          description?: string | null
          issue_id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_translations_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          number: number
          published_at: string | null
          state: Database["public"]["Enums"]["publish_state"]
          updated_at: string
          volume: number
          year: number
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          number: number
          published_at?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
          volume: number
          year: number
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          number?: number
          published_at?: string | null
          state?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
          volume?: number
          year?: number
        }
        Relationships: []
      }
      post_translations: {
        Row: {
          body: string
          excerpt: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          post_id: string
          search_vector: unknown
          title: string
        }
        Insert: {
          body: string
          excerpt?: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          post_id: string
          search_vector?: unknown
          title: string
        }
        Update: {
          body?: string
          excerpt?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          post_id?: string
          search_vector?: unknown
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          created_at: string
          id: string
          published_at: string | null
          slug: string
          state: Database["public"]["Enums"]["publish_state"]
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          state?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          state?: Database["public"]["Enums"]["publish_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string
          handle: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name: string
          handle?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string
          handle?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      proposals: {
        Row: {
          abstract: string
          admin_notes: string | null
          affiliation: string | null
          coauthor_note: string | null
          created_at: string
          email: string
          file_url: string | null
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          name: string
          source_ip: unknown
          state: Database["public"]["Enums"]["proposal_state"]
          title: string
          updated_at: string
        }
        Insert: {
          abstract: string
          admin_notes?: string | null
          affiliation?: string | null
          coauthor_note?: string | null
          created_at?: string
          email: string
          file_url?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale_code"]
          name: string
          source_ip?: unknown
          state?: Database["public"]["Enums"]["proposal_state"]
          title: string
          updated_at?: string
        }
        Update: {
          abstract?: string
          admin_notes?: string | null
          affiliation?: string | null
          coauthor_note?: string | null
          created_at?: string
          email?: string
          file_url?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          name?: string
          source_ip?: unknown
          state?: Database["public"]["Enums"]["proposal_state"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          article_id: string
          comments_to_author: string | null
          comments_to_editor: string | null
          created_at: string
          due_at: string | null
          id: string
          recommendation:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          reviewer_id: string | null
          round: number
          submitted_at: string | null
        }
        Insert: {
          article_id: string
          comments_to_author?: string | null
          comments_to_editor?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          recommendation?:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          reviewer_id?: string | null
          round?: number
          submitted_at?: string | null
        }
        Update: {
          article_id?: string
          comments_to_author?: string | null
          comments_to_editor?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          recommendation?:
            | Database["public"]["Enums"]["review_recommendation"]
            | null
          reviewer_id?: string | null
          round?: number
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles_localised"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      published_articles_localised: {
        Row: {
          abstract: string | null
          abstract_locale: Database["public"]["Enums"]["locale_code"] | null
          doi: string | null
          first_page: number | null
          id: string | null
          issue_id: string | null
          jel_codes: string[] | null
          keywords: string[] | null
          keywords_locale: Database["public"]["Enums"]["locale_code"] | null
          last_page: number | null
          license: string | null
          number: number | null
          pdf_size_bytes: number | null
          pdf_url: string | null
          position: number | null
          primary_language: Database["public"]["Enums"]["locale_code"] | null
          published_at: string | null
          requested_locale: Database["public"]["Enums"]["locale_code"] | null
          slug: string | null
          title: string | null
          title_locale: Database["public"]["Enums"]["locale_code"] | null
          translation_missing: boolean | null
          type: Database["public"]["Enums"]["article_type"] | null
          volume: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      immutable_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      immutable_unaccent: { Args: { t: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      locale_rank: {
        Args: {
          candidate: Database["public"]["Enums"]["locale_code"]
          primary_lang: Database["public"]["Enums"]["locale_code"]
          requested: Database["public"]["Enums"]["locale_code"]
        }
        Returns: number
      }
      locale_regconfig: {
        Args: { l: Database["public"]["Enums"]["locale_code"] }
        Returns: unknown
      }
      search_articles: {
        Args: {
          all_locales?: boolean
          filter_issue?: string
          filter_jel?: string
          filter_type?: Database["public"]["Enums"]["article_type"]
          filter_year?: number
          in_locale: Database["public"]["Enums"]["locale_code"]
          page_limit?: number
          page_offset?: number
          search_query: string
        }
        Returns: {
          abstract: string
          id: string
          matched_locale: Database["public"]["Enums"]["locale_code"]
          number: number
          published_at: string
          score: number
          slug: string
          title: string
          total: number
          volume: number
        }[]
      }
      search_posts: {
        Args: {
          filter_locale?: Database["public"]["Enums"]["locale_code"]
          page_limit?: number
          page_offset?: number
          search_query: string
        }
        Returns: {
          author_name: string
          excerpt: string
          handle: string
          id: string
          matched_locale: Database["public"]["Enums"]["locale_code"]
          published_at: string
          score: number
          slug: string
          title: string
          total: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      article_type:
        | "research_article"
        | "review_article"
        | "case_study"
        | "policy_note"
        | "book_review"
        | "editorial"
        | "correction"
        | "retraction"
      locale_code: "en" | "uz" | "ru"
      proposal_state: "new" | "contacted" | "accepted" | "declined" | "spam"
      publish_state: "draft" | "published" | "withdrawn"
      review_recommendation:
        | "accept"
        | "minor_revision"
        | "major_revision"
        | "reject"
      user_role: "admin" | "editor"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      article_type: [
        "research_article",
        "review_article",
        "case_study",
        "policy_note",
        "book_review",
        "editorial",
        "correction",
        "retraction",
      ],
      locale_code: ["en", "uz", "ru"],
      proposal_state: ["new", "contacted", "accepted", "declined", "spam"],
      publish_state: ["draft", "published", "withdrawn"],
      review_recommendation: [
        "accept",
        "minor_revision",
        "major_revision",
        "reject",
      ],
      user_role: ["admin", "editor"],
    },
  },
} as const

