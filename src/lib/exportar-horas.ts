import { loadSheetJS } from '@/lib/spreadsheet'
import type { HorasDashboardData } from '@/services/horas'
import { agregarHorasPorTecnico } from '@/lib/tempo-horas'
import type { HorasPorDepartamento } from '@/lib/tempo-horas'
import type { MediaMensalCliente } from '@/lib/media-mensal'

/**
 * Exportação dos dados de /horas — arquivo .xlsx com o que está NA TELA
 * (mesmos filtros de período, departamento e busca de cliente/técnico já
 * aplicados nos logs da visão).
 *
 * Abas:
 *  - "Resumo"           : título, período, filtros, totais e data de geração
 *  - "Ranking clientes" : posição, cliente, total de horas, média/mês,
 *                          nº de lançamentos, % do total
 *  - "Horas por técnico": técnico, chamados, total de horas, média/chamado, %
 *
 * O SheetJS já é usado na importação (carregado por CDN em loadSheetJS) e é
 * reaproveitado aqui para GERAR o arquivo — nenhuma dependência nova.
 */

interface ExportarHorasParams {
  visao: HorasDashboardData
  porDepto: HorasPorDepartamento[]
  mediaMensalPorCliente: Map<string, MediaMensalCliente>
  /** Rótulo do período ativo (ex.: "Este ano", "2025-01-01 → 2025-03-31"). */
  periodo: string
  /** Departamento ativo ("Todos" quando o filtro é "todos"). */
  departamento: string
  /** Busca de cliente ativa (ou null). */
  buscaCliente: string | null
  /** Busca de técnico ativa (ou null). */
  buscaTecnico: string | null
}

function dataHoraGeracao(): string {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function dataArquivo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Slug simples do período para o nome do arquivo (sem acentos/simbolos). */
function slugPeriodo(periodo: string): string {
  return (
    periodo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tudo'
  )
}

export async function exportarHorasDashboard(params: ExportarHorasParams): Promise<void> {
  const {
    visao,
    porDepto,
    mediaMensalPorCliente,
    periodo,
    departamento,
    buscaCliente,
    buscaTecnico,
  } = params

  const XLSX = await loadSheetJS()
  if (!XLSX?.utils?.book_new || !XLSX?.write) {
    throw new Error('Biblioteca de planilhas (SheetJS) não disponível — verifique sua conexão.')
  }

  const resumo = visao.resumo
  const wb = XLSX.utils.book_new()

  /* ---------- Aba 1: RESUMO ---------- */
  const resumoRows: (string | number)[][] = [
    ['Suporte Analytics — Horas por cliente'],
    [],
    ['Período', periodo],
    ['Departamento', departamento],
    ['Busca por cliente', buscaCliente ?? '—'],
    ['Busca por técnico', buscaTecnico ?? '—'],
    [],
    ['Total de horas', resumo.totalHoras],
    ['Chamados com lançamento', resumo.chamadosComLancamento],
    ['Média por chamado (h)', resumo.mediaHorasPorChamado ?? '—'],
    ['Lançamentos de horas', visao.logs.length],
    ['Gerado em', dataHoraGeracao()],
  ]
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows)
  wsResumo['!cols'] = [{ wch: 28 }, { wch: 34 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  /* ---------- Aba 2: RANKING DE CLIENTES ---------- */
  // Nº de lançamentos por cliente (uma passada só, evita O(n·m) no map abaixo)
  const lancamentosPorCliente = new Map<string, number>()
  for (const log of visao.logs) {
    const cliente = log.cliente?.trim() || 'Sem cliente'
    lancamentosPorCliente.set(cliente, (lancamentosPorCliente.get(cliente) ?? 0) + 1)
  }

  const rankingRows: (string | number)[][] = [
    ['Suporte Analytics — Ranking de clientes por horas'],
    [`Período: ${periodo} · Departamento: ${departamento}`],
    [],
    ['Posição', 'Cliente', 'Total de horas', 'Média/mês', 'Lançamentos', '% do total'],
    ...visao.porCliente.map((r, idx) => {
      const media = mediaMensalPorCliente.get(r.cliente)
      return [
        idx + 1,
        r.cliente,
        r.totalHoras,
        media?.mediaHorasPorMes ?? '—',
        lancamentosPorCliente.get(r.cliente) ?? 0,
        r.percent,
      ]
    }),
  ]
  const wsRanking = XLSX.utils.aoa_to_sheet(rankingRows)
  wsRanking['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 11 }]
  XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking de clientes')

  /* ---------- Aba 3: HORAS POR TÉCNICO ---------- */
  const tecnicos = agregarHorasPorTecnico(visao.logs)
  const tecnicosRows: (string | number)[][] = [
    ['Suporte Analytics — Horas por técnico'],
    [`Período: ${periodo} · Departamento: ${departamento}`],
    [],
    ['Técnico', 'Chamados', 'Total de horas', 'Média/chamado', '% do total'],
    ...tecnicos.map((t) => [
      t.tecnico,
      t.tickets,
      t.totalHoras,
      t.tickets > 0 ? Math.round((t.totalHoras / t.tickets) * 100) / 100 : '—',
      t.percent,
    ]),
  ]
  const wsTecnicos = XLSX.utils.aoa_to_sheet(tecnicosRows)
  wsTecnicos['!cols'] = [{ wch: 26 }, { wch: 11 }, { wch: 15 }, { wch: 15 }, { wch: 11 }]
  XLSX.utils.book_append_sheet(wb, wsTecnicos, 'Horas por técnico')

  /* ---------- Aba 4 (opcional): DEPARTAMENTO × CLIENTE ---------- */
  if (porDepto.length > 0) {
    const deptoRows: (string | number)[][] = [
      ['Suporte Analytics — Horas por departamento × cliente'],
      [`Período: ${periodo} · Departamento: ${departamento}`],
      [],
      ['Departamento', 'Cliente', 'Total de horas', 'Chamados', '% do depto'],
      ...porDepto.flatMap((d) =>
        d.clientes.map((c) => [d.departamento, c.cliente, c.totalHoras, c.tickets, c.percent]),
      ),
    ]
    const wsDepto = XLSX.utils.aoa_to_sheet(deptoRows)
    wsDepto['!cols'] = [{ wch: 22 }, { wch: 34 }, { wch: 15 }, { wch: 11 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsDepto, 'Depto × cliente')
  }

  /* ---------- Download ---------- */
  const nomeArquivo = `horas-por-cliente-${slugPeriodo(periodo)}-${dataArquivo()}.xlsx`
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
