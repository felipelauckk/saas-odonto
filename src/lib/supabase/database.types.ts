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
      anamneses: {
        Row: {
          answers: Json
          clinic_id: string
          created_at: string
          filled_by: string | null
          id: string
          patient_id: string
          signed_at: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          answers: Json
          clinic_id: string
          created_at?: string
          filled_by?: string | null
          id?: string
          patient_id: string
          signed_at?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          clinic_id?: string
          created_at?: string
          filled_by?: string | null
          id?: string
          patient_id?: string
          signed_at?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamneses_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "anamneses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_templates"
            referencedColumns: ["id"]
          },
        ]
      }
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
      appointments: {
        Row: {
          chair_id: string | null
          clinic_id: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          patient_id: string
          procedure_id: string | null
          professional_id: string
          reminder_sent_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          chair_id?: string | null
          clinic_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          patient_id: string
          procedure_id?: string | null
          professional_id: string
          reminder_sent_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          chair_id?: string | null
          clinic_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_id?: string | null
          professional_id?: string
          reminder_sent_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_chair_id_clinic_id_fkey"
            columns: ["chair_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "chairs"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointments_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount_cents: number
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          occurred_at: string
          payment_method_id: string | null
          receivable_id: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          occurred_at?: string
          payment_method_id?: string | null
          receivable_id?: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          occurred_at?: string
          payment_method_id?: string | null
          receivable_id?: string | null
          type?: Database["public"]["Enums"]["cash_movement_type"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_method_id_clinic_id_fkey"
            columns: ["payment_method_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "cash_movements_receivable_id_clinic_id_fkey"
            columns: ["receivable_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "cash_movements_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
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
      clinical_notes: {
        Row: {
          appointment_id: string | null
          body: string
          clinic_id: string
          complements_note_id: string | null
          created_at: string
          created_by: string | null
          id: string
          patient_id: string
          professional_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          clinic_id: string
          complements_note_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id: string
          professional_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          clinic_id?: string
          complements_note_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_complements_note_id_fkey"
            columns: ["complements_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "clinical_notes_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
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
      patient_files: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["patient_file_kind"]
          mime_type: string | null
          patient_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["patient_file_kind"]
          mime_type?: string | null
          patient_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["patient_file_kind"]
          mime_type?: string | null
          patient_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_files_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
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
      receivables: {
        Row: {
          amount_cents: number
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          fee_cents: number
          id: string
          installment_number: number
          installment_total: number
          paid_amount_cents: number | null
          paid_at: string | null
          patient_id: string
          payment_method_id: string | null
          plan_id: string | null
          professional_id: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["receivable_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          fee_cents?: number
          id?: string
          installment_number?: number
          installment_total?: number
          paid_amount_cents?: number | null
          paid_at?: string | null
          patient_id: string
          payment_method_id?: string | null
          plan_id?: string | null
          professional_id?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          fee_cents?: number
          id?: string
          installment_number?: number
          installment_total?: number
          paid_amount_cents?: number | null
          paid_at?: string | null
          patient_id?: string
          payment_method_id?: string | null
          plan_id?: string | null
          professional_id?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["receivable_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "receivables_payment_method_id_clinic_id_fkey"
            columns: ["payment_method_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "receivables_plan_id_clinic_id_fkey"
            columns: ["plan_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "receivables_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "receivables_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          professional_id: string | null
          reason: string | null
          starts_at: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          starts_at: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          starts_at?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "schedule_blocks_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      tooth_records: {
        Row: {
          clinic_id: string
          condition: Database["public"]["Enums"]["tooth_condition"]
          created_at: string
          faces: string[]
          id: string
          notes: string | null
          patient_id: string
          recorded_by: string | null
          tooth: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          condition: Database["public"]["Enums"]["tooth_condition"]
          created_at?: string
          faces?: string[]
          id?: string
          notes?: string | null
          patient_id: string
          recorded_by?: string | null
          tooth: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          condition?: Database["public"]["Enums"]["tooth_condition"]
          created_at?: string
          faces?: string[]
          id?: string
          notes?: string | null
          patient_id?: string
          recorded_by?: string | null
          tooth?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_records_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      treatment_items: {
        Row: {
          clinic_id: string
          created_at: string
          description: string
          done_at: string | null
          done_by: string | null
          faces: string[]
          id: string
          plan_id: string
          position: number
          price_cents: number
          procedure_id: string | null
          status: Database["public"]["Enums"]["treatment_item_status"]
          tooth: number | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description: string
          done_at?: string | null
          done_by?: string | null
          faces?: string[]
          id?: string
          plan_id: string
          position?: number
          price_cents: number
          procedure_id?: string | null
          status?: Database["public"]["Enums"]["treatment_item_status"]
          tooth?: number | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string
          done_at?: string | null
          done_by?: string | null
          faces?: string[]
          id?: string
          plan_id?: string
          position?: number
          price_cents?: number
          procedure_id?: string | null
          status?: Database["public"]["Enums"]["treatment_item_status"]
          tooth?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_items_plan_id_clinic_id_fkey"
            columns: ["plan_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "treatment_items_procedure_id_clinic_id_fkey"
            columns: ["procedure_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          discount_cents: number
          first_due_date: string | null
          id: string
          installments: number
          notes: string | null
          patient_id: string
          payment_method_id: string | null
          presented_at: string | null
          professional_id: string
          status: Database["public"]["Enums"]["treatment_plan_status"]
          total_cents: number
          unit_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          discount_cents?: number
          first_due_date?: string | null
          id?: string
          installments?: number
          notes?: string | null
          patient_id: string
          payment_method_id?: string | null
          presented_at?: string | null
          professional_id: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          total_cents?: number
          unit_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          discount_cents?: number
          first_due_date?: string | null
          id?: string
          installments?: number
          notes?: string | null
          patient_id?: string
          payment_method_id?: string | null
          presented_at?: string | null
          professional_id?: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          total_cents?: number
          unit_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "treatment_plans_payment_method_id_clinic_id_fkey"
            columns: ["payment_method_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "treatment_plans_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "treatment_plans_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
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
      approve_treatment_plan: {
        Args: {
          _discount_cents: number
          _first_due_date: string
          _installments: number
          _item_ids: string[]
          _payment_method_id: string
          _plan_id: string
        }
        Returns: undefined
      }
      can_access_agenda: {
        Args: { _professional_id: string; _unit_id: string }
        Returns: boolean
      }
      can_access_unit: { Args: { _unit_id: string }; Returns: boolean }
      can_operate_finance: { Args: never; Returns: boolean }
      can_read_clinical: { Args: never; Returns: boolean }
      can_write_clinical: { Args: never; Returns: boolean }
      cancel_receivable: {
        Args: { _receivable_id: string }
        Returns: undefined
      }
      current_clinic_id: { Args: never; Returns: string }
      current_professional_ids: { Args: never; Returns: string[] }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: { _roles: Database["public"]["Enums"]["member_role"][] }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      mark_overdue_receivables: { Args: never; Returns: number }
      patient_alerts: {
        Args: { _patient_id: string }
        Returns: {
          details: string
          label: string
        }[]
      }
      receive_payment: {
        Args: {
          _paid_amount_cents: number
          _paid_on: string
          _payment_method_id: string
          _receivable_id: string
        }
        Returns: undefined
      }
      replace_professional_schedule: {
        Args: { _entries: Json; _professional_id: string }
        Returns: undefined
      }
      reverse_payment: { Args: { _receivable_id: string }; Returns: undefined }
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
      today_sp: { Args: never; Returns: string }
      user_clinic_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "arrived"
        | "in_progress"
        | "done"
        | "no_show"
        | "canceled"
      cash_movement_type: "in" | "out"
      member_role: "owner" | "manager" | "dentist" | "receptionist"
      patient_file_kind: "photo" | "xray" | "document" | "other"
      patient_gender: "female" | "male" | "other" | "not_informed"
      patient_source: "indicacao" | "instagram" | "google" | "site" | "outro"
      receivable_status: "open" | "paid" | "overdue" | "canceled"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      tooth_condition:
        | "healthy"
        | "caries"
        | "restored"
        | "missing"
        | "implant"
        | "crown"
        | "root_canal"
        | "other"
      treatment_item_status: "pending" | "approved" | "rejected" | "done"
      treatment_plan_status:
        | "draft"
        | "presented"
        | "approved"
        | "partially_approved"
        | "rejected"
        | "completed"
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
      appointment_status: [
        "scheduled",
        "confirmed",
        "arrived",
        "in_progress",
        "done",
        "no_show",
        "canceled",
      ],
      cash_movement_type: ["in", "out"],
      member_role: ["owner", "manager", "dentist", "receptionist"],
      patient_file_kind: ["photo", "xray", "document", "other"],
      patient_gender: ["female", "male", "other", "not_informed"],
      patient_source: ["indicacao", "instagram", "google", "site", "outro"],
      receivable_status: ["open", "paid", "overdue", "canceled"],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      tooth_condition: [
        "healthy",
        "caries",
        "restored",
        "missing",
        "implant",
        "crown",
        "root_canal",
        "other",
      ],
      treatment_item_status: ["pending", "approved", "rejected", "done"],
      treatment_plan_status: [
        "draft",
        "presented",
        "approved",
        "partially_approved",
        "rejected",
        "completed",
      ],
    },
  },
} as const
