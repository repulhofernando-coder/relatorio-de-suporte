import { useMemo } from 'react'
import { Award, AlertCircle, CheckCircle2, Info, Layers } from 'lucide-react'
import { SupportRecord, DepartmentCapacityRecord } from '@/types/support'
import { Badge } from '@/components/ui/badge'
import {
  FONTES_PROJETOS,
  FONTES_ATIVACAO,
  PROJETOS_TECNICOS_IDEAL,
  PROJETOS_VOLUME_MIN,
  PROJETOS_VOLUME_MAX,
  PROJETOS_TMA_MIN_MINUTOS,
  PROJETOS_TMA_MAX_MINUTOS,
  PROJETOS_BLOQUEIO_MAX_PERCENTUAL,
  PROJETOS_OCUPACAO_MIN,
  PROJETOS_OCUPACAO_MAX,
  ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS,
  ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS,
  ATIVACAO_HANDOVER_MIN_PERCENTUAL,
  ATIVACAO_IMPACTO_MAX_PERCENTUAL,
  ATIVACAO_TECNICOS_IDEAL,
  isProjetos,
  isAtivacao,
} from '@/lib/benchmarks-projetos-ativacao'
import {
  FONTES_DATACENTER_WINDOWS,
  DC_WIN_VOLUME_MIN_MES,
  DC_WIN_VOLUME_MAX_MES,
  DC_WIN_ANALISTAS_IDEAL_MIN,
  DC_WIN_ANALISTAS_IDEAL_MAX,
  DC_WIN_PRODUTIVIDADE_MIN_DIA,
  DC_WIN_PRODUTIVIDADE_MAX_DIA,
  DC_WIN_OCUPACAO_MIN,
  DC_WIN_OCUPACAO_MAX,
  DC_WIN_SLA_ROTINAS_MIN_MINUTOS,
  DC_WIN_SLA_ROTINAS_MAX_MINUTOS,
  DC_WIN_SLA_CLOUD_MIN_MINUTOS,
  DC_WIN_SLA_CLOUD_MAX_MINUTOS,
  formatarDuracaoDatacenter,
} from '@/lib/benchmarks-datacenter-windows'

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

