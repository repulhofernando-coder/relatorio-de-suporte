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
      client_contracts: {
        Row: {
          cliente: string
          created_at: string
          criado_por: string | null
          cumulativo: boolean
          horas_contratadas: number
          id: string
          periodo_meses: number | null
          updated_at: string
        }
        Insert: {
          cliente: string
          created_at?: string
          criado_por?: string | null
          cumulativo?: boolean
          horas_contratadas: number
          id?: string
          periodo_meses?: number | null
          updated_at?: string
        }
        Update: {
          cliente?: string
          created_at?: string
          criado_por?: string | null
          cumulativo?: boolean
          horas_contratadas?: number
          id?: string
          periodo_meses?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      department_capacity: {
        Row: {
          created_at: string
          departamento: string
          dias_uteis: number
          id: string
          limite_diario: number
          meta_chamados_dia: number | null
          meta_chamados_dia_max: number | null
          meta_chamados_dia_min: number | null
          meta_ocupacao_max: number | null
          meta_ocupacao_min: number | null
          meta_tma_max_num: number | null
          meta_tma_min: number | null
          meta_tma_min_num: number | null
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
          meta_chamados_dia?: number | null
          meta_chamados_dia_max?: number | null
          meta_chamados_dia_min?: number | null
          meta_ocupacao_max?: number | null
          meta_ocupacao_min?: number | null
          meta_tma_max_num?: number | null
          meta_tma_min?: number | null
          meta_tma_min_num?: number | null
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
          meta_chamados_dia?: number | null
          meta_chamados_dia_max?: number | null
          meta_chamados_dia_min?: number | null
          meta_ocupacao_max?: number | null
          meta_ocupacao_min?: number | null
          meta_tma_max_num?: number | null
          meta_tma_min?: number | null
          meta_tma_min_num?: number | null
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
          tipo: string
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
          tipo?: string
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
          tipo?: string
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
      saved_reports: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          filters: Json
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          filters: Json
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          filters?: Json
          id?: string
          name?: string
        }
        Relationships: []
      }
      support_records: {
        Row: {
          aberto_por: string | null
          assunto: string | null
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
          sla_status: string | null
          tecnico: string
          tempo_atendimento_min: number | null
          tempo_trabalhado: number | null
          tipo_chamado: string | null
          user_id: string
        }
        Insert: {
          aberto_por?: string | null
          assunto?: string | null
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
          sla_status?: string | null
          tecnico: string
          tempo_atendimento_min?: number | null
          tempo_trabalhado?: number | null
          tipo_chamado?: string | null
          user_id: string
        }
        Update: {
          aberto_por?: string | null
          assunto?: string | null
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
          sla_status?: string | null
          tecnico?: string
          tempo_atendimento_min?: number | null
          tempo_trabalhado?: number | null
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
      time_logs: {
        Row: {
          cliente: string | null
          created_at: string
          data_lancamento: string | null
          departamento: string | null
          eh_total_chamado: boolean
          extras: Json
          horas_total_chamado: number | null
          id: string
          import_id: string
          minutos: number
          numero_ticket: string | null
          origem_arquivo: string | null
          status: string | null
          tecnico: string | null
          user_id: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_lancamento?: string | null
          departamento?: string | null
          eh_total_chamado?: boolean
          extras?: Json
          horas_total_chamado?: number | null
          id?: string
          import_id: string
          minutos?: number
          numero_ticket?: string | null
          origem_arquivo?: string | null
          status?: string | null
          tecnico?: string | null
          user_id?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_lancamento?: string | null
          departamento?: string | null
          eh_total_chamado?: boolean
          extras?: Json
          horas_total_chamado?: number | null
          id?: string
          import_id?: string
          minutos?: number
          numero_ticket?: string | null
          origem_arquivo?: string | null
          status?: string | null
          tecnico?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'time_logs_import_id_fkey'
            columns: ['import_id']
            isOneToOne: false
            referencedRelation: 'imports'
            referencedColumns: ['id']
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string
          p_nome?: string
          p_password: string
          p_role?: string
        }
        Returns: string
      }
      admin_update_user_role: {
        Args: { p_new_role: string; p_target_user_id: string }
        Returns: string
      }
      create_system_user: {
        Args: { new_email: string; new_name?: string; new_password: string }
        Returns: Json
      }
      get_db_usage: { Args: never; Returns: Json }
      get_departamentos_em_uso: { Args: never; Returns: string[] }
      is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      list_system_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          name: string
          role: string
        }[]
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
