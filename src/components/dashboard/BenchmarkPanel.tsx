import { useMemo } from 'react'
import { Award, AlertCircle, CheckCircle2, Info, Layers } from 'lucide-react'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'
import { Badge } from '@/components/ui/badge'

interface BenchmarkPanelProps {
  records: SupportRecord[]
  capacities: DepartmentCapacityRecord[]
  loading?: boolean
  selectedDepartamento?: string
}

interface BenchmarkRow {
  indicador: string
  descricao: string
  real: string
  realNum: number | null
  ideal: string
  status: 'verde' | 'vermelho' | 'informativo'
  statusTexto: string
  diagnostico: string
}

function isN2(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'windows n2' || norm === 'n2' || norm === 'n2 remoto' || norm.includes('n2')
}

function isCampo(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return (
    norm === 'campo' ||
    norm === 'field service' ||
    norm === 'field' ||
    norm.includes('campo') ||
    norm.includes('field')
  )
}

function formatMinutesToHours(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function BenchmarkPanel({
  records,
  capacities,
  loading,
  selectedDepartamento,
}: BenchmarkPanelProps) {
  const isFilterN2 = useMemo(() => isN2(selectedDepartamento), [selectedDepartamento])
  const isFilterCampo = useMemo(() => isCampo(selectedDepartamento), [selectedDepartamento])

  // Busca configuração específica do departamento filtrado se houver
  const activeCapacity = useMemo(() => {
    if (!selectedDepartamento || selectedDepartamento === 'todos') return null
    return (
      capacities.find(
        (c) => c.departamento.toLowerCase().trim() === selectedDepartamento.toLowerCase().trim(),
      ) || null
    )
  }, [capacities, selectedDepartamento])

  const dados = useMemo(() => {
    const totalChamados = records.length

    // 1) TMA Real: média de tempo_trabalhado (em horas decimais) * 60 minutos
    const validTempos = records
      .map((r) => r.tempo_trabalhado)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t) && t > 0)

    const somaHoras = validTempos.reduce((acc, v) => acc + v, 0)
    const tmaRealMin = validTempos.length > 0 ? (somaHoras / validTempos.length) * 60 : null

    // 2) Dias e Técnicos no período para produtividade diária
    const diasDistintosSet = new Set(
      records.map((r) => r.data_chamado).filter((d): d is string => Boolean(d)),
    )
    const diasAtendimento = Math.max(1, diasDistintosSet.size)

    const tecnicosAtivosSet = new Set(
      records.map((r) => r.tecnico?.trim()).filter((t): t is string => Boolean(t)),
    )

    // Se temos capacidade cadastrada para o departamento, usa a qtd de técnicos configurada ou técnicos ativos
    let tecnicosEquipe = tecnicosAtivosSet.size
    if (activeCapacity && activeCapacity.qtd_tecnicos > 0) {
      tecnicosEquipe = activeCapacity.qtd_tecnicos
    } else if (tecnicosEquipe <= 0) {
      tecnicosEquipe = 1
    }

    // Produtividade diária real por técnico: totalChamados / (diasAtendimento * tecnicosEquipe)
    const chamadosPorTecnicoDiaReal =
      diasAtendimento > 0 && tecnicosEquipe > 0
        ? totalChamados / (diasAtendimento * tecnicosEquipe)
        : null

    // 3) Ocupação direta em tickets
    // Horas totais trabalhadas / (tecnicosEquipe * diasAtendimento * 8h diárias) * 100
    const horasTrabalhadasTotal = somaHoras
    const horasDisponiveisEquipe = tecnicosEquipe * diasAtendimento * 8
    const taxaOcupacaoPercent =
      horasDisponiveisEquipe > 0 ? (horasTrabalhadasTotal / horasDisponiveisEquipe) * 100 : null

    // 4) Capacidade total planejada vs real (ociosidade / folga)
    let capacidadePlanejadaChamados = 0
    if (activeCapacity) {
      const qtd = activeCapacity.qtd_tecnicos || 1
      const fallbackLim = isFilterCampo ? 1.8 : isFilterN2 ? 2.7 : 15
      const lim = Number(
        activeCapacity.limite_diario ||
          activeCapacity.meta_chamados_dia_max ||
          activeCapacity.meta_chamados_dia ||
          fallbackLim,
      )
      const dias = Number(activeCapacity.dias_uteis || 22)
      const fatorDias = diasAtendimento < dias ? diasAtendimento / dias : 1
      capacidadePlanejadaChamados = qtd * lim * dias * fatorDias
    } else if (
      capacities &&
      capacities.length > 0 &&
      (!selectedDepartamento || selectedDepartamento === 'todos')
    ) {
      capacidadePlanejadaChamados = capacities.reduce((acc, c) => {
        const qtd = c.qtd_tecnicos || 0
        const lim = Number(c.limite_diario || c.meta_chamados_dia || 15)
        const dias = Number(c.dias_uteis || 22)
        const fatorDias = diasAtendimento < dias ? diasAtendimento / dias : 1
        return acc + qtd * lim * dias * fatorDias
      }, 0)
    }

    if (capacidadePlanejadaChamados <= 0) {
      const padraoDia = isFilterCampo ? 1.5 : isFilterN2 ? 2.25 : 15
      capacidadePlanejadaChamados = tecnicosEquipe * padraoDia * diasAtendimento
    }

    const folgaPercent =
      capacidadePlanejadaChamados > 0
        ? ((capacidadePlanejadaChamados - totalChamados) / capacidadePlanejadaChamados) * 100
        : null

    // 5) Equipe necessária para atender o volume com a meta ideal
    const metaProdMedia = isFilterCampo
      ? Number(activeCapacity?.meta_chamados_dia_max ?? activeCapacity?.meta_chamados_dia ?? 1.5)
      : isFilterN2
        ? Number(activeCapacity?.meta_chamados_dia_max ?? activeCapacity?.meta_chamados_dia ?? 2.25)
        : Number(activeCapacity?.meta_chamados_dia ?? 15)

    const chamadosPorTecnicoPeriodo = metaProdMedia * diasAtendimento
    const tecnicosNecessarios =
      chamadosPorTecnicoPeriodo > 0 ? Math.ceil(totalChamados / chamadosPorTecnicoPeriodo) : 1
    const capacidadeComEquipeAtual = Math.round(tecnicosEquipe * metaProdMedia * 22)

    return {
      totalChamados,
      diasAtendimento,
      tecnicosEquipe,
      tecnicosAtivosCount: tecnicosAtivosSet.size,
      tmaRealMin,
      chamadosPorTecnicoDiaReal,
      taxaOcupacaoPercent,
      horasTrabalhadasTotal,
      folgaPercent,
      tecnicosNecessarios,
      capacidadeComEquipeAtual,
    }
  }, [records, capacities, activeCapacity, selectedDepartamento, isFilterN2, isFilterCampo])

  const rows: BenchmarkRow[] = useMemo(() => {
    const list: BenchmarkRow[] = []

    if (isFilterCampo) {
      // =========================================================
      // MODO CAMPO (FIELD SERVICE): Baseado na tabela fornecida pela gestão
      // =========================================================
      const metaTmaMin = activeCapacity?.meta_tma_min_num ?? 180 // 3 horas
      const metaTmaMax = activeCapacity?.meta_tma_max_num ?? 270 // 4h30min
      const metaChMin = activeCapacity?.meta_chamados_dia_min ?? 1.2
      const metaChMax = activeCapacity?.meta_chamados_dia_max ?? 1.8
      const metaOcupMin = activeCapacity?.meta_ocupacao_min ?? 70
      const metaOcupMax = activeCapacity?.meta_ocupacao_max ?? 80

      // 1. Volume de Chamados / Mês
      list.push({
        indicador: 'Volume de Chamados / Mês',
        descricao: 'Demanda de atendimentos presenciais / Field Service no período',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
        realNum: dados.totalChamados,
        ideal: '75 chamados',
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico: 'Volume padrão para empresas com foco corporativo/PMEs.',
      })

      // 2. Tamanho da Equipe Necessária
      const eqAtual = dados.tecnicosEquipe
      // Faixa ideal: 3 a 4 técnicos
      const eqDentro = eqAtual >= 3 && eqAtual <= 4
      const eqAcima = eqAtual > 4
      const eqAbaixo = eqAtual < 3

      let eqStatus: 'verde' | 'vermelho' = eqDentro || eqAcima ? 'verde' : 'vermelho'
      let eqStatusTexto = eqDentro
        ? 'Dentro da meta'
        : eqAcima
          ? 'Margem de segurança'
          : 'Abaixo do ideal'

      let eqDiag = ''
      if (eqAcima) {
        eqDiag = 'A equipe atual está levemente folgada, mas com margem de segurança para picos.'
      } else if (eqDentro) {
        eqDiag = `Equipe de ${eqAtual} técnicos dentro do dimensionamento ideal (3 a 4 técnicos) para a rotina de Field Service.`
      } else {
        eqDiag = `Equipe com ${eqAtual} técnico(s) está abaixo do recomendado (3 a 4 técnicos), com alto risco de atrasos nos deslocamentos e atendimentos.`
      }

      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe para atendimento presencial e deslocamento',
        real: `${eqAtual} técnico${eqAtual > 1 ? 's' : ''}`,
        realNum: eqAtual,
        ideal: '3 a 4 técnicos',
        status: eqStatus,
        statusTexto: eqStatusTexto,
        diagnostico: eqDiag,
      })

      // 3. Tempo Médio de Atendimento (TMA)
      if (dados.tmaRealMin !== null) {
        const tmaRound = Math.round(dados.tmaRealMin)
        const tmaFormat = formatMinutesToHours(tmaRound)

        const dentroFaixa = tmaRound >= metaTmaMin && tmaRound <= metaTmaMax
        const abaixo = tmaRound < metaTmaMin
        const acima = tmaRound > metaTmaMax

        let status: 'verde' | 'vermelho' = dentroFaixa ? 'verde' : 'vermelho'
        let statusTexto = dentroFaixa
          ? 'Dentro da meta'
          : abaixo
            ? 'Abaixo da faixa'
            : 'Acima da meta'

        let diagnostico = ''
        if (dentroFaixa) {
          diagnostico = `Excelente. TMA em ${tmaFormat}, dentro da faixa esperada de Field Service (3h a 4h30min), cobrindo execução técnica e testes.`
        } else if (abaixo) {
          diagnostico = `Média de ${tmaFormat}, inferior a 3h. Atendimentos rápidos de campo podem indicar visitas simples ou falta de registro do tempo total in loco.`
        } else {
          diagnostico =
            'Alto. Atividades como formatação e antenas levam tempo, mas TMA alto indica gargalo de logística ou falta de laboratório.'
        }

        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA)',
          descricao: 'Duração média dedicada por chamado presencial em campo',
          real: tmaFormat,
          realNum: tmaRound,
          ideal: '3h a 4h 30min',
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA)',
          descricao: 'Duração média dedicada por chamado presencial em campo',
          real: 'Sem apontamento',
          realNum: null,
          ideal: '3h a 4h 30min',
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico:
            'Os chamados de Campo no período não possuem apontamento de tempo trabalhado.',
        })
      }

      // 4. Produtividade Diária (Chamados/Técnico)
      if (dados.chamadosPorTecnicoDiaReal !== null && dados.totalChamados > 0) {
        const prod = Math.round(dados.chamadosPorTecnicoDiaReal * 100) / 100
        const prodFormat = prod.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const dentro = prod >= metaChMin && prod <= metaChMax
        const abaixo = prod < metaChMin

        let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        let statusTexto = dentro ? 'Dentro da meta' : abaixo ? 'Abaixo da meta' : 'Acima da meta'

        let diagnostico = ''
        if (dentro) {
          diagnostico = `Produtividade diária equilibrada para campo (${prodFormat} chamados/dia vs meta ${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')}).`
        } else if (abaixo) {
          diagnostico = 'Técnicos realizam menos de 1 atendimento presencial completo por dia.'
        } else {
          diagnostico = `Produtividade acima da meta (${prodFormat} chamados/dia). Verificar se o tempo em trânsito e documentação técnica estão sendo preservados.`
        }

        list.push({
          indicador: 'Produtividade Diária (Chamados/Técnico)',
          descricao: 'Média de atendimentos presenciais concluídos por técnico em cada dia útil',
          real: `${prodFormat} chamados/dia`,
          realNum: prod,
          ideal: `${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')} chamados/dia`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Produtividade Diária (Chamados/Técnico)',
          descricao: 'Média de atendimentos presenciais concluídos por técnico em cada dia útil',
          real: '—',
          realNum: null,
          ideal: `${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')} chamados/dia`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico: 'Sem registros suficientes para calcular a produtividade diária de Campo.',
        })
      }

      // 5. Ocupação Direta em Tickets
      if (dados.taxaOcupacaoPercent !== null) {
        const ocup = Math.round(dados.taxaOcupacaoPercent * 10) / 10
        const ocupFormat = `${ocup.toLocaleString('pt-BR')}%`
        const dentro = ocup >= metaOcupMin && ocup <= metaOcupMax
        const abaixo = ocup < metaOcupMin

        let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        let statusTexto = dentro ? 'Dentro da meta' : abaixo ? 'Abaixo da meta' : 'Acima da meta'

        let diagnostico = ''
        if (dentro) {
          diagnostico = `Ocupação equilibrada (${ocupFormat} do tempo em tickets). Restante de ~20% a 30% absorvido por trânsito, relatórios e laboratório.`
        } else if (abaixo) {
          diagnostico =
            'Metade do tempo da equipe é gasto resolvendo os tickets; a outra metade fica para trânsito, relatórios e laboratório.'
        } else {
          diagnostico = `Ocupação em tickets elevada (${ocupFormat}). Quase todo o tempo está em atendimentos diretos, podendo comprimir o tempo de trânsito e laboratório.`
        }

        list.push({
          indicador: 'Ocupação Direta em Tickets',
          descricao: 'Percentual do expediente investido diretamente na resolução dos chamados',
          real: `~${ocupFormat} do tempo`,
          realNum: ocup,
          ideal: `${metaOcupMin}% a ${metaOcupMax}% do tempo`,
          status,
          statusTexto,
          diagnostico,
        })
      }

      return list
    }

    if (isFilterN2) {
      // =========================================================
      // MODO N2: Baseado na tabela de benchmark N2 fornecida pela gestão
      // =========================================================
      const metaTmaMin = activeCapacity?.meta_tma_min_num ?? 60
      const metaTmaMax = activeCapacity?.meta_tma_max_num ?? 90
      const metaChMin = activeCapacity?.meta_chamados_dia_min ?? 1.8
      const metaChMax = activeCapacity?.meta_chamados_dia_max ?? 2.7
      const metaOcupMin = activeCapacity?.meta_ocupacao_min ?? 65
      const metaOcupMax = activeCapacity?.meta_ocupacao_max ?? 75

      // 1. Volume de Chamados / Mês
      list.push({
        indicador: 'Volume de Chamados no Período',
        descricao: 'Demanda total recebida e atendida pelo N2 no recorte selecionado',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
        realNum: dados.totalChamados,
        ideal: `${dados.totalChamados.toLocaleString('pt-BR')} chamados (demanda real)`,
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico:
          dados.totalChamados <= 100
            ? 'Volume baixo e filtrado. Indica que o N1 está retendo bem a rotina operacional.'
            : 'Volume recebido pelo N2. Monitorar se chamados de N1 não estão sendo escalados desnecessariamente.',
      })

      // 2. Tamanho da Equipe Necessária
      const eqAtual = dados.tecnicosEquipe
      const eqNec = dados.tecnicosNecessarios
      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe N2 para absorver a demanda de tickets',
        real: `${eqAtual} técnico${eqAtual > 1 ? 's' : ''}`,
        realNum: eqAtual,
        ideal: `${eqNec} técnico${eqNec > 1 ? 's' : ''} (para este volume)`,
        status: eqAtual >= eqNec ? 'verde' : 'vermelho',
        statusTexto: eqAtual >= eqNec ? 'Adequado' : 'Abaixo do ideal',
        diagnostico:
          eqAtual > eqNec
            ? 'Equipe mantida estrategicamente para alta disponibilidade, redundância ou projetos/infraestrutura.'
            : eqAtual === eqNec
              ? 'Equipe exatamente dimensionada para o volume de chamados do período.'
              : 'Demanda de chamados N2 acima da capacidade da equipe atual com foco misto.',
      })

      // 3. TMA (Tempo Médio de Atendimento)
      if (dados.tmaRealMin !== null) {
        const tmaRound = Math.round(dados.tmaRealMin)
        const tmaFormat = formatMinutesToHours(tmaRound)

        // Intervalo alvo N2 é 60-90 min (cenário tolerado até 150 min / 2h30)
        const dentroAlvo = tmaRound >= metaTmaMin && tmaRound <= metaTmaMax
        const dentroTolerado = tmaRound > metaTmaMax && tmaRound <= 150
        const abaixo = tmaRound < metaTmaMin
        const acima = tmaRound > 150

        let status: 'verde' | 'vermelho' = dentroAlvo || dentroTolerado ? 'verde' : 'vermelho'
        let statusTexto = dentroAlvo
          ? 'Excelente / Na meta'
          : dentroTolerado
            ? 'Cenário complexo (aceitável)'
            : abaixo
              ? 'Abaixo da faixa N2'
              : 'Acima do ideal'

        let diagnostico = ''
        if (dentroAlvo || dentroTolerado) {
          diagnostico = `Excelente. Tempo de resolução maduro e ágil para a complexidade da função N2 (${tmaFormat} vs alvo ${metaTmaMin}–${metaTmaMax} min).`
        } else if (abaixo) {
          diagnostico = `Média de ${tmaFormat}, inferior ao esperado de N2 (60–90 min). Chamados rápidos podem ser demandas de N1 resolvidas no N2 ou falta de apontamento do tempo total.`
        } else {
          diagnostico = `Média de ${tmaFormat}, acima do limite de 2h30min. Indica incidentes de alta gravidade ou gargalos em aprovações/fornecedores.`
        }

        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA)',
          descricao: 'Duração média dedicada por chamado de N2',
          real: tmaFormat,
          realNum: tmaRound,
          ideal: '1h a 1h30min (alvo 60–90 min; até 2h30min em projetos)',
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA)',
          descricao: 'Duração média dedicada por chamado de N2',
          real: 'Sem apontamento',
          realNum: null,
          ideal: '1h a 1h30min (alvo 60–90 min; até 2h30min em projetos)',
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico: 'Os chamados de N2 no período não possuem apontamento de tempo trabalhado.',
        })
      }

      // 4. Produtividade Diária (Chamados/Técnico)
      if (dados.chamadosPorTecnicoDiaReal !== null && dados.totalChamados > 0) {
        const prod = Math.round(dados.chamadosPorTecnicoDiaReal * 100) / 100
        const prodFormat = prod.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const dentro = prod >= metaChMin && prod <= metaChMax
        const abaixo = prod < metaChMin
        const acima = prod > metaChMax

        let status: 'verde' | 'vermelho' = dentro || abaixo ? 'verde' : 'vermelho'
        let statusTexto = dentro
          ? 'Dentro da meta N2'
          : abaixo
            ? 'Foco em infraestrutura'
            : 'Volume alto para N2'

        let diagnostico = ''
        if (dentro) {
          diagnostico = `Produtividade diária dentro do esperado para N2 (${prodFormat} chamados/dia/técnico vs meta ${metaChMin}–${metaChMax}).`
        } else if (abaixo) {
          diagnostico = `Equipe opera com foco principal em infraestrutura proativa, projetos e rotinas preventivas, não em volume de tickets (${prodFormat} chamados/dia).`
        } else {
          diagnostico = `Produtividade em tickets acima de ${metaChMax} chamados/dia (${prodFormat}). Risco de desviar tempo de projetos estruturantes e manutenções preventivas.`
        }

        list.push({
          indicador: 'Produtividade Diária (Chamados/Técnico)',
          descricao: 'Média de tickets concluídos por técnico em cada dia útil',
          real: `${prodFormat} chamados/dia`,
          realNum: prod,
          ideal: `${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')} chamados/dia`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Produtividade Diária (Chamados/Técnico)',
          descricao: 'Média de tickets concluídos por técnico em cada dia útil',
          real: '—',
          realNum: null,
          ideal: `${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')} chamados/dia`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico: 'Sem registros suficientes para calcular a produtividade do N2.',
        })
      }

      // 5. Ocupação Direta em Tickets
      if (dados.taxaOcupacaoPercent !== null) {
        const ocup = Math.round(dados.taxaOcupacaoPercent * 10) / 10
        const ocupFormat = `${ocup.toLocaleString('pt-BR')}%`
        const dentro = ocup >= metaOcupMin && ocup <= metaOcupMax
        const tempoLivre = Math.max(0, Math.round(100 - ocup))

        let status: 'verde' | 'vermelho' = 'verde' // Para N2 ocupação baixa em tickets é esperada quando o foco é infra
        let statusTexto = dentro
          ? 'Dentro da meta N2'
          : ocup < metaOcupMin
            ? 'Tempo livre para infra'
            : 'Foco excessivo em tickets'

        let diagnostico = ''
        if (dentro) {
          diagnostico = `Ocupação equilibrada (${ocupFormat} do tempo em tickets). Restante dedicado a projetos e infraestrutura.`
        } else if (ocup < metaOcupMin) {
          diagnostico = `~${tempoLivre}% do tempo livre para gerenciar mudanças, backups, virtualização e projetos estratégicos (~${ocupFormat} em tickets).`
        } else {
          diagnostico = `A equipe está gastando ${ocupFormat} do expediente apenas com tickets, reduzindo a dedicação a infraestrutura e projetos.`
        }

        list.push({
          indicador: 'Ocupação Direta em Tickets',
          descricao: 'Percentual do expediente investido diretamente em chamados',
          real: `~${ocupFormat} do tempo`,
          realNum: ocup,
          ideal: `${metaOcupMin}% a ${metaOcupMax}% do tempo`,
          status,
          statusTexto,
          diagnostico,
        })
      }

      return list
    }

    // =========================================================
    // MODO N1 / CONSOLIDADO: Padrão HDI / MetricNet para N1 Remoto
    // =========================================================
    const metaTmaMin = activeCapacity?.meta_tma_min_num ?? 15
    const metaTmaMax = activeCapacity?.meta_tma_max_num ?? 25
    const metaChMin = activeCapacity?.meta_chamados_dia_min ?? 12
    const metaChMax = activeCapacity?.meta_chamados_dia_max ?? 18

    // Indicador 1: TMA (Tempo Médio de Atendimento)
    if (dados.tmaRealMin !== null) {
      const tmaRound = Math.round(dados.tmaRealMin)
      const dentro = tmaRound >= metaTmaMin && tmaRound <= metaTmaMax
      const abaixo = tmaRound < metaTmaMin

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Excelente. O tempo médio de ${tmaRound} min/chamado está alinhado ao padrão de N1 Remoto (${metaTmaMin}–${metaTmaMax} min).`
      } else if (abaixo) {
        diagnostico = `Abaixo da faixa (${tmaRound} min/chamado). Atenção: chamados muito rápidos podem indicar baixa complexidade ou falta de apontamento correto do tempo trabalhado.`
      } else {
        diagnostico = `Acima da faixa (${tmaRound} min/chamado). Tempo excessivo pode sinalizar retenção de chamados complexos no N1 que deveriam escalar para N2.`
      }

      list.push({
        indicador: 'TMA (Tempo Médio de Atendimento)',
        descricao: 'Duração média do atendimento por chamado',
        real: `${tmaRound} min/chamado`,
        realNum: tmaRound,
        ideal: `${metaTmaMin} – ${metaTmaMax} min/chamado`,
        status,
        statusTexto,
        diagnostico,
      })
    } else {
      list.push({
        indicador: 'TMA (Tempo Médio de Atendimento)',
        descricao: 'Duração média do atendimento por chamado',
        real: 'Sem apontamento',
        realNum: null,
        ideal: `${metaTmaMin} – ${metaTmaMax} min/chamado`,
        status: 'vermelho',
        statusTexto: 'Sem dados',
        diagnostico: 'A planilha do período não possui coluna de tempo trabalhado preenchida.',
      })
    }

    // Indicador 2: Produtividade diária por técnico
    if (dados.chamadosPorTecnicoDiaReal !== null && dados.totalChamados > 0) {
      const prod = Math.round(dados.chamadosPorTecnicoDiaReal * 10) / 10
      const dentro = prod >= metaChMin && prod <= metaChMax
      const abaixo = prod < metaChMin

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Dentro da faixa ideal de produtividade (${prod} chamados/dia por técnico). Equipe com ritmo sustentável.`
      } else if (abaixo) {
        diagnostico = `Abaixo da meta (${prod} chamados/dia/técnico vs ${metaChMin}–${metaChMax}). Indica ociosidade ou alto tempo gasto por chamado.`
      } else {
        diagnostico = `Acima da meta (${prod} chamados/dia/técnico vs ${metaChMin}–${metaChMax}). Risco de sobrecarga da equipe e perda de qualidade no atendimento.`
      }

      list.push({
        indicador: 'Produtividade Diária por Técnico',
        descricao: 'Média de chamados atendidos por técnico a cada dia útil',
        real: `${prod.toLocaleString('pt-BR')} chamados/dia`,
        realNum: prod,
        ideal: `${metaChMin} – ${metaChMax} chamados/dia/técnico`,
        status,
        statusTexto,
        diagnostico,
      })
    } else {
      list.push({
        indicador: 'Produtividade Diária por Técnico',
        descricao: 'Média de chamados atendidos por técnico a cada dia útil',
        real: '—',
        realNum: null,
        ideal: `${metaChMin} – ${metaChMax} chamados/dia/técnico`,
        status: 'vermelho',
        statusTexto: 'Sem dados',
        diagnostico: 'Sem registros suficientes para calcular a produtividade diária.',
      })
    }

    // Indicador 3: Volume de chamados no período (informativo)
    list.push({
      indicador: 'Volume de Chamados no Período',
      descricao: 'Demanda total recebida e atendida no recorte selecionado',
      real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
      realNum: dados.totalChamados,
      ideal: 'Informativo (demanda real)',
      status: 'informativo',
      statusTexto: 'Informativo',
      diagnostico: `Atendimento realizado em ${dados.diasAtendimento} dia(s) com ${dados.tecnicosAtivosCount} técnico(s) ativo(s).`,
    })

    // Indicador 4: Capacidade Ociosa / Folga Operacional
    if (dados.folgaPercent !== null) {
      const folga = Math.round(dados.folgaPercent)
      const dentro = folga >= 15 && folga <= 25 // meta 15-20% com tolerância
      const sobrecarga = folga < 10

      let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
      let statusTexto = dentro ? 'Dentro da meta' : 'Fora da meta'
      let diagnostico = ''

      if (dentro) {
        diagnostico = `Folga saudável (${folga}%). Permite absorver picos de demanda sem degradar o SLA.`
      } else if (sobrecarga) {
        diagnostico =
          folga < 0
            ? `Sobrecarga severa: operação operando ${Math.abs(folga)}% acima da capacidade ideal N1. Risco alto de estouro de SLA.`
            : `Operação muito apertada (${folga}% de folga vs 15–20% ideal). Qualquer imprevisto gera filas e atrasos.`
      } else {
        diagnostico = `Capacidade ociosa elevada (${folga}%). A equipe tem margem para absorver novos clientes ou ser remanejada.`
      }

      list.push({
        indicador: 'Capacidade Ociosa / Folga Operacional',
        descricao: 'Margem de segurança para absorção de picos de atendimento',
        real: `${folga}% de folga`,
        realNum: folga,
        ideal: '15% – 20% de folga',
        status,
        statusTexto,
        diagnostico,
      })
    }

    // Indicador 5: Equipe Necessária e Potencial Mensal
    list.push({
      indicador: 'Equipe Necessária / Dimensionamento',
      descricao: 'Projeção de técnicos para manter o volume dentro das metas',
      real: `${dados.tecnicosEquipe} técnico(s) cadastrado(s)`,
      realNum: dados.tecnicosEquipe,
      ideal: `Com ${dados.tecnicosEquipe} técnicos a meta atinge ~${dados.capacidadeComEquipeAtual.toLocaleString('pt-BR')} chamados/mês`,
      status: dados.tecnicosEquipe >= dados.tecnicosNecessarios ? 'verde' : 'vermelho',
      statusTexto:
        dados.tecnicosEquipe >= dados.tecnicosNecessarios ? 'Equipe suficiente' : 'Abaixo do ideal',
      diagnostico:
        dados.tecnicosEquipe >= dados.tecnicosNecessarios
          ? `A equipe de ${dados.tecnicosEquipe} técnico(s) é suficiente para a demanda atual (mínimo calculado: ${dados.tecnicosNecessarios} técnico(s)).`
          : `Para o volume do período com a meta de ${metaChMin}–${metaChMax} chamados/dia/técnico, seriam necessários pelo menos ${dados.tecnicosNecessarios} técnico(s).`,
    })

    return list
  }, [dados, isFilterN2, isFilterCampo, activeCapacity])

  // Título e cabeçalhos dinâmicos
  const cenarioIdealTitulo = isFilterCampo
    ? 'Cenário Ideal (Field Service)'
    : isFilterN2
      ? 'Cenário Ideal (N2 Remoto)'
      : selectedDepartamento && selectedDepartamento !== 'todos'
        ? `Cenário Ideal (${selectedDepartamento})`
        : 'Cenário Ideal (N1 Remoto)'

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isFilterCampo
                  ? 'bg-blue-50 text-blue-600'
                  : isFilterN2
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-teal-50 text-teal-600'
              }`}
            >
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Comparativo de Desempenho (Benchmark)
                {isFilterCampo && (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold"
                  >
                    Perfil Campo (Field Service)
                  </Badge>
                )}
                {isFilterN2 && (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold"
                  >
                    Perfil N2 Ativo
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {isFilterCampo
                  ? 'Comparação com os benchmarks de gestão para operação Campo (deslocamento, laboratório e atendimento presencial)'
                  : isFilterN2
                    ? 'Comparação com os benchmarks de gestão para operação N2 (baixo volume, infraestrutura e projetos)'
                    : 'Comparação entre a operação real e as referências de mercado N1 Remoto (HDI/MetricNet)'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          {isFilterCampo ? (
            <>
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-medium text-slate-700">
                Fontes: MetricNet & CompTIA (Field Service)
              </span>
            </>
          ) : isFilterN2 ? (
            <>
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-medium text-slate-700">
                Fontes: ITIL 4 (AXELOS) & Gartner (N2)
              </span>
            </>
          ) : (
            <>
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Fontes: HDI & MetricNet (N1 Remoto)</span>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : dados.totalChamados === 0 ? (
        <p className="text-xs text-slate-400 py-10 text-center">
          Sem registros de chamados no período para calcular o comparativo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 min-w-[200px]">Indicador</th>
                <th className="py-3 px-3.5 min-w-[150px]">Sua Operação Real</th>
                <th className="py-3 px-3.5 min-w-[210px]">{cenarioIdealTitulo}</th>
                <th className="py-3 px-3.5 min-w-[280px]">Diagnóstico Gerencial / Insights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const isVerde = row.status === 'verde'
                const isVermelho = row.status === 'vermelho'

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 align-top">
                      <div className="font-bold text-slate-900">{row.indicador}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{row.descricao}</div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="font-extrabold text-slate-900 font-mono text-sm">
                        {row.real}
                      </div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="font-medium text-slate-700">{row.ideal}</div>
                    </td>

                    <td className="py-3 px-3.5 align-top">
                      <div className="flex items-start gap-2">
                        {isVerde && (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-semibold shadow-none shrink-0 gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {row.statusTexto}
                          </Badge>
                        )}
                        {isVermelho && (
                          <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 text-[10px] font-semibold shadow-none shrink-0 gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            {row.statusTexto}
                          </Badge>
                        )}
                        {!isVerde && !isVermelho && (
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-semibold shrink-0 mt-0.5"
                          >
                            {row.statusTexto}
                          </Badge>
                        )}
                        <p className="text-xs text-slate-600 leading-relaxed">{row.diagnostico}</p>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nota de rodapé da tabela com referências oficiais por departamento */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="leading-relaxed">
          {isFilterCampo
            ? 'Fontes oficiais de Campo (Field Service): MetricNet — Field Service Benchmarks (1,2–1,8 ch/dia; 70–80% ocupação com trânsito) e CompTIA — Workforce & Tech Support Trends (metodologia de laboratório e swap de máquinas vs ineficiência de formatações in loco de 5h–6h).'
            : isFilterN2
              ? 'Fontes oficiais de N2: AXELOS/PeopleCert — ITIL 4 Framework (Incident Management: TMA 1h–2h30 para diagnóstico de causa raiz e investigação técnica) e Gartner — ITSM Research Reports (disponibilidade vs incidentes recorrentes; modo proativo/preventivo).'
              : 'Fontes oficiais de N1: HDI (Help Desk Institute) — Service Desk Benchmarking Report (TMA 15–25 min para resolução remota rápida) e MetricNet — Desktop Support and Service Desk Benchmarks (produtividade 12–18 chamados/dia).'}
        </span>
        <span className="font-medium text-slate-500 shrink-0">
          Metas customizáveis no menu Equipes
        </span>
      </div>
    </div>
  )
}
