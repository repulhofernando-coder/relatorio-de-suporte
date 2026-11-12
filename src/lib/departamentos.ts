/**
 * Normalização e casamento de rótulos de departamento para as HORAS (time_logs).
 *
 * O Movidesk grava rótulos que não batem com os usados nos chamados
 * (support_records: Windows, Linux, Campo, Windows N2). Valores reais em
 * time_logs.departamento: "Linux N1/N2", "Windows - N2", "Datacenter: Windows",
 * "Datacenter: Linux", "Coordenadores." — além de "Comercial", "Cabeamento",
 * "Laboratório", "Projetos Locais", "Ativação", "Alocado", "Financeiro".
 *
 * O rótulo canônico (normalizarDepartamentoHoras) é o "nome natural" do setor,
 * usado para EXIBIR e para montar o filtro. O casamento filtro × log
 * (casaDepartamento) é SEMÂNTICO — por família de rótulo, aplicado sobre o
 * RÓTULO BRUTO (normalizar depois esconderia o N2 de "Linux N1/N2"):
 *   - filtro com "N2"      → qualquer rótulo com "N2" ("Windows - N2", "Linux N1/N2")
 *   - filtro "Linux"       → rótulos do setor Linux ("Linux", "Linux N1/N2")
 *   - filtro "Windows"     → contém "Windows", sem N2 e sem Datacenter
 *   - filtro "Campo"       → contém "Campo"
 *   - filtro "Datacenter"  → contém "Datacenter" (agrupa ": Windows" e ": Linux")
 *   - demais               → igualdade canônica (Comercial, Cabeamento…)
 *
 * IMPORTANTE: vale APENAS para time_logs. Os relatórios de chamados
 * (support_records) continuam usando o rótulo exato — não alterar.
 */

function minusculeSemAcento(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

/** Rótulo canônico (o que o usuário vê e seleciona no filtro). */
export function normalizarDepartamentoHoras(depto: string | null | undefined): string {
  const bruto = (depto ?? '').trim()
  if (!bruto) return ''

  const min = minusculeSemAcento(bruto)

  // "Linux", "Linux N1", "Linux N2", "Linux N1/N2" → Linux
  if (/^linux(\s*n[12](\s*\/\s*n[12])?)?$/.test(min)) return 'Linux'

  // "Windows - N2" → Windows N2 (mesmo rótulo de support_records/metas)
  if (/^windows\s*-\s*n2$/.test(min)) return 'Windows N2'

  // "Datacenter: Windows" e "Datacenter: Linux" → grupo único "Datacenter"
  if (/^datacenter\s*:\s*(windows|linux)$/.test(min)) return 'Datacenter'

  // Ponto final deixado pelo Movidesk: "Coordenadores." → "Coordenadores"
  if (min === 'coordenadores.') return 'Coordenadores'

  return bruto
}

/**
 * Aplica a normalização aos logs de horas — o rótulo canônico é o que casa
 * com o filtro selecionado na tela.
 */
export function normalizarDepartamentosEmLogs<T extends { departamento?: string | null }>(
  logs: T[],
): T[] {
  return logs.map((log) => ({
    ...log,
    departamento: normalizarDepartamentoHoras(log.departamento),
  }))
}

/**
 * true quando o lançamento de horas pertence ao departamento selecionado.
 * Comparação SEMÂNTICA por família de rótulo (ver cabeçalho do arquivo) —
 * "Linux" traz "Linux N1/N2", "Windows N2" traz todo rótulo de N2,
 * "Datacenter" agrupa "Datacenter: Windows" e "Datacenter: Linux".
 */
export function casaDepartamento(
  deptoDoLog: string | null | undefined,
  filtro: string | null | undefined,
): boolean {
  const filtroMin = minusculeSemAcento(filtro ?? '')
  if (!filtroMin || filtroMin === 'todos') return true

  const logMin = minusculeSemAcento(deptoDoLog ?? '')
  if (!logMin) return false

  // N2: qualquer rótulo de N2 (Windows - N2, Linux N1/N2)
  if (filtroMin.includes('n2')) return logMin.includes('n2')

  // Linux: rótulos do setor Linux (não "Datacenter: Linux", que é Datacenter)
  if (filtroMin.includes('linux')) return logMin.startsWith('linux')

  // Windows: sem N2 e sem Datacenter (esses têm filtros próprios)
  if (filtroMin.includes('windows')) {
    return logMin.includes('windows') && !logMin.includes('n2') && !logMin.includes('datacenter')
  }

  if (filtroMin.includes('campo')) return logMin.includes('campo')
  if (filtroMin.includes('datacenter')) return logMin.includes('datacenter')

  // Demais setores (Comercial, Cabeamento, Laboratório, …): igualdade canônica
  return normalizarDepartamentoHoras(deptoDoLog) === normalizarDepartamentoHoras(filtro)
}

/** Predicado pronto para aplicar sobre os logs de uma tela. */
export function criarMatcherDepartamento(
  filtro: string | null | undefined,
): (deptoDoLog: string | null | undefined) => boolean {
  return (deptoDoLog) => casaDepartamento(deptoDoLog, filtro)
}

/** true quando o log pertence ao departamento selecionado (alias de casaDepartamento). */
export const logPertenceAoDepartamento = casaDepartamento

/**
 * União dos departamentos que aparecem em time_logs (normalizados),
 * support_records e nas metas de Equipes (department_capacity) — sem duplicar
 * nomes. Alimenta o filtro de departamento das telas que mostram horas
 * (/horas e o filtro da Visão Geral que alimenta o card de horas), incluindo
 * os setores que só existem nas horas (Comercial, Datacenter, Cabeamento,
 * Laboratório, Projetos Locais, Coordenadores, Ativação, Alocado, Financeiro).
 */
export function uniaoDepartamentosHoras(
  ...sources: Array<Array<string | null | undefined>>
): string[] {
  const set = new Set<string>()
  for (const source of sources) {
    for (const bruto of source) {
      const norm = normalizarDepartamentoHoras(bruto)
      if (norm) set.add(norm)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
