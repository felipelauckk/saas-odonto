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
      appointment_tag_links: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_tag_links_appointment_id_clinic_id_fkey"
            columns: ["appointment_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "appointment_tag_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_tag_links_tag_id_clinic_id_fkey"
            columns: ["tag_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "appointment_tags"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      appointment_tags: {
        Row: {
          active: boolean
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_tags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          arrived_at: string | null
          cancel_note: string | null
          cancel_reason: Database["public"]["Enums"]["cancel_reason"] | null
          chair_id: string | null
          clinic_id: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          is_first_visit: boolean
          notes: string | null
          patient_id: string
          procedure_id: string | null
          professional_id: string
          reminder_sent_at: string | null
          series_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          cancel_note?: string | null
          cancel_reason?: Database["public"]["Enums"]["cancel_reason"] | null
          chair_id?: string | null
          clinic_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          is_first_visit?: boolean
          notes?: string | null
          patient_id: string
          procedure_id?: string | null
          professional_id: string
          reminder_sent_at?: string | null
          series_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          cancel_note?: string | null
          cancel_reason?: Database["public"]["Enums"]["cancel_reason"] | null
          chair_id?: string | null
          clinic_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          is_first_visit?: boolean
          notes?: string | null
          patient_id?: string
          procedure_id?: string | null
          professional_id?: string
          reminder_sent_at?: string | null
          series_id?: string | null
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
      audit_log: {
        Row: {
          action: string
          at: string
          clinic_id: string
          created_at: string
          id: string
          patient_id: string | null
          record_id: string | null
          table_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          clinic_id: string
          created_at?: string
          id?: string
          patient_id?: string | null
          record_id?: string | null
          table_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          clinic_id?: string
          created_at?: string
          id?: string
          patient_id?: string | null
          record_id?: string | null
          table_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_label: string | null
          amount_cents: number
          cash_movement_id: string | null
          clinic_id: string
          created_at: string
          description: string | null
          fitid: string
          id: string
          imported_by: string | null
          matched_at: string | null
          matched_by: string | null
          payable_id: string | null
          posted_on: string
          receivable_id: string | null
          status: Database["public"]["Enums"]["bank_tx_status"]
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          amount_cents: number
          cash_movement_id?: string | null
          clinic_id: string
          created_at?: string
          description?: string | null
          fitid: string
          id?: string
          imported_by?: string | null
          matched_at?: string | null
          matched_by?: string | null
          payable_id?: string | null
          posted_on: string
          receivable_id?: string | null
          status?: Database["public"]["Enums"]["bank_tx_status"]
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          amount_cents?: number
          cash_movement_id?: string | null
          clinic_id?: string
          created_at?: string
          description?: string | null
          fitid?: string
          id?: string
          imported_by?: string | null
          matched_at?: string | null
          matched_by?: string | null
          payable_id?: string | null
          posted_on?: string
          receivable_id?: string | null
          status?: Database["public"]["Enums"]["bank_tx_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_cash_movement_id_clinic_id_fkey"
            columns: ["cash_movement_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "bank_transactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_payable_id_clinic_id_fkey"
            columns: ["payable_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "bank_transactions_receivable_id_clinic_id_fkey"
            columns: ["receivable_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      billing_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          event: string
          event_id: string
          id: string
          payload: Json
          provider: string
          received_at: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          event: string
          event_id: string
          id?: string
          payload: Json
          provider?: string
          received_at?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          event?: string
          event_id?: string
          id?: string
          payload?: Json
          provider?: string
          received_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount_cents: number
          category_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          occurred_at: string
          payable_id: string | null
          payment_method_id: string | null
          receivable_id: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          occurred_at?: string
          payable_id?: string | null
          payment_method_id?: string | null
          receivable_id?: string | null
          type: Database["public"]["Enums"]["cash_movement_type"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          occurred_at?: string
          payable_id?: string | null
          payment_method_id?: string | null
          receivable_id?: string | null
          type?: Database["public"]["Enums"]["cash_movement_type"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_category_fk"
            columns: ["category_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "cash_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payable_fk"
            columns: ["payable_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id", "clinic_id"]
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
      clinic_billing: {
        Row: {
          api_key_encrypted: string | null
          api_key_hint: string | null
          clinic_id: string
          connected_at: string | null
          created_at: string
          environment: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_key_hint?: string | null
          clinic_id: string
          connected_at?: string | null
          created_at?: string
          environment?: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_key_hint?: string | null
          clinic_id?: string
          connected_at?: string | null
          created_at?: string
          environment?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_billing_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
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
          canceled_at: string | null
          commission_base: Database["public"]["Enums"]["commission_base"]
          commission_deduct_fees: boolean
          commission_deduct_lab: boolean
          created_at: string
          document_cnpj_cpf: string | null
          email: string | null
          id: string
          lead_form_token: string
          legal_name: string | null
          logo_url: string | null
          name: string
          past_due_since: string | null
          phone: string | null
          plan_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          commission_base?: Database["public"]["Enums"]["commission_base"]
          commission_deduct_fees?: boolean
          commission_deduct_lab?: boolean
          created_at?: string
          document_cnpj_cpf?: string | null
          email?: string | null
          id?: string
          lead_form_token?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          past_due_since?: string | null
          phone?: string | null
          plan_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          commission_base?: Database["public"]["Enums"]["commission_base"]
          commission_deduct_fees?: boolean
          commission_deduct_lab?: boolean
          created_at?: string
          document_cnpj_cpf?: string | null
          email?: string | null
          id?: string
          lead_form_token?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          past_due_since?: string | null
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
      commission_closings: {
        Row: {
          base: Database["public"]["Enums"]["commission_base"]
          clinic_id: string
          closed_at: string
          closed_by: string | null
          created_at: string
          id: string
          lines: Json
          payable_id: string | null
          pdf_path: string | null
          period_month: string
          professional_id: string
          total_base_cents: number
          total_commission_cents: number
          total_gross_cents: number
          updated_at: string
        }
        Insert: {
          base: Database["public"]["Enums"]["commission_base"]
          clinic_id: string
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          id?: string
          lines: Json
          payable_id?: string | null
          pdf_path?: string | null
          period_month: string
          professional_id: string
          total_base_cents: number
          total_commission_cents: number
          total_gross_cents: number
          updated_at?: string
        }
        Update: {
          base?: Database["public"]["Enums"]["commission_base"]
          clinic_id?: string
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          id?: string
          lines?: Json
          payable_id?: string | null
          pdf_path?: string | null
          period_month?: string
          professional_id?: string
          total_base_cents?: number
          total_commission_cents?: number
          total_gross_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_closings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_closings_payable_id_clinic_id_fkey"
            columns: ["payable_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "commission_closings_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          category: string | null
          clinic_id: string
          created_at: string
          fixed_cents: number | null
          id: string
          percent: number | null
          procedure_id: string | null
          professional_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          clinic_id: string
          created_at?: string
          fixed_cents?: number | null
          id?: string
          percent?: number | null
          procedure_id?: string | null
          professional_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          clinic_id?: string
          created_at?: string
          fixed_cents?: number | null
          id?: string
          percent?: number | null
          procedure_id?: string | null
          professional_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_procedure_id_clinic_id_fkey"
            columns: ["procedure_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "commission_rules_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      crc_contacts: {
        Row: {
          amount_cents: number | null
          channel: Database["public"]["Enums"]["crc_channel"]
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          item_key: string
          next_contact_on: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["crc_outcome"] | null
          patient_id: string
          queue: Database["public"]["Enums"]["crc_queue"]
          ref_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          channel: Database["public"]["Enums"]["crc_channel"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_key: string
          next_contact_on?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["crc_outcome"] | null
          patient_id: string
          queue: Database["public"]["Enums"]["crc_queue"]
          ref_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          channel?: Database["public"]["Enums"]["crc_channel"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_key?: string
          next_contact_on?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["crc_outcome"] | null
          patient_id?: string
          queue?: Database["public"]["Enums"]["crc_queue"]
          ref_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crc_contacts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crc_contacts_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      crc_templates: {
        Row: {
          body: string
          clinic_id: string
          created_at: string
          id: string
          queue: Database["public"]["Enums"]["crc_queue"]
          updated_at: string
        }
        Insert: {
          body: string
          clinic_id: string
          created_at?: string
          id?: string
          queue: Database["public"]["Enums"]["crc_queue"]
          updated_at?: string
        }
        Update: {
          body?: string
          clinic_id?: string
          created_at?: string
          id?: string
          queue?: Database["public"]["Enums"]["crc_queue"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crc_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          active: boolean
          clinic_id: string
          cost_cents: number
          created_at: string
          id: string
          name: string
          source: Database["public"]["Enums"]["lead_source"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          cost_cents?: number
          created_at?: string
          id?: string
          name: string
          source?: Database["public"]["Enums"]["lead_source"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          cost_cents?: number
          created_at?: string
          id?: string
          name?: string
          source?: Database["public"]["Enums"]["lead_source"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          auto_key: string | null
          clinic_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["crm_stage_kind"]
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          auto_key?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["crm_stage_kind"]
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          auto_key?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["crm_stage_kind"]
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          active: boolean
          body: string
          clinic_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          name: string
          procedure_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          clinic_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          name: string
          procedure_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          name?: string
          procedure_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_procedure_id_clinic_id_fkey"
            columns: ["procedure_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      dunning_log: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          offset_days: number
          receivable_id: string
          sent_at: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          offset_days: number
          receivable_id: string
          sent_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          offset_days?: number
          receivable_id?: string
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_log_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_steps: {
        Row: {
          active: boolean
          body: string
          clinic_id: string
          created_at: string
          id: string
          offset_days: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          clinic_id: string
          created_at?: string
          id?: string
          offset_days: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          clinic_id?: string
          created_at?: string
          id?: string
          offset_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_steps_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campaign_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          email: string | null
          from_public_form: boolean
          id: string
          interest: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          patient_id: string | null
          phone: string | null
          procedure_id: string | null
          referred_by_partner_id: string | null
          referred_by_patient_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          stage_changed_at: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          from_public_form?: boolean
          id?: string
          interest?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          patient_id?: string | null
          phone?: string | null
          procedure_id?: string | null
          referred_by_partner_id?: string | null
          referred_by_patient_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage_changed_at?: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          from_public_form?: boolean
          id?: string
          interest?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          patient_id?: string | null
          phone?: string | null
          procedure_id?: string | null
          referred_by_partner_id?: string | null
          referred_by_patient_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage_changed_at?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_clinic_id_fkey"
            columns: ["campaign_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "leads_procedure_id_clinic_id_fkey"
            columns: ["procedure_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "leads_referred_by_partner_id_clinic_id_fkey"
            columns: ["referred_by_partner_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "leads_referred_by_patient_id_clinic_id_fkey"
            columns: ["referred_by_patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "leads_stage_id_clinic_id_fkey"
            columns: ["stage_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          default_dosage: string | null
          default_quantity: string | null
          id: string
          name: string
          presentation: string | null
          special_control: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          default_dosage?: string | null
          default_quantity?: string | null
          id?: string
          name: string
          presentation?: string | null
          special_control?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          default_dosage?: string | null
          default_quantity?: string | null
          id?: string
          name?: string
          presentation?: string | null
          special_control?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          clinic_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          clinic_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["message_kind"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_log: {
        Row: {
          appointment_id: string | null
          body: string | null
          channel: string
          clinic_id: string
          created_at: string
          error: string | null
          id: string
          patient_id: string | null
          provider: string
          provider_id: string | null
          sent_at: string
          status: Database["public"]["Enums"]["message_status"]
          template_kind: Database["public"]["Enums"]["message_kind"] | null
          to_phone: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          channel?: string
          clinic_id: string
          created_at?: string
          error?: string | null
          id?: string
          patient_id?: string | null
          provider: string
          provider_id?: string | null
          sent_at?: string
          status: Database["public"]["Enums"]["message_status"]
          template_kind?: Database["public"]["Enums"]["message_kind"] | null
          to_phone?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string
          error?: string | null
          id?: string
          patient_id?: string | null
          provider?: string
          provider_id?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["message_status"]
          template_kind?: Database["public"]["Enums"]["message_kind"] | null
          to_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_log_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      patient_charges: {
        Row: {
          amount_cents: number
          asaas_installment_id: string | null
          asaas_payment_id: string | null
          bank_slip_url: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          due_date: string
          fee_cents: number | null
          id: string
          installments: number
          invoice_url: string | null
          kind: Database["public"]["Enums"]["charge_kind"]
          paid_at: string | null
          paid_cents: number | null
          patient_id: string
          pix_payload: string | null
          receivable_ids: string[]
          status: Database["public"]["Enums"]["charge_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          fee_cents?: number | null
          id?: string
          installments?: number
          invoice_url?: string | null
          kind: Database["public"]["Enums"]["charge_kind"]
          paid_at?: string | null
          paid_cents?: number | null
          patient_id: string
          pix_payload?: string | null
          receivable_ids: string[]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          asaas_installment_id?: string | null
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          fee_cents?: number | null
          id?: string
          installments?: number
          invoice_url?: string | null
          kind?: Database["public"]["Enums"]["charge_kind"]
          paid_at?: string | null
          paid_cents?: number | null
          patient_id?: string
          pix_payload?: string | null
          receivable_ids?: string[]
          status?: Database["public"]["Enums"]["charge_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_charges_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_charges_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          body: string
          canceled_at: string | null
          canceled_by: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["document_kind"]
          patient_id: string
          pdf_path: string | null
          pdf_sha256: string | null
          plan_id: string | null
          prescription: Json | null
          professional_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          canceled_at?: string | null
          canceled_by?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string
          kind: Database["public"]["Enums"]["document_kind"]
          patient_id: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          plan_id?: string | null
          prescription?: Json | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          canceled_at?: string | null
          canceled_by?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          patient_id?: string
          pdf_path?: string | null
          pdf_sha256?: string | null
          plan_id?: string | null
          prescription?: Json | null
          professional_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_documents_plan_id_clinic_id_fkey"
            columns: ["plan_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_documents_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_documents_template_id_clinic_id_fkey"
            columns: ["template_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id", "clinic_id"]
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
      patient_returns: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          notified_at: string | null
          patient_id: string
          procedure_id: string | null
          professional_id: string | null
          reason: string
          scheduled_appointment_id: string | null
          source_appointment_id: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          notified_at?: string | null
          patient_id: string
          procedure_id?: string | null
          professional_id?: string | null
          reason: string
          scheduled_appointment_id?: string | null
          source_appointment_id?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          notified_at?: string | null
          patient_id?: string
          procedure_id?: string | null
          professional_id?: string | null
          reason?: string
          scheduled_appointment_id?: string | null
          source_appointment_id?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_returns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_returns_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_returns_procedure_id_clinic_id_fkey"
            columns: ["procedure_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_returns_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_returns_scheduled_appointment_id_clinic_id_fkey"
            columns: ["scheduled_appointment_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patient_returns_source_appointment_id_clinic_id_fkey"
            columns: ["source_appointment_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      patients: {
        Row: {
          address: Json | null
          archived_at: string | null
          asaas_customer_id: string | null
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
          referred_by_partner_id: string | null
          referred_by_patient_id: string | null
          search_name: string | null
          source: Database["public"]["Enums"]["patient_source"] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: Json | null
          archived_at?: string | null
          asaas_customer_id?: string | null
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
          referred_by_partner_id?: string | null
          referred_by_patient_id?: string | null
          search_name?: string | null
          source?: Database["public"]["Enums"]["patient_source"] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: Json | null
          archived_at?: string | null
          asaas_customer_id?: string | null
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
          referred_by_partner_id?: string | null
          referred_by_patient_id?: string | null
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
          {
            foreignKeyName: "patients_referred_partner_fk"
            columns: ["referred_by_partner_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "referral_partners"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "patients_referred_patient_fk"
            columns: ["referred_by_patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      payables: {
        Row: {
          amount_cents: number
          attachment_path: string | null
          category_id: string
          clinic_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          group_id: string | null
          id: string
          installment_number: number
          installment_total: number
          notes: string | null
          paid_amount_cents: number | null
          paid_at: string | null
          paid_by: string | null
          payment_method_id: string | null
          recurring: boolean
          status: Database["public"]["Enums"]["payable_status"]
          supplier_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attachment_path?: string | null
          category_id: string
          clinic_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          group_id?: string | null
          id?: string
          installment_number?: number
          installment_total?: number
          notes?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          recurring?: boolean
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attachment_path?: string | null
          category_id?: string
          clinic_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          group_id?: string | null
          id?: string
          installment_number?: number
          installment_total?: number
          notes?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          recurring?: boolean
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_category_id_clinic_id_fkey"
            columns: ["category_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "payables_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_cost_center_id_clinic_id_fkey"
            columns: ["cost_center_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "payables_payment_method_id_clinic_id_fkey"
            columns: ["payment_method_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "payables_supplier_id_clinic_id_fkey"
            columns: ["supplier_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "payables_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
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
      platform_admins: {
        Row: {
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_id?: string
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
          return_months: number | null
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
          return_months?: number | null
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
          return_months?: number | null
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
          in_negotiation: boolean
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
          in_negotiation?: boolean
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
          in_negotiation?: boolean
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
      referral_partners: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_partners_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
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
      signature_requests: {
        Row: {
          anamnesis_id: string | null
          anamnesis_template_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          expires_at: string
          id: string
          original_sha256: string | null
          patient_id: string
          purpose: Database["public"]["Enums"]["signature_purpose"]
          signature_path: string | null
          signed_at: string | null
          signed_pdf_path: string | null
          signed_sha256: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_user_agent: string | null
          status: Database["public"]["Enums"]["signature_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          anamnesis_id?: string | null
          anamnesis_template_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_at: string
          id?: string
          original_sha256?: string | null
          patient_id: string
          purpose: Database["public"]["Enums"]["signature_purpose"]
          signature_path?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signed_sha256?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          anamnesis_id?: string | null
          anamnesis_template_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_at?: string
          id?: string
          original_sha256?: string | null
          patient_id?: string
          purpose?: Database["public"]["Enums"]["signature_purpose"]
          signature_path?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signed_sha256?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_anamnesis_id_fkey"
            columns: ["anamnesis_id"]
            isOneToOne: false
            referencedRelation: "anamneses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_anamnesis_template_id_fkey"
            columns: ["anamnesis_template_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_clinic_id_fkey"
            columns: ["document_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "signature_requests_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
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
          lab_cost_cents: number
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
          lab_cost_cents?: number
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
          lab_cost_cents?: number
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
      waitlist: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          patient_id: string
          period: Database["public"]["Enums"]["waitlist_period"]
          professional_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          period?: Database["public"]["Enums"]["waitlist_period"]
          professional_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          period?: Database["public"]["Enums"]["waitlist_period"]
          professional_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_appointment_id_clinic_id_fkey"
            columns: ["appointment_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "waitlist_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_patient_id_clinic_id_fkey"
            columns: ["patient_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_clinic_id_fkey"
            columns: ["professional_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id", "clinic_id"]
          },
          {
            foreignKeyName: "waitlist_unit_id_clinic_id_fkey"
            columns: ["unit_id", "clinic_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "clinic_id"]
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
      can_use_crc: { Args: never; Returns: boolean }
      can_write_clinical: { Args: never; Returns: boolean }
      cancel_receivable: {
        Args: { _receivable_id: string }
        Returns: undefined
      }
      clinic_access_state: { Args: { _clinic_id: string }; Returns: string }
      clinic_writable: { Args: { _clinic_id?: string }; Returns: boolean }
      crc_items: {
        Args: never
        Returns: {
          amount_cents: number
          item_key: string
          patient_id: string
          patient_name: string
          phone: string
          queue: Database["public"]["Enums"]["crc_queue"]
          ref_date: string
          ref_id: string
        }[]
      }
      crc_stats: {
        Args: { _from: string; _to: string }
        Returns: {
          contacted: number
          queue: Database["public"]["Enums"]["crc_queue"]
          recovered: number
          recovered_cents: number
        }[]
      }
      crm_advance: {
        Args: { _clinic_id: string; _key: string; _patient_id: string }
        Returns: undefined
      }
      current_clinic_id: { Args: never; Returns: string }
      current_professional_ids: { Args: never; Returns: string[] }
      dashboard_metrics: { Args: { _unit_id?: string }; Returns: Json }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: { _roles: Database["public"]["Enums"]["member_role"][] }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      is_clinical_document: {
        Args: { _kind: Database["public"]["Enums"]["document_kind"] }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      log_access: {
        Args: {
          _action: string
          _patient_id: string
          _record_id: string
          _table_name: string
        }
        Returns: undefined
      }
      mark_overdue_receivables: { Args: never; Returns: number }
      patient_alerts: {
        Args: { _patient_id: string }
        Returns: {
          details: string
          label: string
        }[]
      }
      pay_payable: {
        Args: {
          _paid_amount_cents: number
          _paid_on: string
          _payable_id: string
          _payment_method_id: string
        }
        Returns: undefined
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
      regenerate_lead_form_token: { Args: never; Returns: string }
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
      seed_agenda_defaults: { Args: { _clinic_id: string }; Returns: undefined }
      seed_clinic_defaults: { Args: { _clinic_id: string }; Returns: undefined }
      seed_crc_defaults: { Args: { _clinic_id: string }; Returns: undefined }
      seed_crm_defaults: { Args: { _clinic_id: string }; Returns: undefined }
      seed_document_defaults: {
        Args: { _clinic_id: string }
        Returns: undefined
      }
      seed_dunning_defaults: {
        Args: { _clinic_id: string }
        Returns: undefined
      }
      seed_finance_defaults: {
        Args: { _clinic_id: string }
        Returns: undefined
      }
      seed_message_templates: {
        Args: { _clinic_id: string }
        Returns: undefined
      }
      set_active_clinic: { Args: { _clinic_id: string }; Returns: undefined }
      settle_online_charge: {
        Args: {
          _charge_id: string
          _fee_cents: number
          _paid_cents: number
          _paid_on: string
        }
        Returns: undefined
      }
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
      bank_tx_status: "unmatched" | "matched" | "ignored"
      cancel_reason: "patient_canceled" | "clinic_canceled" | "rescheduled"
      cash_movement_type: "in" | "out"
      category_type: "income" | "expense"
      charge_kind: "pix" | "boleto" | "link"
      charge_status: "pending" | "paid" | "overdue" | "canceled" | "refunded"
      commission_base: "received" | "executed"
      crc_channel: "call" | "whatsapp" | "other"
      crc_outcome: "no_answer" | "thinking" | "scheduled" | "not_interested"
      crc_queue:
        | "open_quotes"
        | "no_shows"
        | "first_visit_no_shows"
        | "untreated"
        | "overdue_returns"
        | "birthdays"
        | "overdue_payments"
      crm_stage_kind: "open" | "won" | "lost"
      document_kind:
        | "prescription"
        | "special_prescription"
        | "certificate"
        | "attendance"
        | "contract"
        | "consent"
        | "post_op"
        | "other"
      document_status: "issued" | "signed" | "canceled"
      lead_source:
        | "instagram"
        | "google"
        | "indicacao"
        | "site"
        | "anuncio"
        | "passante"
        | "outro"
      member_role: "owner" | "manager" | "dentist" | "receptionist"
      message_kind:
        | "appointment_reminder"
        | "appointment_confirmation"
        | "birthday"
        | "return_reminder"
        | "payment_reminder"
      message_status: "sent" | "simulated" | "failed" | "received"
      patient_file_kind: "photo" | "xray" | "document" | "other"
      patient_gender: "female" | "male" | "other" | "not_informed"
      patient_source: "indicacao" | "instagram" | "google" | "site" | "outro"
      payable_status: "open" | "paid" | "overdue" | "canceled"
      receivable_status: "open" | "paid" | "overdue" | "canceled"
      return_status: "pending" | "scheduled" | "done" | "dismissed"
      signature_purpose: "document" | "anamnesis"
      signature_status: "pending" | "signed" | "revoked"
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
      waitlist_period: "any" | "morning" | "afternoon" | "evening"
      waitlist_status: "waiting" | "scheduled" | "removed"
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
      bank_tx_status: ["unmatched", "matched", "ignored"],
      cancel_reason: ["patient_canceled", "clinic_canceled", "rescheduled"],
      cash_movement_type: ["in", "out"],
      category_type: ["income", "expense"],
      charge_kind: ["pix", "boleto", "link"],
      charge_status: ["pending", "paid", "overdue", "canceled", "refunded"],
      commission_base: ["received", "executed"],
      crc_channel: ["call", "whatsapp", "other"],
      crc_outcome: ["no_answer", "thinking", "scheduled", "not_interested"],
      crc_queue: [
        "open_quotes",
        "no_shows",
        "first_visit_no_shows",
        "untreated",
        "overdue_returns",
        "birthdays",
        "overdue_payments",
      ],
      crm_stage_kind: ["open", "won", "lost"],
      document_kind: [
        "prescription",
        "special_prescription",
        "certificate",
        "attendance",
        "contract",
        "consent",
        "post_op",
        "other",
      ],
      document_status: ["issued", "signed", "canceled"],
      lead_source: [
        "instagram",
        "google",
        "indicacao",
        "site",
        "anuncio",
        "passante",
        "outro",
      ],
      member_role: ["owner", "manager", "dentist", "receptionist"],
      message_kind: [
        "appointment_reminder",
        "appointment_confirmation",
        "birthday",
        "return_reminder",
        "payment_reminder",
      ],
      message_status: ["sent", "simulated", "failed", "received"],
      patient_file_kind: ["photo", "xray", "document", "other"],
      patient_gender: ["female", "male", "other", "not_informed"],
      patient_source: ["indicacao", "instagram", "google", "site", "outro"],
      payable_status: ["open", "paid", "overdue", "canceled"],
      receivable_status: ["open", "paid", "overdue", "canceled"],
      return_status: ["pending", "scheduled", "done", "dismissed"],
      signature_purpose: ["document", "anamnesis"],
      signature_status: ["pending", "signed", "revoked"],
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
      waitlist_period: ["any", "morning", "afternoon", "evening"],
      waitlist_status: ["waiting", "scheduled", "removed"],
    },
  },
} as const
