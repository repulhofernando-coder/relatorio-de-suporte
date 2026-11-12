import { normalizarBuscaNome } from '@/lib/busca-horas'
import { formatarHorasDecimaisLegivel } from '@/lib/duracao'
import type { ClientContract } from '@/services/contratos'

/**
 * Contraste entre o consumo do cliente (média mensal de horas) e o contrato
 * cadastrado (tabela client_contracts). Cumulativo: compara o consumo do
 * período de N meses contra horas_contratadas × N — a média mensal continua
 * sendo a base (consumo médio do mês dentro da janela), então o texto mostra
 * sempre o contrato "por mês" equivalente (contratado ÷ N quando cumulativo).
 */

export interface ContrasteContrato {
  /** true quando a média mensal excede as horas contratadas por mês. */
  estourou: boolean
  /** Texto exibido, ex.: "Média 26,3h/mês vs contrato 20h/mês — acima do contratado". */
  texto: string
}

/** Encontra o contrato do cliente casando o nome de forma tolerante (sem acentos/minúsculas). */
export function contratoDoCliente(
  cliente: string,
  contratos: ClientContract[],
): ClientContract | null {
  const alvo = normalizarBuscaNome(cliente)
  if (!alvo) return null
  return (
    contratos.find((c) => {
      const nome = normalizarBuscaNome(c.cliente)
      return nome !== '' && (nome === alvo || nome.includes(alvo) || alvo.includes(nome))
    }) ?? null
  )
}

/** Horas contratadas POR MÊS (cumulativo N meses: contratado ÷ N). */
export function contratadoMensal(contrato: ClientContract): number {
  if (contrato.cumulativo && contrato.periodo_meses && contrato.periodo_meses > 1) {
    return contrato.horas_contratadas / contrato.periodo_meses
  }
  return contrato.horas_contratadas
}

export function contrastarComContrato(
  mediaHorasPorMes: number | null | undefined,
  contrato: ClientContract | null | undefined,
): ContrasteContrato | null {
  if (!contrato || mediaHorasPorMes == null) return null

  const contratado = contratadoMensal(contrato)
  if (!(contratado > 0)) return null

  const media = Math.round(mediaHorasPorMes * 10) / 10
  const estourou = mediaHorasPorMes > contratado
  const mediaTexto = formatarHorasDecimaisLegivel(media)
  const contratoTexto = formatarHorasDecimaisLegivel(contratado)

  if (estourou) {
    return {
      estourou: true,
      texto: `Média ${mediaTexto}/mês vs contrato ${contratoTexto}/mês — acima do contratado`,
    }
  }
  return {
    estourou: false,
    texto: `Média ${mediaTexto}/mês vs contrato ${contratoTexto}/mês — dentro do contratado`,
  }
}
