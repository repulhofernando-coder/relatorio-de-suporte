// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      department_capacity: {
        Row: {
          created_at: string
          departamento: string
          dias_uteis: number
          id: string
          limite_diario: number
          qtd_tecnicos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          departamento: string
          dias_uteis?: number
          id?: string
          limite_diario?: number
          qtd_tecnicos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          departamento?: string
          dias_uteis?: number
          id?: string
          limite_diario?: number
          qtd_tecnicos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          created_at: string
          detalhes_erro: Json | null
          erros: number
          id: string
          ignoradas: number
          importadas: number
          mapeamento_nome: string | null
          nome_arquivo: string
          status: string
          total_linhas: number
          user_id: string
        }
        Insert: {
          created_at?: string
          detalhes_erro?: Json | null
          erros?: number
          id?: string
          ignoradas?: number
          importadas?: number
          mapeamento_nome?: string | null
          nome_arquivo: string
          status?: string
          total_linhas?: number
          user_id: string
        }
        Update: {
          created_at?: string
          detalhes_erro?: Json | null
          erros?: number
          id?: string
          ignoradas?: number
          importadas?: number
          mapeamento_nome?: string | null
          nome_arquivo?: string
          status?: string
          total_linhas?: number
          user_id?: string
        }
        Relationships: []
      }
      mapeamentos: {
        Row: {
          created_at: string
          id: string
          mapeamento: Json
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapeamento: Json
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapeamento?: Json
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_records: {
        Row: {
          aberto_por: string | null
          cliente: string
          created_at: string
          data_chamado: string
          departamento: string | null
          id: string
          import_id: string | null
          numero: string | null
          observacoes: string | null
          organizacao: string | null
          origem_arquivo: string | null
          prioridade: string | null
          sla_horas: number | null
          tecnico: string
          tempo_atendimento_min: number | null
          tipo_chamado: string | null
          user_id: string
        }
        Insert: {
          aberto_por?: string | null
          cliente: string
          created_at?: string
          data_chamado: string
          departamento?: string | null
          id?: string
          import_id?: string | null
          numero?: string | null
          observacoes?: string | null
          organizacao?: string | null
          origem_arquivo?: string | null
          prioridade?: string | null
          sla_horas?: number | null
          tecnico: string
          tempo_atendimento_min?: number | null
          tipo_chamado?: string | null
          user_id: string
        }
        Update: {
          aberto_por?: string | null
          cliente?: string
          created_at?: string
          data_chamado?: string
          departamento?: string | null
          id?: string
          import_id?: string | null
          numero?: string | null
          observacoes?: string | null
          organizacao?: string | null
          origem_arquivo?: string | null
          prioridade?: string | null
          sla_horas?: number | null
          tecnico?: string
          tempo_atendimento_min?: number | null
          tipo_chamado?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_records_import_id_fkey'
            columns: ['import_id']
            isOneToOne: false
            referencedRelation: 'imports'
            referencedColumns: ['id']
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
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
