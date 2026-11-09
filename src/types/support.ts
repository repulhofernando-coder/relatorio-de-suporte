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
  aberto_por: string | null
  departamento: string | null
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
  aberto_por?: string | null
  departamento?: string | null
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
  | 'aberto_por'
  | 'departamento'

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
  {
    key: 'aberto_por',
    label: 'Aberto por',
    required: false,
    synonyms: [
      'aberto por',
      'abertura por',
      'solicitante',
      'solicitado por',
      'usuário',
      'usuario',
      'reportado por',
      'quem abriu',
    ],
    description: 'Quem abriu o chamado (não o técnico que atendeu)',
  },
  {
    key: 'departamento',
    label: 'Departamento',
    required: false,
    synonyms: ['departamento', 'setor', 'área', 'area', 'depto', 'department'],
    description: 'Setor que atendeu o chamado (ex.: Windows, Campo, Projetos)',
  },
]

export const DEPARTMENT_VALUES = ['Windows', 'Campo', 'Windows N2', 'Ativação', 'Projetos'] as const

/**
 * Normaliza o valor do departamento para um dos setores fixos (case/acentos insensível).
 * Valores fora da lista são devolvidos como vieram (trim).
 */
export function normalizeDepartamento(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const norm = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

  const direct = DEPARTMENT_VALUES.find(
    (d) =>
      d
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') === norm,
  )
  if (direct) return direct

  // Variações comuns: "Windows N2" escrito "windows n2"/"windowsN2"
  if (norm === 'windows n2' || norm === 'windowsn2' || norm === 'win n2') {
    return 'Windows N2'
  }

  return trimmed
}
