/**
 * Helpers de planilha para a importação de "Horas trabalhadas" (Movidesk:
 * relatório "Tempo trabalhado nos tickets"). Reaproveita o leitor
 * parseSpreadsheetFile e o casamento de cabeçalhos do módulo de chamados,
 * com sinônimos próprios dos campos de horas.
 */
import { findBestHeaderMatch, parseSpreadsheetFile, ParsedSpreadsheet } from '@/lib/spreadsheet'
import { parseHoras } from '@/lib/tempo-horas'
import { CAMPOS_HORAS, CampoHoraKey, MappingHoras } from '@/types/horas'

export { parseSpreadsheetFile, ParsedSpreadsheet, parseHoras }

const SINONIMOS_HORAS: Record<CampoHoraKey, string[]> = {
  numero_ticket: [
    'número do ticket',
    'numero do ticket',
    'ticket',
    'nº ticket',
    'n ticket',
    'id do ticket',
    'id',
    'código',
    'codigo',
    'chamado',
    'número',
    'numero',
  ],
  cliente: [
    'cliente',
    'clientes',
    'empresa',
    'razão social',
    'razao social',
    'nome do cliente',
    'contratante',
    'organização',
    'organizacao',
  ],
  tecnico: [
    'atendente',
    'técnico',
    'tecnico',
    'responsável',
    'responsavel',
    'executor',
    'analista',
    'usuário de lançamento',
    'usuario de lancamento',
    'colaborador',
    'quem lançou',
  ],
  departamento: ['departamento', 'setor', 'área', 'area', 'depto', 'serviço', 'servico'],
  data_lancamento: [
    'data do lançamento',
    'data do lancamento',
    'data lançamento',
    'data lancamento',
    'data inicial',
    'início',
    'inicio',
    'data',
  ],
  tempo_lancamento: [
    'tempo do lançamento',
    'tempo do lancamento',
    'tempo lancamento',
    'tempo trabalhado',
    'tempo gasto',
    'tempo apontado',
    'horas gastas',
    'duração',
    'duracao',
    'tempo',
  ],
  tempo_total_chamado: [
    'tempo total do chamado',
    'tempo total',
    'total do chamado',
    'tempo total trabalhado',
    'total',
  ],
  status: ['status', 'situação', 'situacao', 'estado', 'situação do ticket'],
}

/** Auto-detecção de mapeamento para a planilha de horas. */
export function autoDetectMappingHoras(headers: string[]): MappingHoras {
  const out = {} as MappingHoras
  for (const campo of CAMPOS_HORAS) {
    const matched = findBestHeaderMatch(headers, SINONIMOS_HORAS[campo])
    out[campo] = matched || ''
  }
  return out
}