function isLinux(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return norm === 'linux' || norm.includes('linux')
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

function isDatacenterWindows(depto?: string | null): boolean {
  if (!depto) return false
  const norm = depto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '')
    .trim()
  return norm.includes('datacenter') && norm.includes('windows')
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
  const isFilterLinux = useMemo(() => isLinux(selectedDepartamento), [selectedDepartamento])
  const isFilterN2 = useMemo(() => isN2(selectedDepartamento), [selectedDepartamento])
  const isFilterCampo = useMemo(() => isCampo(selectedDepartamento), [selectedDepartamento])
  const isFilterProjetos = useMemo(() => isProjetos(selectedDepartamento), [selectedDepartamento])
  const isFilterAtivacao = useMemo(() => isAtivacao(selectedDepartamento), [selectedDepartamento])
  const isFilterDatacenterWindows = useMemo(
    () => isDatacenterWindows(selectedDepartamento),
    [selectedDepartamento],
  )

  // Busca configuração específica do departamento filtrado se houver.
  // Fila única de Projetos: aceita "Projetos", "Projetos Internos" ou "Projetos Locais"
  const activeCapacity = useMemo(() => {
    if (!selectedDepartamento || selectedDepartamento === 'todos') return null
    return (
      capacities.find(
        (c) => c.departamento.toLowerCase().trim() === selectedDepartamento.toLowerCase().trim(),
      ) ||
      (isFilterProjetos ? capacities.find((c) => isProjetos(c.departamento)) || null : null) ||
      (isFilterAtivacao ? capacities.find((c) => isAtivacao(c.departamento)) || null : null) ||
      (isFilterDatacenterWindows
        ? capacities.find((c) => isDatacenterWindows(c.departamento)) || null
        : null)
    )
  }, [
    capacities,
    selectedDepartamento,
    isFilterProjetos,
    isFilterAtivacao,
    isFilterDatacenterWindows,
  ])

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
    // A capacidade planejada para o período é: técnicos × limite diário × dias de atendimento reais
    let capacidadePlanejadaChamados = 0
    if (activeCapacity) {
      const qtd = activeCapacity.qtd_tecnicos || 1
      const fallbackLim = isFilterLinux ? 5.5 : isFilterCampo ? 1.8 : isFilterN2 ? 2.7 : 15
      const lim = Number(
        activeCapacity.limite_diario ||
          activeCapacity.meta_chamados_dia_max ||
          activeCapacity.meta_chamados_dia ||
          fallbackLim,
      )
      capacidadePlanejadaChamados = qtd * lim * diasAtendimento
    } else if (
      capacities &&
      capacities.length > 0 &&
      (!selectedDepartamento || selectedDepartamento === 'todos')
    ) {
      capacidadePlanejadaChamados = capacities.reduce((acc, c) => {
        const qtd = c.qtd_tecnicos || 0
        const lim = Number(c.limite_diario || c.meta_chamados_dia || 15)
        return acc + qtd * lim * diasAtendimento
      }, 0)
    }

    if (capacidadePlanejadaChamados <= 0) {
      const padraoDia = isFilterLinux ? 5.5 : isFilterCampo ? 1.5 : isFilterN2 ? 2.25 : 15
      capacidadePlanejadaChamados = tecnicosEquipe * padraoDia * diasAtendimento
    }

    const folgaPercent =
      capacidadePlanejadaChamados > 0
        ? ((capacidadePlanejadaChamados - totalChamados) / capacidadePlanejadaChamados) * 100
        : null

    // 5) Equipe necessária para atender o volume com a meta ideal
    const metaProdMedia = isFilterLinux
      ? Number(activeCapacity?.meta_chamados_dia_max ?? activeCapacity?.meta_chamados_dia ?? 5.5)
      : isFilterCampo
        ? Number(activeCapacity?.meta_chamados_dia_max ?? activeCapacity?.meta_chamados_dia ?? 1.5)
        : isFilterN2
          ? Number(
              activeCapacity?.meta_chamados_dia_max ?? activeCapacity?.meta_chamados_dia ?? 2.25,
            )
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
  }, [
    records,
    capacities,
    activeCapacity,
    selectedDepartamento,
    isFilterLinux,
    isFilterN2,
    isFilterCampo,
  ])

  const rows: BenchmarkRow[] = useMemo(() => {
    const list: BenchmarkRow[] = []

    if (isFilterLinux) {
      // =========================================================
      // MODO LINUX (INFRAESTRUTURA MISTA / INTELLIGENT SWARMING)
      // =========================================================
      const metaTmaMin = activeCapacity?.meta_tma_min_num ?? 30
      const metaTmaMax = activeCapacity?.meta_tma_max_num ?? 50
      const metaChMin = activeCapacity?.meta_chamados_dia_min ?? 4
      const metaChMax = activeCapacity?.meta_chamados_dia_max ?? 7
      const metaOcupMin = activeCapacity?.meta_ocupacao_min ?? 65
      const metaOcupMax = activeCapacity?.meta_ocupacao_max ?? 75

      // 1. Volume de Chamados / Mês
      list.push({
        indicador: 'Volume de Chamados no Período',
        descricao: 'Demanda de chamados do departamento Linux absorvida pela equipe',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
        realNum: dados.totalChamados,
        ideal: '~350 a 400 chamados/mês (referência: ~351 chamados)',
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico:
          'Volume saudável para ambientes corporativos e hospedagem. Operação mista (Intelligent Swarming): rotinas ágeis de cPanel/PHP convivendo com investigações aprofundadas de redes e infraestrutura (Fortigate/UniFi).',
      })

      // 2. Tamanho da Equipe Necessária (ideal 2 a 3 técnicos; 7 = operação real atual)
      const eqAtual = dados.tecnicosEquipe
      const eqDentro = eqAtual >= 2 && eqAtual <= 3
      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe Linux para cobrir a operação especializada mista',
        real: `${eqAtual} técnicos (operação real)`,
        realNum: eqAtual,
        ideal: '2 a 3 técnicos',
        status: eqDentro ? 'verde' : 'vermelho',
        statusTexto: eqDentro ? 'Dentro da meta' : 'Acima do ideal',
        diagnostico: eqDentro
          ? `Equipe de ${eqAtual} técnicos dentro do dimensionamento ideal para o volume da operação.`
          : `Equipe atual de ${eqAtual} técnicos dimensionada para alta disponibilidade, projetos e margem de crescimento — acima do cenário ideal de 2 a 3 técnicos para ${dados.totalChamados.toLocaleString('pt-BR')} chamados/mês.`,
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
          diagnostico = `Excelente. TMA em ${tmaFormat}, dentro da faixa alvo mista (30–50 min). Reflete equilíbrio entre rotinas ágeis de cPanel/PHP e análises de redes.`
        } else if (abaixo) {
          diagnostico = `Média de ${tmaFormat}, abaixo de 30 min. Predomínio de tickets rápidos de cPanel/PHP ou falta de registro de tempo em manutenções profundas.`
        } else {
          diagnostico = `Média de ${tmaFormat}, acima de 50 min. Maior concentração de chamados complexos de redes (Fortigate/UniFi) ou gargalo de investigação técnica.`
        }

        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA Geral)',
          descricao: 'Duração média dedicada por chamado na esteira mista Linux',
          real: tmaFormat,
          realNum: tmaRound,
          ideal: `${metaTmaMin} a ${metaTmaMax} min (referência ~42 min / 0,71h)`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Tempo Médio de Atendimento (TMA Geral)',
          descricao: 'Duração média dedicada por chamado na esteira mista Linux',
          real: 'Sem apontamento',
          realNum: null,
          ideal: `${metaTmaMin} a ${metaTmaMax} min (referência ~42 min / 0,71h)`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico:
            'Os chamados de Linux no período não possuem apontamento de tempo trabalhado.',
        })
      }

      // 4. SLA por Complexidade (cPanel/PHP vs Fortigate/UniFi)
      list.push({
        indicador: 'SLA Alvo por Complexidade',
        descricao: 'Referência por categoria: rotinas de painel vs redes e firewalls',
        real: 'Mix de atendimentos',
        realNum: null,
        ideal: 'N1 (cPanel/PHP): 30 a 45 min • N2 (Fortigate/UniFi): 1h30 a 3h',
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico:
          'O sistema deve validar o estouro de tempo de acordo com a categoria do ticket: rotinas de cPanel/PHP fecham entre 30 e 45 min; chamados de Fortigate/UniFi têm tolerância entre 1h30 e 3h para causa raiz.',
      })

      // 5. Produtividade Diária (Chamados/Técnico)
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
          diagnostico = `Produtividade equilibrada para o perfil misto (${prodFormat} chamados/dia vs meta ${metaChMin} a ${metaChMax} chamados/dia).`
        } else if (abaixo) {
          diagnostico = `Média de ${prodFormat} chamados/dia abaixo da faixa ideal de ${metaChMin} a ${metaChMax}. Foco em resolução definitiva no primeiro contato sem sobrecarga de fila.`
        } else {
          diagnostico = `Produtividade acima de 7 chamados/dia (${prodFormat}). Volume elevado: monitorar se a equipe não está sobrecarregada ou focada apenas em tarefas rápidas.`
        }

        list.push({
          indicador: 'Produtividade Diária (Chamados/Técnico)',
          descricao: 'Média de tickets concluídos por especialista em cada dia útil',
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
          descricao: 'Média de tickets concluídos por especialista em cada dia útil',
          real: '—',
          realNum: null,
          ideal: `${metaChMin.toLocaleString('pt-BR')} a ${metaChMax.toLocaleString('pt-BR')} chamados/dia`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico: 'Sem registros suficientes para calcular a produtividade diária do Linux.',
        })
      }

      // 6. Ocupação Direta em Tickets
      if (dados.taxaOcupacaoPercent !== null) {
        const ocup = Math.round(dados.taxaOcupacaoPercent * 10) / 10
        const ocupFormat = `${ocup.toLocaleString('pt-BR')}%`
        const dentro = ocup >= metaOcupMin && ocup <= metaOcupMax
        const abaixo = ocup < metaOcupMin

        let status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        let statusTexto = dentro ? 'Dentro da meta' : abaixo ? 'Abaixo da meta' : 'Acima da meta'

        let diagnostico = ''
        if (dentro) {
          diagnostico = `Ocupação saudável (${ocupFormat} do tempo em tickets). Restante (~25% a 35%) preservado para manutenções, scripts e automação de servidores.`
        } else if (abaixo) {
          diagnostico = `Ocupação em tickets de ${ocupFormat}. Foco Preventivo (~80%): tempo livre investido em segurança, tuning, backups e melhorias.`
        } else {
          diagnostico = `A equipe está gastando ${ocupFormat} do expediente em tickets. Risco de negligenciar atualizações preventivas e automações de infra.`
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

    if (isFilterProjetos) {
      // =========================================================
      // MODO PROJETOS (fila única: Projetos + Projetos Internos + Projetos Locais)
      // =========================================================
      const metaTmaMin = activeCapacity?.meta_tma_min_num ?? PROJETOS_TMA_MIN_MINUTOS
      const metaTmaMax = activeCapacity?.meta_tma_max_num ?? PROJETOS_TMA_MAX_MINUTOS

      // 1. Volume de Projetos / Mês
      list.push({
        indicador: 'Volume de Projetos no Período',
        descricao: 'Demanda de projetos (fila única) absorvida pela equipe no recorte',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} lançamentos`,
        realNum: dados.totalChamados,
        ideal: `${PROJETOS_VOLUME_MIN} a ${PROJETOS_VOLUME_MAX} projetos/mês`,
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico:
          'Fila única de Projetos: soma os rótulos "Projetos", "Projetos Internos" e "Projetos Locais" da planilha.',
      })

      // 2. Tamanho da Equipe Necessária (ideal 3 técnicos)
      const eqAtual = dados.tecnicosEquipe
      const eqDentro = eqAtual >= PROJETOS_TECNICOS_IDEAL
      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe de projetos para o volume da operação',
        real: `${eqAtual} técnico${eqAtual > 1 ? 's' : ''}`,
        realNum: eqAtual,
        ideal: `${PROJETOS_TECNICOS_IDEAL} técnicos`,
        status: eqDentro ? 'verde' : 'vermelho',
        statusTexto: eqDentro ? 'Dentro da meta' : 'Abaixo do ideal',
        diagnostico: eqDentro
          ? `Equipe de ${eqAtual} técnicos dentro do dimensionamento ideal (${PROJETOS_TECNICOS_IDEAL} técnicos).`
          : `Equipe atual de ${eqAtual} técnico(s) abaixo do ideal de ${PROJETOS_TECNICOS_IDEAL} técnicos para ${PROJETOS_VOLUME_MIN} a ${PROJETOS_VOLUME_MAX} projetos/mês.`,
      })

      // 3. TMA por projeto (horas líquidas apontadas)
      if (dados.tmaRealMin !== null) {
        const tmaRound = Math.round(dados.tmaRealMin)
        const tmaFormat = formatMinutesToHours(tmaRound)

        const dentroFaixa = tmaRound >= metaTmaMin && tmaRound <= metaTmaMax
        const abaixo = tmaRound < metaTmaMin
        const acima = tmaRound > metaTmaMax

        const status: 'verde' | 'vermelho' = dentroFaixa ? 'verde' : 'vermelho'
        const statusTexto = dentroFaixa
          ? 'Dentro da meta'
          : abaixo
            ? 'Abaixo da faixa'
            : 'Acima da meta'

        const diagnostico = dentroFaixa
          ? `Excelente. TMA em ${tmaFormat}, dentro da faixa de 8h a 16h líquidas por projeto.`
          : abaixo
            ? `Média de ${tmaFormat}, abaixo de 8h líquidas. Projetos pequenos ou apontamento parcial do tempo real (documentação, testes e reuniões fora do lançamento).`
            : `Média de ${tmaFormat}, acima de 16h líquidas. Projetos longos ou gargalo na execução — monitorar a taxa de bloqueio (meta: abaixo de ${PROJETOS_BLOQUEIO_MAX_PERCENTUAL}%).`

        list.push({
          indicador: 'Tempo Médio por Projeto (TMA)',
          descricao: 'Horas líquidas apontadas por projeto concluído',
          real: tmaFormat,
          realNum: tmaRound,
          ideal: `8h a 16h líquidas (${metaTmaMin / 60}h a ${metaTmaMax / 60}h)`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Tempo Médio por Projeto (TMA)',
          descricao: 'Horas líquidas apontadas por projeto concluído',
          real: 'Sem apontamento',
          realNum: null,
          ideal: '8h a 16h líquidas por projeto',
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico:
            'Os lançamentos de Projetos no período não possuem apontamento de tempo trabalhado.',
        })
      }

      // 4. Taxa de Bloqueio (indicador ainda não medido — referência)
      list.push({
        indicador: 'Taxa de Bloqueio',
        descricao: 'Percentual do tempo com projetos paralisados (aguardando cliente/approvação)',
        real: 'Não medido',
        realNum: null,
        ideal: `Abaixo de ${PROJETOS_BLOQUEIO_MAX_PERCENTUAL}% do tempo`,
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico: `Meta cadastrada como referência: manter o tempo em bloqueio abaixo de ${PROJETOS_BLOQUEIO_MAX_PERCENTUAL}%. O sistema ainda não mede este indicador — exigiria status de bloqueio no lançamento.`,
      })

      // 5. Ocupação da equipe em projetos
      if (dados.taxaOcupacaoPercent !== null) {
        const ocup = Math.round(dados.taxaOcupacaoPercent * 10) / 10
        const ocupFormat = `${ocup.toLocaleString('pt-BR')}%`
        const dentro = ocup >= PROJETOS_OCUPACAO_MIN && ocup <= PROJETOS_OCUPACAO_MAX

        const status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        const statusTexto = dentro
          ? 'Dentro da meta'
          : ocup < PROJETOS_OCUPACAO_MIN
            ? 'Abaixo da meta'
            : 'Acima da meta'

        const diagnostico = dentro
          ? `Ocupação saudável (${ocupFormat} do tempo em projetos). Restante preservado para documentação, testes e reuniões.`
          : ocup < PROJETOS_OCUPACAO_MIN
            ? `Ocupação de ${ocupFormat}, abaixo da faixa de ${PROJETOS_OCUPACAO_MIN}% a ${PROJETOS_OCUPACAO_MAX}%. Equipe com margem — avaliar absorção de novos projetos.`
            : `Ocupação de ${ocupFormat}, acima de ${PROJETOS_OCUPACAO_MAX}%. Risco de sobrecarga e de drenar técnicos do suporte operacional.`

        list.push({
          indicador: 'Ocupação da Equipe em Projetos',
          descricao: 'Percentual do expediente investido diretamente na execução de projetos',
          real: `~${ocupFormat} do tempo`,
          realNum: ocup,
          ideal: `${PROJETOS_OCUPACAO_MIN}% a ${PROJETOS_OCUPACAO_MAX}% do tempo`,
          status,
          statusTexto,
          diagnostico,
        })
      }

      return list
    }

    if (isFilterAtivacao) {
      // =========================================================
      // MODO ATIVAÇÃO (implantação / onboarding)
      // =========================================================

      // 1. Volume de Ativações no Período
      list.push({
        indicador: 'Volume de Ativações no Período',
        descricao: 'Implantações/onboardings conduzidos pela equipe no recorte',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} lançamentos`,
        realNum: dados.totalChamados,
        ideal: 'Fluxo contínuo conforme demanda comercial',
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico:
          'Lead time de 7 a 15 dias úteis por ativação — pouco fluxo simultâneo por técnico.',
      })

      // 2. Tamanho da Equipe Necessária (ideal 2 técnicos)
      const eqAtual = dados.tecnicosEquipe
      const eqDentro = eqAtual >= ATIVACAO_TECNICOS_IDEAL
      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe de ativação/implantação',
        real: `${eqAtual} técnico${eqAtual > 1 ? 's' : ''}`,
        realNum: eqAtual,
        ideal: `${ATIVACAO_TECNICOS_IDEAL} técnicos`,
        status: eqDentro ? 'verde' : 'vermelho',
        statusTexto: eqDentro ? 'Dentro da meta' : 'Abaixo do ideal',
        diagnostico: eqDentro
          ? `Equipe de ${eqAtual} técnicos dentro do dimensionamento ideal (${ATIVACAO_TECNICOS_IDEAL} técnicos).`
          : `Equipe atual de ${eqAtual} técnico(s) abaixo do ideal de ${ATIVACAO_TECNICOS_IDEAL} técnicos.`,
      })

      // 3. Lead Time (indicador ainda não medido — referência)
      list.push({
        indicador: 'Lead Time de Ativação',
        descricao: 'Prazo do pedido comercial até a entrega em produção',
        real: 'Não medido',
        realNum: null,
        ideal: `${ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS} a ${ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS} dias úteis`,
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico: `Meta cadastrada como referência: concluir cada ativação entre ${ATIVACAO_LEAD_TIME_MIN_DIAS_UTEIS} e ${ATIVACAO_LEAD_TIME_MAX_DIAS_UTEIS} dias úteis. O sistema ainda não mede este indicador — exigiria datas de pedido e de entrega no lançamento.`,
      })

      // 4. Handover (indicador ainda não medido — referência)
      list.push({
        indicador: 'Handover para o Suporte',
        descricao: 'Percentual de ativações transferidas sem falhas para a operação',
        real: 'Não medido',
        realNum: null,
        ideal: `Acima de ${ATIVACAO_HANDOVER_MIN_PERCENTUAL}%`,
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico: `Meta cadastrada como referência: handover formal sem falhas acima de ${ATIVACAO_HANDOVER_MIN_PERCENTUAL}%. O sistema ainda não mede este indicador — exigiria checklist de transferência por ativação.`,
      })

      // 5. Impacto na Capacidade (indicador ainda não medido — referência)
      list.push({
        indicador: 'Impacto na Capacidade',
        descricao: 'Percentual da capacidade do time consumido por ativações',
        real: 'Não medido',
        realNum: null,
        ideal: `Até ${ATIVACAO_IMPACTO_MAX_PERCENTUAL}% da capacidade`,
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico: `Meta cadastrada como referência: ativações não devem consumir mais de ${ATIVACAO_IMPACTO_MAX_PERCENTUAL}% da capacidade da operação. O sistema ainda não mede este indicador.`,
      })

      return list
    }

    if (isFilterDatacenterWindows) {
      // =========================================================
      // MODO DATACENTER WINDOWS: benchmark cadastrado pela gestão
      // ("Quadro Atualizado: Datacenter Windows — 170 Chamados/Mês")
      // =========================================================

      // 1. Volume de chamados / mês (ideal 100 a 140, referência para 2,5 técnicos)
      list.push({
        indicador: 'Volume de Chamados / Mês',
        descricao: 'Demanda do time de Datacenter Windows (engenharia de servidores e cloud)',
        real: `${dados.totalChamados.toLocaleString('pt-BR')} chamados`,
        realNum: dados.totalChamados,
        ideal: `${DC_WIN_VOLUME_MIN_MES} a ${DC_WIN_VOLUME_MAX_MES} chamados/mês (referência para 2,5 técnicos)`,
        status: 'informativo',
        statusTexto: 'Informativo',
        diagnostico:
          'Cenário acima da faixa ideal indica demanda elevada: forte crescimento da nuvem ou excesso de rotinas manuais — avaliar automatização e dimensionamento.',
      })

      // 2. Tamanho da equipe necessária (ideal 3 a 4 analistas + gestor dedicado)
      const eqAtual = dados.tecnicosEquipe
      const eqDentro =
        eqAtual >= DC_WIN_ANALISTAS_IDEAL_MIN && eqAtual <= DC_WIN_ANALISTAS_IDEAL_MAX
      const eqAcima = eqAtual > DC_WIN_ANALISTAS_IDEAL_MAX
      list.push({
        indicador: 'Tamanho da Equipe Necessária',
        descricao: 'Dimensionamento da equipe para o volume de chamados e projetos de nuvem',
        real: `${eqAtual} técnico${eqAtual > 1 ? 's' : ''}`,
        realNum: eqAtual,
        ideal: `${DC_WIN_ANALISTAS_IDEAL_MIN} a ${DC_WIN_ANALISTAS_IDEAL_MAX} analistas + gestor dedicado`,
        status: eqDentro || eqAcima ? 'verde' : 'vermelho',
        statusTexto: eqDentro
          ? 'Dentro da meta'
          : eqAcima
            ? 'Margem de segurança'
            : 'Abaixo do ideal',
        diagnostico: eqDentro
          ? `Equipe de ${eqAtual} pessoas dentro do dimensionamento ideal (3 a 4 analistas + gestor dedicado). Com o volume real, o risco é o gestor ficar puxado demais para a operação diária.`
          : eqAcima
            ? `Equipe de ${eqAtual} técnicos acima do ideal (3 a 4 analistas + gestor dedicado) — margem para picos e projetos de nuvem.`
            : `Equipe de ${eqAtual} técnico(s) abaixo do ideal de ${DC_WIN_ANALISTAS_IDEAL_MIN} a ${DC_WIN_ANALISTAS_IDEAL_MAX} analistas + gestor dedicado: com esse volume, o gestor acaba sendo puxado demais para a operação diária.`,
      })

      // 3. Produtividade diária por recurso (ideal 1,8 a 2,5 chamados/dia)
      if (dados.chamadosPorTecnicoDiaReal !== null && dados.totalChamados > 0) {
        const prod = Math.round(dados.chamadosPorTecnicoDiaReal * 100) / 100
        const prodFormat = prod.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const dentro = prod >= DC_WIN_PRODUTIVIDADE_MIN_DIA && prod <= DC_WIN_PRODUTIVIDADE_MAX_DIA
        const abaixo = prod < DC_WIN_PRODUTIVIDADE_MIN_DIA

        const status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        const statusTexto = dentro ? 'Dentro da meta' : abaixo ? 'Abaixo da meta' : 'Acima da meta'

        const diagnostico = dentro
          ? `Produtividade equilibrada (${prodFormat} chamados/dia por recurso vs meta ${DC_WIN_PRODUTIVIDADE_MIN_DIA.toLocaleString('pt-BR')} a ${DC_WIN_PRODUTIVIDADE_MAX_DIA.toLocaleString('pt-BR')}).`
          : abaixo
            ? `Média de ${prodFormat} chamados/dia por recurso, abaixo da faixa ideal de ${DC_WIN_PRODUTIVIDADE_MIN_DIA.toLocaleString('pt-BR')} a ${DC_WIN_PRODUTIVIDADE_MAX_DIA.toLocaleString('pt-BR')}. Avaliar apontamentos e fila de demandas.`
            : `Ritmo acelerado (${prodFormat} chamados/dia por recurso vs meta ${DC_WIN_PRODUTIVIDADE_MIN_DIA.toLocaleString('pt-BR')} a ${DC_WIN_PRODUTIVIDADE_MAX_DIA.toLocaleString('pt-BR')}): ritmo intenso para demandas de engenharia de servidores e cloud — monitorar qualidade e sobrecarga.`

        list.push({
          indicador: 'Produtividade Diária (por recurso)',
          descricao: 'Média de chamados por recurso da equipe em cada dia útil',
          real: `${prodFormat} chamados/dia`,
          realNum: prod,
          ideal: `${DC_WIN_PRODUTIVIDADE_MIN_DIA.toLocaleString('pt-BR')} a ${DC_WIN_PRODUTIVIDADE_MAX_DIA.toLocaleString('pt-BR')} chamados/dia (por recurso)`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Produtividade Diária (por recurso)',
          descricao: 'Média de chamados por recurso da equipe em cada dia útil',
          real: '—',
          realNum: null,
          ideal: `${DC_WIN_PRODUTIVIDADE_MIN_DIA.toLocaleString('pt-BR')} a ${DC_WIN_PRODUTIVIDADE_MAX_DIA.toLocaleString('pt-BR')} chamados/dia (por recurso)`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico: 'Sem registros suficientes para calcular a produtividade diária do setor.',
        })
      }

      // 4. SLA alvo por complexidade (Rotinas RAM/VPN vs Cloud VPS/Migração/POC)
      list.push({
        indicador: 'SLA Alvo por Complexidade',
        descricao: 'Referência por categoria: manutenção rápida vs projetos de nuvem',
        real:
          dados.tmaRealMin !== null
            ? `${formatMinutesToHours(Math.round(dados.tmaRealMin))} (TMA geral)`
            : 'A levantar',
        realNum: null,
        ideal: `Rotinas (RAM/VPN): ${formatarDuracaoDatacenter(DC_WIN_SLA_ROTINAS_MIN_MINUTOS)} a ${formatarDuracaoDatacenter(DC_WIN_SLA_ROTINAS_MAX_MINUTOS)} • Cloud (VPS/Migração/POC): ${formatarDuracaoDatacenter(DC_WIN_SLA_CLOUD_MIN_MINUTOS)} a ${formatarDuracaoDatacenter(DC_WIN_SLA_CLOUD_MAX_MINUTOS)}`,
        status: 'informativo',
        statusTexto: 'Referência',
        diagnostico:
          'O sistema deve separar o tempo gasto em manutenção rápida (RAM/VPN) do tempo de projetos de nuvem (VPS, migração e POC). TMA real por complexidade: a levantar.',
      })

      // 5. Ocupação direta estimada (ideal 65% a 75% do tempo)
      if (dados.taxaOcupacaoPercent !== null) {
        const ocup = Math.round(dados.taxaOcupacaoPercent * 10) / 10
        const ocupFormat = `${ocup.toLocaleString('pt-BR')}%`
        const dentro = ocup >= DC_WIN_OCUPACAO_MIN && ocup <= DC_WIN_OCUPACAO_MAX
        const abaixo = ocup < DC_WIN_OCUPACAO_MIN

        const status: 'verde' | 'vermelho' = dentro ? 'verde' : 'vermelho'
        const statusTexto = dentro ? 'Dentro da meta' : abaixo ? 'Abaixo da meta' : 'Acima da meta'

        const diagnostico = dentro
          ? `Ocupação saudável (${ocupFormat} do tempo em chamados). Restante preservado para monitoramento proativo, backups e segurança dos hosts.`
          : abaixo
            ? `Ocupação de ${ocupFormat}, abaixo da faixa ideal de ${DC_WIN_OCUPACAO_MIN}% a ${DC_WIN_OCUPACAO_MAX}%. Margem para investir em monitoramento proativo, backups e segurança.`
            : `Ocupação alta (${ocupFormat}), próxima ao limite da faixa de ${DC_WIN_OCUPACAO_MIN}% a ${DC_WIN_OCUPACAO_MAX}%. Risco de faltar tempo livre para monitoramento proativo, backups e segurança dos hosts.`

        list.push({
          indicador: 'Ocupação Direta Estimada',
          descricao: 'Percentual do expediente investido diretamente nos chamados',
          real: `~${ocupFormat} do tempo`,
          realNum: ocup,
          ideal: `${DC_WIN_OCUPACAO_MIN}% a ${DC_WIN_OCUPACAO_MAX}% do tempo`,
          status,
          statusTexto,
          diagnostico,
        })
      } else {
        list.push({
          indicador: 'Ocupação Direta Estimada',
          descricao: 'Percentual do expediente investido diretamente nos chamados',
          real: 'Sem apontamento',
          realNum: null,
          ideal: `${DC_WIN_OCUPACAO_MIN}% a ${DC_WIN_OCUPACAO_MAX}% do tempo`,
          status: 'vermelho',
          statusTexto: 'Sem dados',
          diagnostico:
            'Os chamados do período não possuem apontamento de tempo trabalhado para estimar a ocupação.',
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
  }, [
    dados,
    isFilterLinux,
    isFilterN2,
    isFilterCampo,
    isFilterProjetos,
    isFilterAtivacao,
    isFilterDatacenterWindows,
    activeCapacity,
  ])

  // Título e cabeçalhos dinâmicos
  const cenarioIdealTitulo = isFilterLinux
    ? 'Cenário Ideal (Linux Misto)'
    : isFilterCampo
      ? 'Cenário Ideal (Field Service)'
      : isFilterN2
        ? 'Cenário Ideal (N2 Remoto)'
        : isFilterProjetos
          ? 'Cenário Ideal (Fila única de Projetos)'
          : isFilterAtivacao
            ? 'Cenário Ideal (Ativação / Implantação)'
            : isFilterDatacenterWindows
              ? 'Cenário Ideal (Datacenter Windows — N2/N3 Cloud)'
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
                isFilterLinux
                  ? 'bg-purple-50 text-purple-600'
                  : isFilterCampo
                    ? 'bg-blue-50 text-blue-600'
                    : isFilterN2
                      ? 'bg-amber-50 text-amber-600'
                      : isFilterDatacenterWindows
                        ? 'bg-indigo-50 text-indigo-600'
                        : isFilterProjetos || isFilterAtivacao
                          ? 'bg-cyan-50 text-cyan-600'
                          : 'bg-teal-50 text-teal-600'
              }`}
            >
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Comparativo de Desempenho (Benchmark)
                {isFilterLinux && (
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold"
                  >
                    Perfil Linux Misto
                  </Badge>
                )}
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
                {isFilterProjetos && (
                  <Badge
                    variant="outline"
                    className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] font-semibold"
                  >
                    Fila única de Projetos
                  </Badge>
                )}
                {isFilterAtivacao && (
                  <Badge
                    variant="outline"
                    className="bg-cyan-50 text-cyan-700 border-cyan-200 text-[10px] font-semibold"
                  >
                    Perfil Ativação
                  </Badge>
                )}
                {isFilterDatacenterWindows && (
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold"
                  >
                    Perfil Datacenter Windows
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {isFilterLinux
                  ? 'Comparação com os benchmarks para operação mista Linux (Intelligent Swarming: cPanel/PHP vs redes Fortigate/UniFi)'
                  : isFilterCampo
                    ? 'Comparação com os benchmarks de gestão para operação Campo (deslocamento, laboratório e atendimento presencial)'
                    : isFilterN2
                      ? 'Comparação com os benchmarks de gestão para operação N2 (baixo volume, infraestrutura e projetos)'
                      : isFilterProjetos
                        ? 'Comparação com as metas internas da fila única de Projetos (execução de projetos e demandas internas/locais)'
                        : isFilterAtivacao
                          ? 'Comparação com as metas internas de Ativação (implantações e onboarding de clientes)'
                          : isFilterDatacenterWindows
                            ? 'Comparação com as metas internas de Datacenter Windows (engenharia de servidores e cloud: rotinas de RAM/VPN e projetos de VPS, migração e POC)'
                            : 'Comparação entre a operação real e as referências de mercado N1 Remoto (HDI/MetricNet)'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          {isFilterLinux ? (
            <>
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-medium text-slate-700">
                Fontes: Swarming℠, HDI & MetricNet (Linux)
              </span>
            </>
          ) : isFilterCampo ? (
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
          ) : isFilterProjetos ? (
            <>
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span className="font-medium text-slate-700">Fontes: {FONTES_PROJETOS}</span>
            </>
          ) : isFilterAtivacao ? (
            <>
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              <span className="font-medium text-slate-700">Fontes: {FONTES_ATIVACAO}</span>
            </>
          ) : isFilterDatacenterWindows ? (
            <>
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-medium text-slate-700">
                Fontes: Gartner, ITIL 4 & Uptime Institute (Datacenter)
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

      {isFilterDatacenterWindows && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="leading-relaxed">
            <b>Datacenter Windows:</b> metas implantadas a partir da tabela da gestão ("Quadro
            Atualizado: Datacenter Windows — 170 Chamados/Mês"). O TMA real <b>por complexidade</b>{' '}
            segue a levantar — o comparativo mostra o TMA geral apontado no período. O filtro{' '}
            <b>"Datacenter Windows"</b> é fila própria e <b>não</b> soma com o filtro "Windows".
          </p>
        </div>
      )}

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
          {isFilterLinux
            ? 'Fontes oficiais de Linux: Consortium for Service Innovation — Intelligent Swarming℠ (operação sem filas rígidas); HDI — Support Center Practices & Salary Report (resolução por complexidade: 30–45 min cPanel/PHP; 1h30–3h Fortigate/UniFi); MetricNet — Infrastructure and Network Support Benchmarks (TMA misto 30–50 min).'
            : isFilterCampo
              ? 'Fontes oficiais de Campo (Field Service): MetricNet — Field Service Benchmarks (1,2–1,8 ch/dia; 70–80% ocupação com trânsito) e CompTIA — Workforce & Tech Support Trends (metodologia de laboratório e swap de máquinas vs ineficiência de formatações in loco de 5h–6h).'
              : isFilterN2
                ? 'Fontes oficiais de N2: AXELOS/PeopleCert — ITIL 4 Framework (Incident Management: TMA 1h–2h30 para diagnóstico de causa raiz e investigação técnica) e Gartner — ITSM Research Reports (disponibilidade vs incidentes recorrentes; modo proativo/preventivo).'
                : isFilterProjetos
                  ? `Fontes oficiais de Projetos: Project Management Institute — PMBOK Guide (dimensionamento de equipe e TMA de 8h a 16h líquidas por projeto) e Service Leadership ( benchmarks de lucratividade e ocupação de equipes de projetos: 40–90%).`
                  : isFilterAtivacao
                    ? 'Fontes oficiais de Ativação: AXELOS/PeopleCert — ITIL 4 Framework (lead time e handover de implantação: 7–15 dias úteis; transferência formal acima de 90%) e CompTIA — Workforce & Tech Support Trends (impacto de projetos na capacidade: até 25%).'
                    : isFilterDatacenterWindows
                      ? `Fontes oficiais de Datacenter Windows: Gartner — Cloud Infrastructure & Operations (dimensionamento de equipe de 3–4 analistas + gestor dedicado, produtividade de 1,8–2,5 chamados/dia por recurso e volume de 100–140 chamados/mês); ITIL 4 (AXELOS/PeopleCert) — Gerenciamento de Capacidade e Disponibilidade (SLA por complexidade: Rotinas RAM/VPN 45min–1h30; Cloud VPS/Migração/POC 4h–12h); Uptime Institute — Padrões de Operação de Datacenter (ocupação direta de 65–75% do tempo, preservando espaço para monitoramento proativo, backups e segurança dos hosts).`
                      : 'Fontes oficiais de N1: HDI (Help Desk Institute) — Service Desk Benchmarking Report (TMA 15–25 min para resolução remota rápida) e MetricNet — Desktop Support and Service Desk Benchmarks (produtividade 12–18 chamados/dia).'}
        </span>
        <span className="font-medium text-slate-500 shrink-0">
          Metas customizáveis no menu Equipes
        </span>
      </div>
    </div>
  )
}
