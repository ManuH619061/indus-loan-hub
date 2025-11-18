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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      amortization_rows: {
        Row: {
          closing_principal: number
          created_at: string | null
          due_on: string
          extra_payment: number | null
          id: string
          interest_component: number
          is_paid: boolean | null
          loan_id: string
          opening_principal: number
          period_no: number
          period_start: string
          principal_component: number
          scheduled_emi: number
        }
        Insert: {
          closing_principal: number
          created_at?: string | null
          due_on: string
          extra_payment?: number | null
          id?: string
          interest_component: number
          is_paid?: boolean | null
          loan_id: string
          opening_principal: number
          period_no: number
          period_start: string
          principal_component: number
          scheduled_emi: number
        }
        Update: {
          closing_principal?: number
          created_at?: string | null
          due_on?: string
          extra_payment?: number | null
          id?: string
          interest_component?: number
          is_paid?: boolean | null
          loan_id?: string
          opening_principal?: number
          period_no?: number
          period_start?: string
          principal_component?: number
          scheduled_emi?: number
        }
        Relationships: [
          {
            foreignKeyName: "amortization_rows_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          bank_type: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_rows: number
          file_name: string
          file_size: number | null
          id: string
          status: string
          successful_rows: number
          total_rows: number
          user_id: string
        }
        Insert: {
          bank_type: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_rows?: number
          file_name: string
          file_size?: number | null
          id?: string
          status?: string
          successful_rows?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          bank_type?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_rows?: number
          file_name?: string
          file_size?: number | null
          id?: string
          status?: string
          successful_rows?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount: number
          charge_on: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string | null
          description: string | null
          id: string
          loan_id: string
        }
        Insert: {
          amount: number
          charge_on: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at?: string | null
          description?: string | null
          id?: string
          loan_id: string
        }
        Update: {
          amount?: number
          charge_on?: string
          charge_type?: Database["public"]["Enums"]["charge_type"]
          created_at?: string | null
          description?: string | null
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          added_on: string | null
          doc_type: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          label: string
          loan_id: string
          noc_date: string | null
          notes: string | null
          received_via: string | null
          reminder_days_before: number | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          added_on?: string | null
          doc_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          label: string
          loan_id: string
          noc_date?: string | null
          notes?: string | null
          received_via?: string | null
          reminder_days_before?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          added_on?: string | null
          doc_type?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          label?: string
          loan_id?: string
          noc_date?: string | null
          notes?: string | null
          received_via?: string | null
          reminder_days_before?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          loan_id: string | null
          monthly_extra_payment: number | null
          notes: string | null
          target_amount: number | null
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          loan_id?: string | null
          monthly_extra_payment?: number | null
          notes?: string | null
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          loan_id?: string | null
          monthly_extra_payment?: number | null
          notes?: string | null
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          app_display_name: string | null
          app_link: string | null
          contact: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          requires_noc_on_close: boolean | null
          requires_sanction_letter: boolean | null
          type: Database["public"]["Enums"]["lender_type"]
          updated_at: string | null
          upi_vpa: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          app_display_name?: string | null
          app_link?: string | null
          contact?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          requires_noc_on_close?: boolean | null
          requires_sanction_letter?: boolean | null
          type?: Database["public"]["Enums"]["lender_type"]
          updated_at?: string | null
          upi_vpa?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          app_display_name?: string | null
          app_link?: string | null
          contact?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          requires_noc_on_close?: boolean | null
          requires_sanction_letter?: boolean | null
          type?: Database["public"]["Enums"]["lender_type"]
          updated_at?: string | null
          upi_vpa?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      loan_tags: {
        Row: {
          created_at: string | null
          loan_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          loan_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          loan_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_tags_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          auto_debit: boolean | null
          autopay_bank: string | null
          billing_day: number | null
          closure_date: string | null
          compounding: Database["public"]["Enums"]["compounding_type"]
          created_at: string | null
          disbursed_on: string
          due_day: number | null
          emi_amount: number | null
          gst_on_fees: number | null
          id: string
          insurance_fee: number | null
          interest_rate_apy: number
          lender_id: string | null
          loan_name: string
          loan_type: Database["public"]["Enums"]["loan_type"]
          logo_url: string | null
          mandate_ref: string | null
          other_upfront_costs: number | null
          penalty_rule_id: string | null
          preferred_method: string | null
          principal_amount: number
          processing_fee: number | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          recast_mode: Database["public"]["Enums"]["recast_mode"] | null
          remarks: string | null
          status: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_debit?: boolean | null
          autopay_bank?: string | null
          billing_day?: number | null
          closure_date?: string | null
          compounding?: Database["public"]["Enums"]["compounding_type"]
          created_at?: string | null
          disbursed_on: string
          due_day?: number | null
          emi_amount?: number | null
          gst_on_fees?: number | null
          id?: string
          insurance_fee?: number | null
          interest_rate_apy: number
          lender_id?: string | null
          loan_name: string
          loan_type?: Database["public"]["Enums"]["loan_type"]
          logo_url?: string | null
          mandate_ref?: string | null
          other_upfront_costs?: number | null
          penalty_rule_id?: string | null
          preferred_method?: string | null
          principal_amount: number
          processing_fee?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          recast_mode?: Database["public"]["Enums"]["recast_mode"] | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_debit?: boolean | null
          autopay_bank?: string | null
          billing_day?: number | null
          closure_date?: string | null
          compounding?: Database["public"]["Enums"]["compounding_type"]
          created_at?: string | null
          disbursed_on?: string
          due_day?: number | null
          emi_amount?: number | null
          gst_on_fees?: number | null
          id?: string
          insurance_fee?: number | null
          interest_rate_apy?: number
          lender_id?: string | null
          loan_name?: string
          loan_type?: Database["public"]["Enums"]["loan_type"]
          logo_url?: string | null
          mandate_ref?: string | null
          other_upfront_costs?: number | null
          penalty_rule_id?: string | null
          preferred_method?: string | null
          principal_amount?: number
          processing_fee?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          recast_mode?: Database["public"]["Enums"]["recast_mode"] | null
          remarks?: string | null
          status?: Database["public"]["Enums"]["loan_status"]
          tenure_months?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_penalty_rule_id_fkey"
            columns: ["penalty_rule_id"]
            isOneToOne: false
            referencedRelation: "penalty_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          created_at: string | null
          eating_out: number | null
          eating_out_limit: number | null
          extra_emi_amount: number | null
          food: number | null
          food_limit: number | null
          id: string
          insurance: number | null
          month_year: string
          notes: string | null
          other_income: number | null
          other_variable: number | null
          rent: number | null
          salary: number | null
          savings_investments: number | null
          school: number | null
          shopping: number | null
          shopping_limit: number | null
          side_income: number | null
          strategy: string | null
          subscriptions: number | null
          transport: number | null
          travel: number | null
          travel_limit: number | null
          updated_at: string | null
          user_id: string
          utilities: number | null
        }
        Insert: {
          created_at?: string | null
          eating_out?: number | null
          eating_out_limit?: number | null
          extra_emi_amount?: number | null
          food?: number | null
          food_limit?: number | null
          id?: string
          insurance?: number | null
          month_year: string
          notes?: string | null
          other_income?: number | null
          other_variable?: number | null
          rent?: number | null
          salary?: number | null
          savings_investments?: number | null
          school?: number | null
          shopping?: number | null
          shopping_limit?: number | null
          side_income?: number | null
          strategy?: string | null
          subscriptions?: number | null
          transport?: number | null
          travel?: number | null
          travel_limit?: number | null
          updated_at?: string | null
          user_id: string
          utilities?: number | null
        }
        Update: {
          created_at?: string | null
          eating_out?: number | null
          eating_out_limit?: number | null
          extra_emi_amount?: number | null
          food?: number | null
          food_limit?: number | null
          id?: string
          insurance?: number | null
          month_year?: string
          notes?: string | null
          other_income?: number | null
          other_variable?: number | null
          rent?: number | null
          salary?: number | null
          savings_investments?: number | null
          school?: number | null
          shopping?: number | null
          shopping_limit?: number | null
          side_income?: number | null
          strategy?: string | null
          subscriptions?: number | null
          transport?: number | null
          travel?: number | null
          travel_limit?: number | null
          updated_at?: string | null
          user_id?: string
          utilities?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          external_ref: string | null
          gateway_app: string | null
          id: string
          loan_id: string
          method: string | null
          notes: string | null
          paid_on: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference: string | null
          source: Database["public"]["Enums"]["payment_source"]
          suggestion_used: string | null
          updated_at: string | null
          upi_txn_id: string | null
          upi_vpa: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          external_ref?: string | null
          gateway_app?: string | null
          id?: string
          loan_id: string
          method?: string | null
          notes?: string | null
          paid_on: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
          source?: Database["public"]["Enums"]["payment_source"]
          suggestion_used?: string | null
          updated_at?: string | null
          upi_txn_id?: string | null
          upi_vpa?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          external_ref?: string | null
          gateway_app?: string | null
          id?: string
          loan_id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference?: string | null
          source?: Database["public"]["Enums"]["payment_source"]
          suggestion_used?: string | null
          updated_at?: string | null
          upi_txn_id?: string | null
          upi_vpa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_rules: {
        Row: {
          created_at: string | null
          grace_days: number | null
          id: string
          late_fee_flat: number | null
          late_fee_percent: number | null
          name: string
          penal_interest_pa: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          grace_days?: number | null
          id?: string
          late_fee_flat?: number | null
          late_fee_percent?: number | null
          name: string
          penal_interest_pa?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          grace_days?: number | null
          id?: string
          late_fee_flat?: number | null
          late_fee_percent?: number | null
          name?: string
          penal_interest_pa?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          currency: string | null
          email: string
          id: string
          monthly_income: number | null
          name: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          email: string
          id: string
          monthly_income?: number | null
          name?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          email?: string
          id?: string
          monthly_income?: number | null
          name?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_changes: {
        Row: {
          created_at: string | null
          effective_from: string
          id: string
          loan_id: string
          new_interest_rate_apy: number
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          effective_from: string
          id?: string
          loan_id: string
          new_interest_rate_apy: number
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          effective_from?: string
          id?: string
          loan_id?: string
          new_interest_rate_apy?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_changes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_name: string | null
          account_type: string | null
          balance: number | null
          bank_type: string
          category: string
          created_at: string
          credit: number | null
          debit: number | null
          id: string
          import_id: string | null
          is_emi: boolean | null
          is_transfer: boolean | null
          loan_id: string | null
          narration: string
          notes: string | null
          reference: string | null
          subcategory: string | null
          transaction_date: string
          updated_at: string
          user_id: string
          value_date: string | null
        }
        Insert: {
          account_name?: string | null
          account_type?: string | null
          balance?: number | null
          bank_type: string
          category?: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          import_id?: string | null
          is_emi?: boolean | null
          is_transfer?: boolean | null
          loan_id?: string | null
          narration: string
          notes?: string | null
          reference?: string | null
          subcategory?: string | null
          transaction_date: string
          updated_at?: string
          user_id: string
          value_date?: string | null
        }
        Update: {
          account_name?: string | null
          account_type?: string | null
          balance?: number | null
          bank_type?: string
          category?: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          import_id?: string | null
          is_emi?: boolean | null
          is_transfer?: boolean | null
          loan_id?: string | null
          narration?: string
          notes?: string | null
          reference?: string | null
          subcategory?: string | null
          transaction_date?: string
          updated_at?: string
          user_id?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      charge_type:
        | "PROCESSING"
        | "LATE_FEE"
        | "PENAL_INTEREST"
        | "FORECLOSURE"
        | "INSURANCE"
        | "OTHERS"
      compounding_type: "MONTHLY" | "DAILY" | "QUARTERLY" | "ANNUAL"
      lender_type: "BANK" | "NBFC" | "CARD" | "FRIEND" | "OTHER"
      loan_status: "ACTIVE" | "CLOSED" | "DEFAULTED"
      loan_type:
        | "PERSONAL"
        | "CREDIT_CARD_CONVERSION"
        | "CONSUMER_DURABLE"
        | "EDUCATION"
        | "VEHICLE"
        | "HOME_TOPUP"
        | "OTHER"
      payment_source:
        | "UPI"
        | "NETBANKING"
        | "CASH"
        | "CARD"
        | "ACH"
        | "OTHER"
        | "UPI_PHONEPE"
        | "UPI_GPAY"
        | "UPI_PAYTM"
        | "APP_NAVI"
      payment_type:
        | "EMI"
        | "FULL_PREPAY"
        | "PART_PREPAY"
        | "LATE_FEE"
        | "OTHER_FEE"
        | "REFUND"
        | "REVERSAL"
      rate_type: "REDUCING" | "FLAT"
      recast_mode: "REDUCE_TENURE" | "REDUCE_EMI"
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
    Enums: {
      charge_type: [
        "PROCESSING",
        "LATE_FEE",
        "PENAL_INTEREST",
        "FORECLOSURE",
        "INSURANCE",
        "OTHERS",
      ],
      compounding_type: ["MONTHLY", "DAILY", "QUARTERLY", "ANNUAL"],
      lender_type: ["BANK", "NBFC", "CARD", "FRIEND", "OTHER"],
      loan_status: ["ACTIVE", "CLOSED", "DEFAULTED"],
      loan_type: [
        "PERSONAL",
        "CREDIT_CARD_CONVERSION",
        "CONSUMER_DURABLE",
        "EDUCATION",
        "VEHICLE",
        "HOME_TOPUP",
        "OTHER",
      ],
      payment_source: [
        "UPI",
        "NETBANKING",
        "CASH",
        "CARD",
        "ACH",
        "OTHER",
        "UPI_PHONEPE",
        "UPI_GPAY",
        "UPI_PAYTM",
        "APP_NAVI",
      ],
      payment_type: [
        "EMI",
        "FULL_PREPAY",
        "PART_PREPAY",
        "LATE_FEE",
        "OTHER_FEE",
        "REFUND",
        "REVERSAL",
      ],
      rate_type: ["REDUCING", "FLAT"],
      recast_mode: ["REDUCE_TENURE", "REDUCE_EMI"],
    },
  },
} as const
