/**
 * Normalização de rótulos de departamento para as consultas de HORAS (time_logs).
 *
 * O Movidesk grava rótulos que não batem com os usados nos chamados
 * (support_records: Windows, Linux, Campo, Windows N2). Esta função unifica
 * a equivalência num único lugar — usada por /horas, pela Visão Geral (card
 * "Clientes que mais consumiram horas") e pelo Top 3 do técnico em Chamados.
 *
 * IMPORTANTE: vale APENAS para time_logs. Os relatórios de chamados
 * (support_records) continuam usando o rótulo exato — não alterar.
 *
 * O rótulo normalizado é o "nome natural" do setor (o mesmo usado nos
 * chamados e nas metas de Equipes): selecionar "Linux" traz "Linux N1/N2",
 * selecionar "Windows N2" traz "Windows - N2" e "Datacenter" agrupa
 * "Datacenter: Windows" e "Datacenter: Linux".
 */

/** Rótulo canônico (o que o usuário vê e seleciona no filtro). */
export function normalizarDepartamentoHoras(depto: string | null | undefined): string {
  const bruto = (depto ?? '').trim()
  if (!bruto) return ''

  const min = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos

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
 * Conjunto de rótulos equivalentes ao departamento selecionado — usado quando
 * o filtro é aplicado sobre rótulos JÁ normalizados (ex.: em logs de horas).
 * Ex.: "Linux" → { "Linux", "Linux N1", "Linux N2", "Linux N1/N2" }.
 */
export function variacoesEquivalentesDepto(filtro: string): Set<string> {
  const bruto = filtro.trim()
  if (!bruto) return new Set()

  const min = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const variacoes = new Set<string>([bruto, normalizarDepartamentoHoras(bruto)])

  // Linux: rótulos N1/N2 do Movidesk
  if (min === 'linux') {
    variacoes.add('Linux N1')
    variacoes.add('Linux N2')
    variacoes.add('Linux N1/N2')
  }

  // Datacenter: os dois rótulos do Movidesk
  if (min === 'datacenter') {
    variacoes.add('Datacenter: Windows')
    variacoes.add('Datacenter: Linux')
  }

  return variacoes
}

/** true quando o log pertence ao departamento selecionado (comparação normalizada). */
export function logPertenceAoDepartamento(
  deptoDoLog: string | null | undefined,
  filtro: string | null | undefined,
): boolean {
  if (!filtro) return true
  return normalizarDepartamentoHoras(deptoDoLog) === normalizarDepartamentoHoras(filtro)
}

/**
 * União dos departamentos que aparecem em time_logs (normalizados),
 * support_records e nas metas de Equipes (department_capacity) — sem duplicar
 * nomes. Alimenta o filtro de departamento das telas que mostram horas
 * (/horas e o filtro da Visão Geral que alimenta o card de horas).
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
