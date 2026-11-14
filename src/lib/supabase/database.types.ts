export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      anamnesis_templates: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          questions: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          questions?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          questions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      chairs: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chairs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chairs_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          unit_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          unit_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          unit_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          document_cnpj_cpf: string | null
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          plan_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          document_cnpj_cpf?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          plan_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          document_cnpj_cpf?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: Json | null
          archived_at: string | null
          birth_date: string | null
          clinic_id: string
          consent_lgpd_at: string | null
          consent_lgpd_by: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["patient_gender"] | null
          guardian_cpf: string | null
          guardian_name: string | null
          id: string
          notes: string | null
          phone: string | null
          search_name: string | null
          source: Database["public"]["Enums"]["patient_source"] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: Json | null
          archived_at?: string | null
          birth_date?: string | null
          clinic_id: string
          consent_lgpd_at?: string | null
          consent_lgpd_by?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["patient_gender"] | null
          guardian_cpf?: string | null
          guardian_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          search_name?: string | null
          source?: Database["public"]["Enums"]["patient_source"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: Json | null
          archived_at?: string | null
          birth_date?: string | null
          clinic_id?: string
          consent_lgpd_at?: string | null
          consent_lgpd_by?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["patient_gender"] | null
          guardian_cpf?: string | null
          guardian_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          search_name?: string | null
          source?: Database["public"]["Enums"]["patient_source"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          days_to_receive: number
          fee_percent: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          days_to_receive?: number
          fee_percent?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          days_to_receive?: number
          fee_percent?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          max_professionals: number | null
          max_units: number | null
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_professionals?: number | null
          max_units?: number | null
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          max_professionals?: number | null
          max_units?: number | null
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          active: boolean
          applies_to_tooth: boolean
          category: string | null
          clinic_id: string
          code: string | null
          created_at: string
          duration_min: number
          id: string
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to_tooth?: boolean
          category?: string | null
          clinic_id: string
          code?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to_tooth?: boolean
          category?: string | null
          clinic_id?: string
          code?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_schedules: {
        Row: {
          clinic_id: string
          created_at: string
          end_time: string
          id: string
          professional_id: string
          start_time: string
          unit_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          clinic_id: string
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          unit_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          unit_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_schedules_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "professional_schedules_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          clinic_id: string
          color: string
          commission_percent: number | null
          created_at: string
          cro: string | null
          id: string
          member_id: string | null
          name: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          color?: string
          commission_percent?: number | null
          created_at?: string
          cro?: string | null
          id?: string
          member_id?: string | null
          name: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          color?: string
          commission_percent?: number | null
          created_at?: string
          cro?: string | null
          id?: string
          member_id?: string | null
          name?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_member_id_clinic_id_fkey"
            columns: ["member_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_clinic_id: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active_clinic_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active_clinic_id?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_clinic_id_fkey"
            columns: ["active_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean
          address: Json | null
          clinic_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: Json | null
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: Json | null
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_unit: { Args: { _unit_id: string }; Returns: boolean }
      current_clinic_id: { Args: never; Returns: string }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: { _roles: Database["public"]["Enums"]["member_role"][] }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      replace_professional_schedule: {
        Args: { _entries: Json; _professional_id: string }
        Returns: undefined
      }
      search_patients: {
        Args: {
          _limit?: number
          _offset?: number
          _query?: string
          _source?: Database["public"]["Enums"]["patient_source"]
          _status?: string
        }
        Returns: {
          archived_at: string
          birth_date: string
          cpf: string
          full_name: string
          id: string
          phone: string
          source: Database["public"]["Enums"]["patient_source"]
          total_count: number
          whatsapp: string
        }[]
      }
      seed_clinic_defaults: { Args: { _clinic_id: string }; Returns: undefined }
      set_active_clinic: { Args: { _clinic_id: string }; Returns: undefined }
      timemultirange: { Args: never; Returns: unknown }
      user_clinic_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      member_role: "owner" | "manager" | "dentist" | "receptionist"
      patient_gender: "female" | "male" | "other" | "not_informed"
      patient_source: "indicacao" | "instagram" | "google" | "site" | "outro"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      member_role: ["owner", "manager", "dentist", "receptionist"],
      patient_gender: ["female", "male", "other", "not_informed"],
      patient_source: ["indicacao", "instagram", "google", "site", "outro"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
    },
  },
} as const
