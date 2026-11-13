/**
 * Normalização e casamento de rótulos de departamento para as HORAS (time_logs).
 *
 * O Movidesk grava rótulos que não batem com os usados nos chamados
 * (support_records: Windows, Linux, Campo, Windows N2). Valores reais em
 * time_logs.departamento: "Linux N1/N2", "Windows - N2", "Datacenter: Windows",
 * "Datacenter: Linux", "Coordenadores." — além de "Comercial", "Cabeamento",
 * "Laboratório", "Projetos", "Ativação", "Alocado", "Financeiro" e do novo
 * "07-datacenter-windows" (time de Datacenter Windows).
 *
 * "Projetos", "Projetos Internos" e "Projetos Locais" são a MESMA fila no
 * Movidesk (pedido do usuário): os três rótulos caem no filtro canônico
 * "Projetos" e no rótulo canônico de exibição "Projetos".
 *
 * O rótulo canônico (normalizarDepartamentoHoras) é o "nome natural" do setor,
 * usado para EXIBIR e para montar o filtro. O casamento filtro × log
 * (casaDepartamento) é SEMÂNTICO — por família de rótulo, aplicado sobre o
 * RÓTULO BRUTO (normalizar depois esconderia o N2 de "Linux N1/N2"):
 *   - filtro com "N2"      → rótulos de N2 de time específico ("Windows - N2");
 *                            "Linux N1/N2" NÃO entra (é do setor Linux — o
 *                            usuário quer que ele case SOMENTE com o filtro Linux)
 *   - filtro "Linux"       → rótulos do setor Linux ("Linux", "Linux N1/N2")
 *   ORDEM IMPORTA: o filtro "Datacenter Windows" tem de ser testado ANTES do
 *   filtro "Windows" — este EXCLUI rótulos com "datacenter", o que tornava o
 *   branch do time de Datacenter Windows inalcançável (bug: filtro vazio).
 *   - filtro "Windows"     → contém "Windows", sem N2 e sem Datacenter
 *                            (o time de Datacenter Windows é distinto e tem
 *                            filtro próprio — não vira "Windows")
 *   - filtro "Campo"       → contém "Campo"
 *   - filtro "Datacenter"  → contém "Datacenter" (agrupa ": Windows" e ": Linux")
 *   - filtro "Datacenter Windows" → rótulos do time de Datacenter Windows
 *                            ("07-datacenter-windows", "Datacenter: Windows" —
 *                            a GRAFIA REAL no banco, ver db 2026-11 —,
 *                            "data center windows"…)
 *   - filtro "Projetos"    → começa com "Projetos" (inclui "Projetos Internos"
 *                            e "Projetos Locais" — mesma fila no Movidesk)
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

  // Time de Datacenter Windows: rótulo novo na planilha ("07-datacenter-windows")
  // e variações tolerantes (sem o prefixo "07-", maiúsculas, "data center
  // windows", separadores -/_/espaço) → setor canônico "Datacenter Windows",
  // distinto do filtro "Windows". "Datacenter: Windows" (rótulo antigo já
  // coberto pelo grupo "Datacenter") continua no grupo.
  if (/^(\d{1,2}-)?datacenterwindows$/.test(min.replace(/[\s_-]+/g, '')))
    return 'Datacenter Windows'

  // "Datacenter: Windows" e "Datacenter: Linux" → grupo único "Datacenter"
  if (/^datacenter\s*:\s*(windows|linux)$/.test(min)) return 'Datacenter'

  // Ponto final deixado pelo Movidesk: "Coordenadores." → "Coordenadores"
  if (min === 'coordenadores.') return 'Coordenadores'

  // Projetos: "Projetos", "Projetos Internos" e "Projetos Locais" são a
  // mesma fila no Movidesk → rótulo canônico único "Projetos"
  if (/^projetos(\s+(internos|locais))?$/.test(min)) return 'Projetos'

  // "Ativacao" sem acento → rótulo canônico com acento
  if (min === 'ativacao') return 'Ativação'

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

/** true quando o rótulo bruto é de N2 de um time ESPECÍFICO que não seja Linux. */
function eN2DeTimeNaoLinux(logMin: string): boolean {
  return logMin.includes('n2') && !logMin.startsWith('linux')
}

