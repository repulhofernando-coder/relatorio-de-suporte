/**
 * Traduz erros do Supabase/PostgREST em mensagens claras em português.
 *
 * Códigos mais comuns:
 * - 23503: foreign_key_violation
 * - 42703: undefined_column
 * - 42501: insufficient_privilege (RLS)
 * - 23505: unique_violation
 * - 23502: not_null_violation
 * - 22P02: invalid_text_representation
 * - 42P01: undefined_table
 * - PGRST*: erros da camada PostgREST
 */

export interface SupabaseErrorLike {
  code?: string | null
  message?: string | null
  hint?: string | null
  details?: string | null
}

const TRADUCOES: Record<string, { titulo: string; dica?: string }> = {
  '23503': {
    titulo:
      'Violação de chave estrangeira: o registro depende de outro que não existe (ex.: importação ou chamado vinculado inexistente).',
    dica: 'Verifique se o registro de importação ainda existe antes de gravar os dados.',
  },
  '23505': {
    titulo: 'Registro duplicado: já existe um item com o mesmo identificador.',
    dica: 'Remova a duplicidade ou use a opção de atualizar registros existentes.',
  },
  '23502': {
    titulo: 'Campo obrigatório vazio: faltou preencher uma coluna obrigatória (ex.: cliente).',
    dica: 'Confira o mapeamento das colunas obrigatórias no passo 2.',
  },
  '23514': {
    titulo: 'Valor fora das regras da tabela (violação de verificação).',
  },
  '42501': {
    titulo: 'Sem permissão: as regras de acesso (RLS) bloquearam a operação para o seu usuário.',
    dica: 'Faça login novamente ou peça acesso de administrador.',
  },
  '42703': {
    titulo: 'Coluna inexistente na tabela do banco.',
    dica: 'Provavelmente o mapeamento gravou um campo que não corresponde ao layout atual do banco.',
  },
  '42P01': {
    titulo: 'Tabela inexistente no banco de dados.',
    dica: 'A estrutura do banco precisa ser atualizada (migração pendente no backend).',
  },
  '22P02': {
    titulo: 'Valor inválido para o tipo da coluna (ex.: texto onde se espera número ou data).',
    dica: 'Verifique se as colunas mapeadas contêm valores coerentes.',
  },
  '22001': {
    titulo: 'Valor longo demais para a coluna de destino.',
  },
  PGRST301: {
    titulo: 'Consulta demorou demais no banco (timeout).',
    dica: 'Reduza o período ou o tamanho do arquivo e tente novamente.',
  },
}

/**
 * Recebe qualquer erro (do Supabase, do parse da planilha ou genérico) e devolve
 * uma mensagem em PT-BR pronta para exibir na tela.
 */
export function traduzirErro(err: unknown): string {
  if (!err) {
    return 'Erro desconhecido durante a operação.'
  }

  // Erro de rede / fetch falhou (typical: JWT expirado, serviço fora do ar)
  if (err instanceof TypeError && /fetch|network/i.test(err.message || '')) {
    return 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
  }

  const e = err as SupabaseErrorLike & { code?: string; message?: string; hint?: string }

  const code = typeof e?.code === 'string' ? e.code : null
  const rawMessage = typeof e?.message === 'string' ? e.message.trim() : ''

  if (code && TRADUCOES[code]) {
    const t = TRADUCOES[code]
    let msg = t.titulo
    if (t.dica) msg += ` ${t.dica}`
    if (rawMessage) msg += ` (detalhe técnico: ${rawMessage})`
    return msg
  }

  // Mensagens do PostgREST/Supabase sem code estruturado
  if (rawMessage) {
    const lower = rawMessage.toLowerCase()
    if (lower.includes('violates foreign key constraint')) {
      return `Violação de vínculo entre tabelas: um registro relacionado não existe. (${rawMessage})`
    }
    if (lower.includes('violates row-level security')) {
      return 'Operação bloqueada pelas regras de acesso (RLS) do banco. Verifique seu perfil de usuário.'
    }
    if (lower.includes('jwt expired') || lower.includes('invalid jwt')) {
      return 'Sua sessão expirou. Faça login novamente e repita a operação.'
    }
    if (lower.includes('duplicate key')) {
      return 'Registro duplicado: já existe um item com esse mesmo identificador.'
    }
    if (lower.includes('column') && lower.includes('does not exist')) {
      return `Coluna inexistente no banco: ${rawMessage}`
    }
    return rawMessage
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  return 'Erro inesperado durante a operação. Tente novamente.'
}
