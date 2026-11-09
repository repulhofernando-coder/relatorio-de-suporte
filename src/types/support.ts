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
  sla_horas: number | null
  numero: string | null
  organizacao: string | null
  assunto: string | null
  sla_status: string | null
  tempo_trabalhado: number | null
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
  sla_horas?: number | null
  numero?: string | null
  organizacao?: string | null
  assunto?: string | null
  sla_status?: string | null
  tempo_trabalhado?: number | null
  import_id?: string | null
  user_id?: string
}

export interface DepartmentCapacityRecord {
  id: string
  user_id: string
  departamento: string
  qtd_tecnicos: number
  dias_uteis: number
  limite_diario: number
  meta_tma_min?: number | null
  meta_chamados_dia?: number | null
  created_at: string
  updated_at: string
}

export interface DepartmentCapacityUpsert {
  departamento: string
  qtd_tecnicos: number
  dias_uteis: number
  limite_diario: number
  meta_tma_min?: number | null
  meta_chamados_dia?: number | null
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
  | 'sla_horas'
  | 'numero'
  | 'organizacao'
  | 'assunto'
  | 'sla_status'
  | 'tempo_trabalhado'

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
      'criado por',
      'criador',
      'autor',
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
  {
    key: 'sla_horas',
    label: 'Tempo de SLA',
    required: false,
    synonyms: [
      'sla',
      'tempo de sla',
      'tempo sla',
      'sla (h)',
      'sla (horas)',
      'sla horas',
      'horas de sla',
      'horas de sla utilizadas',
      'tempo de atendimento sla',
      'tempo de solucao',
      'tempo de solução',
      'tempo até a solução',
      'tempo até a solucao',
      'sla em horas',
      'sla total',
      'tempo total sla',
      'tempo de resposta',
    ],
    description: 'Tempo de SLA do chamado, em horas (ex.: 2,5 ou "2h30")',
  },
  {
    key: 'numero',
    label: 'Número do chamado',
    required: false,
    synonyms: [
      'número',
      'numero',
      'nº',
      'no',
      'num',
      'chamado',
      'n chamado',
      'numero do chamado',
      'número do chamado',
      'nº do chamado',
      'ticket',
      'ticket id',
      'id',
      'id do chamado',
      'cod',
      'código',
      'codigo',
    ],
    description: 'Número/identificador do chamado na planilha (ex.: INC0012345)',
  },
  {
    key: 'organizacao',
    label: 'Cliente / Organização',
    required: false,
    synonyms: [
      'organização',
      'organizacao',
      'cliente organização',
      'cliente organizacao',
      'org',
      'empresa do cliente',
      'unidade',
      'filial',
    ],
    description:
      'Organização/unidade do cliente referente ao chamado (se for a mesma coluna de Cliente, pode deixar sem mapear)',
  },
  {
    key: 'assunto',
    label: 'Assunto',
    required: false,
    synonyms: [
      'assunto',
      'assunto do chamado',
      'título',
      'titulo',
      'descrição',
      'descricao',
      'resumo',
      'subject',
      'sumário',
      'sumario',
      'tema',
    ],
    description: 'Título ou resumo do chamado (ex.: assunto, subject, descrição breve)',
  },
  {
    key: 'sla_status',
    label: 'Indicador de SLA na resposta',
    required: false,
    synonyms: [
      'indicador de sla na resposta',
      'indicador de sla',
      'indicador sla na resposta',
      'indicador sla',
      'sla resposta',
      'status do sla',
      'status sla',
      'sla status',
      'sla no prazo',
      'sla cumprido',
    ],
    description: 'Status binário de SLA de resposta ("dentro" ou "fora" do prazo)',
  },
  {
    key: 'tempo_trabalhado',
    label: 'Tempo trabalhado',
    required: false,
    synonyms: [
      'tempo trabalhado',
      'horas trabalhadas',
      'tempo gasto',
      'duracao trabalhada',
      'tempo total trabalhado',
      'tempo de trabalho',
      'tempo apontado',
      'worked time',
    ],
    description: 'Tempo total dedicado ao chamado (convertido para horas decimais)',
  },
]

export const DEPARTMENT_VALUES = ['Windows', 'Campo', 'Windows N2', 'Ativação', 'Projetos'] as const

/**
 * Remove prefixos numéricos e espaços do início de um valor de departamento
 * (ex.: "01.Windows" → "Windows", "02. Windows N2" → "Windows N2", "04. Campo" → "Campo").
 */
export function stripDepartamentoPrefix(value: string): string {
  return value.replace(/^\s*\d+\s*[.\-–—:]?\s*/, '')
}

function normalizeBase(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza o valor do departamento (case/acentos insensível, ignorando prefixos
 * numéricos como "01." e espaços): "01.Windows" → Windows, "04. Campo" → Campo.
 * Valores fora dos setores conhecidos são devolvidos como vieram (trim).
 */
export function normalizeDepartamento(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = stripDepartamentoPrefix(String(value)).trim()
  if (!trimmed) return null
  const norm = normalizeBase(trimmed)

  const direct = DEPARTMENT_VALUES.find((d) => normalizeBase(d) === norm)
  if (direct) return direct

  // Variações comuns: "Windows N2" escrito "windowsn2"/"win n2"
  if (norm === 'windows n2' || norm === 'windowsn2' || norm === 'win n2') {
    return 'Windows N2'
  }

  return trimmed
}
