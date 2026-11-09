export interface SupportRecord {
  id: string
  user_id: string
  cliente: string
  tecnico: string
  data_chamado: string // YYYY-MM-DD
  tipo_chamado: string | null
  tempo_atendimento_min: number | null
  prioridade: string | null
  observacoes: string | null
  origem_arquivo: string | null
  import_id: string | null
  created_at: string
}

export interface SupportRecordInsert {
  cliente: string
  tecnico: string
  data_chamado: string
  tipo_chamado?: string | null
  tempo_atendimento_min?: number | null
  prioridade?: string | null
  observacoes?: string | null
  origem_arquivo?: string | null
  import_id?: string | null
  user_id?: string
}

export interface ImportRecord {
  id: string
  user_id: string
  nome_arquivo: string
  total_linhas: number
  importadas: number
  ignoradas: number
  erros: number
  status: 'concluído' | 'com erros' | string
  mapeamento_nome: string | null
  detalhes_erro: Array<{ linha: number; motivo: string }> | null
  created_at: string
}

export interface ImportRecordInsert {
  nome_arquivo: string
  total_linhas: number
  importadas: number
  ignoradas: number
  erros: number
  status: 'concluído' | 'com erros' | string
  mapeamento_nome?: string | null
  detalhes_erro?: Array<{ linha: number; motivo: string }> | null
  user_id?: string
}

export interface MapeamentoRecord {
  id: string
  user_id: string
  nome: string
  mapeamento: Record<string, string> // campo_padrao -> coluna_planilha
  created_at: string
  updated_at: string
}

export interface MapeamentoInsert {
  nome: string
  mapeamento: Record<string, string>
  user_id?: string
}

export type StandardFieldKey =
  | 'cliente'
  | 'tecnico'
  | 'data_chamado'
  | 'tipo_chamado'
  | 'tempo_atendimento_min'
  | 'prioridade'
  | 'observacoes'

export interface StandardFieldDef {
  key: StandardFieldKey
  label: string
  required: boolean
  synonyms: string[]
  description: string
}

export const STANDARD_FIELDS: StandardFieldDef[] = [
  {
    key: 'cliente',
    label: 'Cliente',
    required: true,
    synonyms: [
      'cliente',
      'clientes',
      'empresa',
      'razão social',
      'razao social',
      'nome do cliente',
      'contratante',
    ],
    description: 'Nome da empresa ou cliente solicitante',
  },
  {
    key: 'tecnico',
    label: 'Técnico',
    required: true,
    synonyms: [
      'técnico',
      'tecnico',
      'atendente',
      'responsável',
      'responsavel',
      'executor',
      'técnico responsável',
      'tecnico responsavel',
      'analista',
    ],
    description: 'Profissional que realizou o atendimento',
  },
  {
    key: 'data_chamado',
    label: 'Data do chamado',
    required: true,
    synonyms: [
      'data',
      'data do chamado',
      'data de abertura',
      'abertura',
      'data chamado',
      'data do atendimento',
      'data atendimento',
    ],
    description: 'Data em que o chamado foi aberto ou atendido',
  },
  {
    key: 'tipo_chamado',
    label: 'Tipo de chamado',
    required: false,
    synonyms: [
      'tipo',
      'tipo de chamado',
      'categoria',
      'assunto',
      'classificação',
      'classificacao',
      'tipo de atendimento',
      'natureza',
    ],
    description: 'Categoria ou natureza do chamado (ex.: Dúvida, Bug, Treinamento)',
  },
  {
    key: 'tempo_atendimento_min',
    label: 'Tempo de atendimento',
    required: false,
    synonyms: [
      'tempo',
      'tempo de atendimento',
      'duração',
      'duracao',
      'minutos',
      'tempo gasto',
      'tempo em minutos',
      'horas gastas',
      'horas',
    ],
    description: 'Duração em minutos ou horas',
  },
  {
    key: 'prioridade',
    label: 'Prioridade',
    required: false,
    synonyms: ['prioridade', 'urgência', 'urgencia', 'severidade', 'nível', 'nivel'],
    description: 'Nível de criticidade (ex.: Baixa, Média, Alta, Crítica)',
  },
  {
    key: 'observacoes',
    label: 'Observações',
    required: false,
    synonyms: [
      'observações',
      'observacoes',
      'obs',
      'detalhes',
      'descrição',
      'descricao',
      'comentário',
      'comentario',
    ],
    description: 'Anotações complementares sobre o chamado',
  },
]