/**
 * true quando o lançamento de horas pertence ao departamento selecionado.
 * Comparação SEMÂNTICA por família de rótulo (ver cabeçalho do arquivo) —
 * "Linux" traz "Linux N1/N2" (SOMENTE o filtro Linux o traz), "Windows N2"
 * traz os N2 de time específico, "Datacenter" agrupa os dois dois-pontos.
 */
export function casaDepartamento(
  deptoDoLog: string | null | undefined,
  filtro: string | null | undefined,
): boolean {
  const filtroMin = minusculeSemAcento(filtro ?? '')
  if (!filtroMin || filtroMin === 'todos') return true

  const logMin = minusculeSemAcento(deptoDoLog ?? '')
  if (!logMin) return false

  // N2: só rótulos de N2 de time ESPECÍFICO (Windows - N2). "Linux N1/N2"
  // pertence ao setor Linux e NÃO entra no filtro N2 (pedido do usuário:
  // "Linux N1/N2 seja apenas Linux" — só o filtro Linux o traz).
  if (filtroMin.includes('n2')) return eN2DeTimeNaoLinux(logMin)

  // Linux: rótulos do setor Linux (não "Datacenter: Linux", que é Datacenter)
  if (filtroMin.includes('linux')) return logMin.startsWith('linux')

  // Datacenter Windows: time próprio — casa os rótulos do time de Datacenter
  // Windows (o novo "07-datacenter-windows", o "Datacenter: Windows" — a
  // GRAFIA REAL no banco — e as variações com "data center"). TEM de vir
  // ANTES do filtro "Windows" (que exclui rótulos com "datacenter" — com a
  // ordem antiga este branch era inalcançável e o filtro não trazia nada) e
  // antes do genérico "Datacenter", que agrupa Windows e Linux.
  if (filtroMin.includes('datacenter') && filtroMin.includes('windows')) {
    return logMin.includes('datacenter') && logMin.includes('windows')
  }

  // Windows: sem N2 e sem Datacenter (esses têm filtros próprios)
  if (filtroMin.includes('windows')) {
    return logMin.includes('windows') && !logMin.includes('n2') && !logMin.includes('datacenter')
  }

  if (filtroMin.includes('campo')) return logMin.includes('campo')

  if (filtroMin.includes('datacenter')) return logMin.includes('datacenter')

  // Projetos: mesma fila no Movidesk — captura "Projetos", "Projetos
  // Internos" e "Projetos Locais" (qualquer rótulo que comece com "Projetos")
  if (filtroMin.startsWith('projetos')) return logMin.startsWith('projetos')

  // Ativação: setor próprio, não contém (nem é contido por) outros rótulos
  if (filtroMin.startsWith('ativacao')) return logMin.startsWith('ativacao')

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
 * Laboratório, Projetos, Coordenadores, Ativação, Alocado, Financeiro).
 */
export function uniaoDepartamentosHoras(
  ...sources: Array<Array<string | null | undefined>>
): string[] {
  // Semeia os setores novos ("Projetos" — abrange os rótulos brutos
  // "Projetos", "Projetos Internos" e "Projetos Locais", mesma fila —
  // "Ativação" e "Datacenter Windows", rótulo bruto "07-datacenter-windows")
  // para que apareçam nas opções dos filtros das quatro telas
  // mesmo antes do primeiro lançamento; filtrar sem dados resulta em zero,
  // igual aos demais setores que só existem nas horas. "Projetos Locais"
  // já entra normalizado como "Projetos" — nunca vira opção separada.
  const set = new Set<string>(['Projetos', 'Ativação', 'Datacenter Windows'])
  for (const source of sources) {
    for (const bruto of source) {
      const norm = normalizarDepartamentoHoras(bruto)
      if (norm) set.add(norm)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
