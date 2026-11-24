export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      billing_events: {
        Row: {
          event_id: string
          id: number
          payload: NonNullable<Json>
          processed_at: string | null
          provider: string
          received_at: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          id?: never
          payload: NonNullable<Json>
          processed_at?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_id?: string
          id?: never
          payload?: NonNullable<Json>
          processed_at?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          data: NonNullable<Json>
          deleted_at: string | null
          description: string | null
          id: string
          inserted_at: string
          rev: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          data: NonNullable<Json>
          deleted_at?: string | null
          description?: never
          id: string
          inserted_at?: string
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          description?: never
          id?: string
          inserted_at?: string
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          data: NonNullable<Json>
          deleted_at: string | null
          document_digits: string | null
          id: string
          inserted_at: string
          name: string | null
          rev: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          data: NonNullable<Json>
          deleted_at?: string | null
          document_digits?: never
          id: string
          inserted_at?: string
          name?: never
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          document_digits?: never
          id?: string
          inserted_at?: string
          name?: never
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          data: NonNullable<Json>
          deleted_at: string | null
          id: string
          inserted_at: string
          next_number: number
          rev: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          data: NonNullable<Json>
          deleted_at?: string | null
          id: string
          inserted_at?: string
          next_number?: number
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          id?: string
          inserted_at?: string
          next_number?: number
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          max_company_profiles: number | null
          max_new_quotes_per_month: number | null
          plan: string
        }
        ComputedFields: never
        Insert: {
          max_company_profiles?: number | null
          max_new_quotes_per_month?: number | null
          plan: string
        }
        Update: {
          max_company_profiles?: number | null
          max_new_quotes_per_month?: number | null
          plan?: string
        }
        Relationships: []
      }
      plan_prices: {
        Row: {
          amount: number
          billing_interval: string
          months: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          billing_interval: string
          months: number
        }
        Update: {
          amount?: number
          billing_interval?: string
          months?: number
        }
        Relationships: []
      }
      quotes: {
        Row: {
          data: NonNullable<Json>
          deleted_at: string | null
          id: string
          imported: boolean
          inserted_at: string
          issue_date: string
          number: string
          profile_id: string
          rev: number
          status: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          data: NonNullable<Json>
          deleted_at?: string | null
          id: string
          imported?: boolean
          inserted_at?: string
          issue_date: string
          number: string
          profile_id: string
          rev?: number
          status: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          id?: string
          imported?: boolean
          inserted_at?: string
          issue_date?: string
          number?: string
          profile_id?: string
          rev?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
          current_period_end: string | null
          plan: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          billing_interval?: string | null
          current_period_end?: string | null
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          current_period_end?: string | null
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_billing_interval_fkey'
            columns: ['billing_interval']
            isOneToOne: false
            referencedRelation: 'plan_prices'
            referencedColumns: ['billing_interval']
          },
          {
            foreignKeyName: 'subscriptions_plan_fkey'
            columns: ['plan']
            isOneToOne: false
            referencedRelation: 'plan_limits'
            referencedColumns: ['plan']
          },
        ]
      }
      user_settings: {
        Row: {
          data: NonNullable<Json>
          deleted_at: string | null
          id: string
          inserted_at: string
          rev: number
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          id?: string
          inserted_at?: string
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          data?: NonNullable<Json>
          deleted_at?: string | null
          id?: string
          inserted_at?: string
          rev?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aplicar_alteracoes: { Args: { p_changes: Json }; Returns: Json }
      buscar_alteracoes: { Args: { p_desde?: string; p_limite?: number }; Returns: Json }
      definir_proximo_numero: { Args: { p_empresa: string; p_proximo: number }; Returns: number }
      importar_dados: { Args: { p_changes: Json }; Returns: Json }
      reservar_numeros_orcamento: { Args: { p_empresa: string; p_quantidade?: number }; Returns: number }
      uso_do_plano: { Args: Record<PropertyKey, never>; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
