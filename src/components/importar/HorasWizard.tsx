/**
 * Wizard de importação de "Horas trabalhadas" (relatório Tempo trabalhado nos
 * tickets do Movidesk), renderizado dentro do wizard de /importar quando o tipo
 * escolhido é "horas". Segue o mesmo visual/fluxo do fluxo de chamados:
 * 1) arquivo → 2) mapeamento → 3) revisar/importar.
 *
 * Regras:
 * - Status precisa ser "Resolvido"/"Resolved"/"Fechado"/"Closed" — outras linhas
 *   são ignoradas (contadas e mostradas com o motivo no resultado).
 * - Tempo aceita "0,71h", "01:30", "1h30", "45min", decimais e números puros
 *   (tratados como HORAS decimais — ver src/lib/tempo-horas.ts).
 * - Mapeamento memorizado na tabela mapeamentos (mesma tabela do fluxo de
 *   chamados), com prefixo "[Horas]" no nome para não conflitar.
 */
import { useMemo, useRef, useState } from 'react'
import {
  parseSpreadsheetFile,
  autoDetectMappingHoras,
  parseDateToISO,
  parseHoras as parseValorHoras,
  ParsedSpreadsheet,
} from '@/lib/horas-spreadsheet'
import { traduzirErro } from '@/lib/erros'
import { insertTimeLogsBatch, upsertMapeamentoHoras } from '@/services/horas'
import { createImportRecord } from '@/services/support'
import { useAuth } from '@/hooks/use-auth'
import {
  CAMPOS_HORAS,
  CampoHoraKey,
  LABELS_CAMPOS_HORAS,
  MappingHoras,
  TimeLogInsert,
} from '@/types/horas'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Layers,
  Sparkles,
  HelpCircle,
  Check,
  ChevronDown,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

const EMPTY_MAPPING_HORAS: Record<CampoHoraKey, string> = {
  numero_ticket: '',
  cliente: '',
  tecnico: '',
  departamento: '',
  data_lancamento: '',
  tempo_lancamento: '',
  tempo_total_chamado: '',
  status: '',
}

const PREFIXO_NOME_HORAS = '[Horas]'

/** Status aceitos na importação (normalizados, sem acento, minúsculo). */
function normalizarStatus(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STATUS_ACEITOS = new Set([
  'resolvido',
  'resolved',
  'fechado',
  'closed',
  'resolvidos',
  'fechados',
  'resolvida',
  'fechada',
])

const isStatusResolvido = (value: unknown): boolean => STATUS_ACEITOS.has(normalizarStatus(value))

export interface HorasWizardProps {
  savedMappings: Array<{ id: string; nome: string; mapeamento: Record<string, string> }>
}

export default function HorasWizard({ savedMappings }: HorasWizardProps) {
  const { isAdmin } = useAuth()
  // Passo do wizard (interno — o passo global fica com o pai)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Passo 1: Arquivo e Parse
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Passo 2: Mapeamento de Colunas
  const [mapping, setMapping] = useState<Record<CampoHoraKey, string>>({ ...EMPTY_MAPPING_HORAS })
  const [mappingName, setMappingName] = useState<string>('')
  const [saveMapping, setSaveMapping] = useState<boolean>(true)
  const [autoDetectedMessage, setAutoDetectedMessage] = useState<string | null>(null)
  // Id do mapeamento salvo selecionado no Passo 2
  const [selectedMappingIdLocal, setSelectedMappingIdLocal] = useState<string>('auto')

  // Passo 3: Importação e Resultado
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ inserted: number; total: number }>({
    inserted: 0,
    total: 0,
  })
  const [importResult, setImportResult] = useState<{
    importId: string
    totalLinhas: number
    inseridas: number
    ignoradasStatus: number
    erros: number
    detalhes: Array<{ linha: number; motivo: string }>
  } | null>(null)
  const [showErrorList, setShowErrorList] = useState(false)

  // Nome base do arquivo para o mapeamento
  const baseName = file ? file.name.replace(/\.[^/.]+$/, '').trim() : ''

  // Handler de seleção de arquivo
  const handleFileSelect = async (selectedFile: File) => {
    setParseError(null)
    setAutoDetectedMessage(null)

    // Valida extensão
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Formato inválido. Por favor envie um arquivo .xlsx, .xls ou .csv.')
      return
    }

    setFile(selectedFile)
    setParsing(true)

    try {
      const data = await parseSpreadsheetFile(selectedFile)
      setParsedData(data)

      // Nome base do arquivo para o mapeamento
      const bn = selectedFile.name.replace(/\.[^/.]+$/, '').trim()
      setMappingName(bn ? `${PREFIXO_NOME_HORAS} ${bn}` : `${PREFIXO_NOME_HORAS} Mapeamento`)

      // Tenta encontrar um mapeamento salvo (com prefixo [Horas]) cujas colunas batem
      let matchedSavedMapping: HorasWizardProps['savedMappings'][number] | null = null
      if (selectedMappingIdLocal !== 'auto') {
        matchedSavedMapping = savedMappings.find((m) => m.id === selectedMappingIdLocal) || null
      }
      if (!matchedSavedMapping) {
        for (const saved of savedMappings) {
          if (!saved.nome.startsWith(PREFIXO_NOME_HORAS)) continue
          const mappedCols = Object.values(saved.mapeamento || {}).filter(Boolean)
          if (mappedCols.length >= 3 && mappedCols.every((col) => data.headers.includes(col))) {
            matchedSavedMapping = saved
            break
          }
        }
      }

      if (matchedSavedMapping) {
        applySavedMapping(matchedSavedMapping, true)
      } else {
        // Executa auto-detecção por sinônimos
        const detected = autoDetectMappingHoras(data.headers)
        setMapping({ ...EMPTY_MAPPING_HORAS, ...detected })
        setSelectedMappingIdLocal('auto')
        setAutoDetectedMessage(
          'Mapeamento detectado automaticamente a partir dos nomes das colunas',
        )
        setSaveMapping(true)
      }
      setCurrentStep(2)
    } catch (err) {
      console.error('Erro ao ler planilha:', err)
      setParseError(traduzirErro(err))
      setFile(null)
      setParsedData(null)
    } finally {
      setParsing(false)
    }
  }

  const applySavedMapping = (
    saved: HorasWizardProps['savedMappings'][number],
    matched: boolean,
  ) => {
    const newMap: Record<CampoHoraKey, string> = { ...EMPTY_MAPPING_HORAS }
    for (const key of CAMPOS_HORAS) {
      newMap[key] = (saved.mapeamento as Record<string, string>)[key] || ''
    }
    setMapping(newMap)
    setAutoDetectedMessage(
      matched
        ? `Mapeamento "${saved.nome}" detectado automaticamente`
        : `Usando mapeamento salvo: ${saved.nome}`,
    )
    setSaveMapping(matched)
    if (!matched) setSelectedMappingIdLocal(saved.id)
  }

  // Troca de aba da planilha
  const handleSheetChange = async (sheetName: string) => {
    if (!file) return
    setParsing(true)
    setParseError(null)
    try {
      const data = await parseSpreadsheetFile(file, sheetName)
      setParsedData(data)
      const detected = autoDetectMappingHoras(data.headers)
      setMapping({ ...EMPTY_MAPPING_HORAS, ...detected })
      setSelectedMappingIdLocal('auto')
    } catch (err) {
      setParseError(traduzirErro(err))
    } finally {
      setParsing(false)
    }
  }

  // Troca de mapeamento salvo no Passo 2
  const handleSwitchSavedMapping = (mappingId: string) => {
    setSelectedMappingIdLocal(mappingId)
    if (!parsedData) return

    if (mappingId === 'auto') {
      const detected = autoDetectMappingHoras(parsedData.headers)
      setMapping({ ...EMPTY_MAPPING_HORAS, ...detected })
      setAutoDetectedMessage(null)
      setSaveMapping(true)
    } else {
      const target = savedMappings.find((m) => m.id === mappingId)
      if (target) {
        applySavedMapping(target, false)
      }
    }
  }

  // Validação do Passo 2: ticket, tempo e cliente devem estar mapeados
  const isRequiredMapped = useMemo(() => {
    return Boolean(mapping.cliente && mapping.tempo_lancamento && mapping.numero_ticket)
  }, [mapping])

  // Analisa colunas mapeadas vazias para alertar o usuário no preview
  const emptyMappedWarnings = useMemo(() => {
    if (!parsedData || !parsedData.rows.length) return []
    const sampleRows = parsedData.rows.slice(0, 50)
    const sampleSize = sampleRows.length
    const warnings: Array<{
      key: CampoHoraKey
      label: string
      column: string
      filled: number
      total: number
    }> = []

    CAMPOS_HORAS.forEach((key) => {
      const col = mapping[key]
      if (!col) return
      let filled = 0
      sampleRows.forEach((row) => {
        const val = row[col]
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          filled++
        }
      })
      if (filled === 0) {
        warnings.push({
          key,
          label: LABELS_CAMPOS_HORAS[key],
          column: col,
          filled,
          total: sampleSize,
        })
      }
    })

    return warnings
  }, [parsedData, mapping])

  // Prévia das linhas que serão importadas vs ignoradas (status)
  const statusPreview = useMemo(() => {
    if (!parsedData || !mapping.status || !parsedData.rows.length) {
      return { total: parsedData?.rows.length ?? 0, resolvidas: 0, outras: 0 }
    }
    let resolvidas = 0
    for (const row of parsedData.rows) {
      if (isStatusResolvido(row[mapping.status])) resolvidas++
    }
    return {
      total: parsedData.rows.length,
      resolvidas,
      outras: parsedData.rows.length - resolvidas,
    }
  }, [parsedData, mapping])

  // Executa a importação no Passo 3
  const handleExecuteImport = async () => {
    if (!file || !parsedData) return

    setImporting(true)
    setImportProgress({ inserted: 0, total: parsedData.rows.length })

    try {
      const validRows: TimeLogInsert[] = []
      const detalhes: Array<{ linha: number; motivo: string }> = []
      let ignoradasStatus = 0

      parsedData.rows.forEach((row, index) => {
        const linhaNum = index + 2 // linha 1 é o cabeçalho no Excel

        // Status: se mapeado, precisa ser resolvido/fechado
        if (mapping.status) {
          const rawStatus = row[mapping.status]
          const statusTxt =
            rawStatus !== null && rawStatus !== undefined ? String(rawStatus).trim() : ''
          if (statusTxt && !isStatusResolvido(statusTxt)) {
            ignoradasStatus++
            detalhes.push({
              linha: linhaNum,
              motivo: `Status "${statusTxt}" não é resolvido/fechado — lançamento ignorado`,
            })
            return
          }
        }

        const rawCliente = row[mapping.cliente]
        const cliente =
          rawCliente !== null && rawCliente !== undefined ? String(rawCliente).trim() : ''

        const rawTecnico = mapping.tecnico ? row[mapping.tecnico] : null
        const tecnico =
          rawTecnico !== null && rawTecnico !== undefined ? String(rawTecnico).trim() : ''

        const rawTicket = row[mapping.numero_ticket]
        const numeroTicket =
          rawTicket !== null && rawTicket !== undefined ? String(rawTicket).trim() : ''

        const rawData = mapping.data_lancamento ? row[mapping.data_lancamento] : null
        const dataLancamento = mapping.data_lancamento ? parseDateToISO(rawData) : null

        const rawTempo = mapping.tempo_lancamento ? row[mapping.tempo_lancamento] : null
        const horas = parseValorHoras(rawTempo)
        const minutos = horas !== null ? Math.round(horas * 60) : null

        // Valida campos obrigatórios
        if (!cliente) {
          detalhes.push({ linha: linhaNum, motivo: 'Cliente vazio ou ausente' })
          return
        }
        if (minutos === null || minutos <= 0) {
          detalhes.push({
            linha: linhaNum,
            motivo: `Tempo inválido ou zerado ("${String(rawTempo ?? '').trim()}")`,
          })
          return
        }
        if (!numeroTicket) {
          detalhes.push({ linha: linhaNum, motivo: 'Número do ticket vazio ou ausente' })
          return
        }

        // Opcionais
        let departamento: string | null = null
        if (mapping.departamento) {
          const val = String(row[mapping.departamento] ?? '').trim()
          departamento = val || null
        }

        let statusFinal: string | null = null
        if (mapping.status) {
          const val = String(row[mapping.status] ?? '').trim()
          statusFinal = val || null
        }

        let horasTotalChamado: number | null = null
        let ehTotalChamado = false
        if (mapping.tempo_total_chamado) {
          const horasTotal = parseValorHoras(row[mapping.tempo_total_chamado])
          if (horasTotal !== null) {
            horasTotalChamado = horasTotal
            // Movidesk: a linha de total repete o tempo total do chamado —
            // consideramos "total" quando os dois valores batem.
            ehTotalChamado = Math.abs(horasTotal - horas!) < 0.005
          }
        }

        validRows.push({
          import_id: '', // preenchido pelo insertTimeLogsBatch
          numero_ticket: numeroTicket,
          cliente,
          tecnico: tecnico || null,
          departamento,
          data_lancamento: dataLancamento,
          minutos,
          horas_total_chamado: horasTotalChamado,
          eh_total_chamado: ehTotalChamado,
          status: statusFinal,
          extras: {},
        })
      })

      const totalLinhas = parsedData.rows.length
      const erros = detalhes.length - ignoradasStatus
      const importadas = validRows.length
      const ignoradas = ignoradasStatus
      const status = erros > 0 ? 'com erros' : 'concluído'

      // 1. Criar registro de import (tipo "horas")
      const createdImport = await createImportRecord({
        nome_arquivo: file.name,
        total_linhas: totalLinhas,
        importadas,
        ignoradas,
        erros,
        status,
        tipo: 'horas',
        mapeamento_nome: mappingName || null,
        detalhes_erro: detalhes.length > 0 ? detalhes : null,
      })

      // 2. Inserir lançamentos de horas com o import_id
      if (validRows.length > 0) {
        await insertTimeLogsBatch(validRows, createdImport.id, (inserted, total) => {
          setImportProgress({ inserted, total })
        })
      }

      // 3. Se marcou para salvar mapeamento, upsert
      if (saveMapping && mappingName.trim()) {
        try {
          await upsertMapeamentoHoras({
            nome: mappingName.trim(),
            mapeamento: mapping,
          })
        } catch (mapErr) {
          console.error('Erro ao salvar mapeamento:', mapErr)
        }
      }

      setImportResult({
        importId: createdImport.id,
        totalLinhas,
        inseridas: importadas,
        ignoradasStatus,
        erros,
        detalhes,
      })
    } catch (err) {
      console.error('Erro ao executar importação de horas:', err)
      setParseError(traduzirErro(err))
    } finally {
      setImporting(false)
    }
  }

  // Reset quando troca de arquivo
  const resetWizard = () => {
    setFile(null)
    setParsedData(null)
    setParseError(null)
    setCurrentStep(1)
    setImportResult(null)
  }

  const stepTitles = [
    { step: 1 as const, title: '1. Enviar arquivo' },
    { step: 2 as const, title: '2. Mapear colunas' },
    { step: 3 as const, title: '3. Revisar e importar' },
  ]

  return (
    <div className="space-y-6">
      {parseError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erro na importação de horas</p>
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{parseError}</p>
          </div>
        </div>
      )}

      {/* INDICADOR DE PASSOS */}
      <div className="mb-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 w-full z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-teal-600 transition-all duration-300 z-0"
            style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
          />
          {stepTitles.map((s) => {
            const active = currentStep === s.step
            const completed = currentStep > s.step || importResult !== null
            return (
              <div key={s.step} className="flex flex-col items-center relative z-10 bg-white px-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    completed
                      ? 'bg-teal-600 text-white ring-4 ring-teal-50'
                      : active
                        ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {completed ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                </div>
                <span
                  className={`text-xs mt-1.5 font-semibold whitespace-nowrap ${
                    active ? 'text-teal-700' : 'text-slate-500'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================
          PASSO 1: ENVIAR ARQUIVO
         ======================================================== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-teal-500 bg-[#F0FDFA] scale-[1.01]'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0])
                  }
                }}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                {parsing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>

              <h3 className="text-base font-bold text-slate-800">
                {parsing
                  ? 'Processando planilha...'
                  : 'Arraste a planilha de horas aqui ou clique para selecionar'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Formatos aceitos:{' '}
                <strong className="font-semibold text-slate-700">.xlsx, .xls ou .csv</strong>{' '}
                (relatório "Tempo trabalhado nos tickets" do Movidesk)
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl border border-teal-200 bg-teal-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB • {parsedData?.totalRows || 0} linhas de
                    dados
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={resetWizard}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Trocar arquivo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PASSO 2: MAPEAR COLUNAS
         ======================================================== */}
      {currentStep === 2 && parsedData && (
        <div className="space-y-6">
          {autoDetectedMessage && (
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-semibold">{autoDetectedMessage}</span>
              </div>
            </div>
          )}

          {/* Dropdown de abas (se houver múltiplas) */}
          {parsedData.sheetNames.length > 1 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Layers className="w-4 h-4 text-slate-500" />
              <Label
                htmlFor="sheetSelectHoras"
                className="text-xs font-semibold text-slate-700 whitespace-nowrap"
              >
                Aba da planilha:
              </Label>
              <select
                id="sheetSelectHoras"
                value={parsedData.selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white px-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {parsedData.sheetNames.map((sheet) => (
                  <option key={sheet} value={sheet}>
                    {sheet}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alternar entre layouts salvos ou auto-detecção */}
          {savedMappings.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-600 font-medium">
                Usar configuração de layout:
              </span>
              <select
                value={selectedMappingIdLocal}
                onChange={(e) => handleSwitchSavedMapping(e.target.value)}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white px-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="auto">Detecção automática (sinônimos)</option>
                {savedMappings.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* PREVIEW DAS 5 PRIMEIRAS LINHAS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Prévia da planilha (primeiras 5 linhas)
              </span>
              <span className="text-xs text-slate-400">
                Total no arquivo: {parsedData.totalRows} linhas
              </span>
            </div>

            {emptyMappedWarnings.length > 0 && (
              <div className="mb-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Atenção: coluna(s) mapeada(s) vazias nas linhas analisadas</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 pl-1">
                  {emptyMappedWarnings.map((w) => (
                    <li key={w.key}>
                      <strong>{w.label}</strong> (coluna "{w.column}"): 0 de {w.total} linhas
                      preenchidas na amostra.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-slate-50/50 max-h-48">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <th className="py-2 px-3 text-slate-400">#</th>
                    {parsedData.headers.map((h, i) => (
                      <th key={i} className="py-2 px-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {parsedData.rows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 whitespace-nowrap">
                      <td className="py-1.5 px-3 font-mono text-slate-400 text-[10px]">
                        {rIdx + 1}
                      </td>
                      {parsedData.headers.map((h, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-1.5 px-3 text-slate-700 max-w-[160px] truncate"
                        >
                          {row[h] !== null && row[h] !== undefined ? String(row[h]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FORMULÁRIO DE MAPEAMENTO */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mapeamento dos Campos
              </span>
              <span className="text-xs text-slate-400">
                <span className="text-rose-500 font-bold">*</span> Obrigatórios
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
              {CAMPOS_HORAS.map((key) => {
                const field = { key, label: LABELS_CAMPOS_HORAS[key] }
                const currentValue = mapping[key] || ''
                const hasMatch = Boolean(currentValue)
                const isRequired =
                  key === 'numero_ticket' || key === 'tempo_lancamento' || key === 'cliente'

                const DESCRIPTIONS: Record<CampoHoraKey, string> = {
                  numero_ticket: 'Número do ticket (chave para cruzar com chamados)',
                  cliente: 'Nome do cliente/organização',
                  tecnico: 'Atendente que lançou o tempo',
                  departamento: 'Departamento/setor responsável',
                  data_lancamento: 'Data em que o tempo foi lançado',
                  tempo_lancamento: 'Tempo do lançamento ("0,71h", "01:30", "45min", decimais)',
                  tempo_total_chamado: 'Tempo total do chamado (coluna de total do Movidesk)',
                  status: 'Status do chamado — só resolvido/fechado é importado',
                }

                return (
                  <div
                    key={key}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-0.5 sm:max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{field.label}</span>
                        {isRequired && (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                            Obrigatório
                          </span>
                        )}
                        {hasMatch && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        {DESCRIPTIONS[key]}
                      </p>
                    </div>

                    <div className="w-full sm:w-64">
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className={`w-full h-9 text-xs rounded-xl px-3 font-medium transition-all ${
                          isRequired && !currentValue
                            ? 'border-rose-300 bg-rose-50/20 text-rose-700 focus:ring-rose-500'
                            : 'border-slate-200 bg-white text-slate-800 focus:ring-teal-500 focus:border-teal-500'
                        }`}
                      >
                        <option value="">
                          {isRequired
                            ? '— Selecione a coluna (obrigatório) —'
                            : '— Não mapear (opcional) —'}
                        </option>
                        {parsedData.headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* PRÉVIA DO FILTRO DE STATUS */}
          {mapping.status && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-slate-600">
                <span className="font-semibold text-slate-800">Filtro de status:</span> apenas
                linhas com status "Resolvido"/"Fechado" serão gravadas.
                {statusPreview.resolvidas + statusPreview.outras > 0 && (
                  <span className="ml-1">
                    Neste arquivo:{' '}
                    <strong className="text-teal-700">{statusPreview.resolvidas}</strong>{' '}
                    resolvidas, <strong className="text-amber-700">{statusPreview.outras}</strong>{' '}
                    serão ignoradas.
                  </span>
                )}
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Se o status ficar sem mapear, TODAS as linhas serão importadas.
                </p>
              </div>
            </div>
          )}

          {/* OPÇÕES DE SALVAR MAPEAMENTO */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mappingNameHoras" className="text-xs font-semibold text-slate-700">
                Nome deste layout / mapeamento
              </Label>
              <Input
                id="mappingNameHoras"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="Ex.: [Horas] Relatório Mensal Padrão"
                className="h-9 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="saveMappingHorasCheckbox"
                checked={saveMapping}
                onCheckedChange={(checked) => setSaveMapping(Boolean(checked))}
                className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
              />
              <Label
                htmlFor="saveMappingHorasCheckbox"
                className="text-xs text-slate-600 font-medium cursor-pointer"
              >
                Salvar este mapeamento para as próximas importações
              </Label>
            </div>
          </div>

          {/* BOTÕES DE NAVEGAÇÃO DO PASSO 2 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              className="text-xs rounded-xl"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar
            </Button>

            <Button
              size="sm"
              disabled={!isRequiredMapped}
              onClick={() => setCurrentStep(3)}
              className="text-xs rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 shadow-sm shadow-teal-600/20"
            >
              <span>Continuar para Revisão</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================
          PASSO 3: REVISAR E IMPORTAR
         ======================================================== */}
      {currentStep === 3 && parsedData && file && (
        <div className="space-y-6">
          {!importResult ? (
            <>
              {/* RESUMO DA IMPORTAÇÃO */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">
                      Arquivo
                    </span>
                    <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">
                      Total de Linhas
                    </span>
                    <p className="text-xs font-bold text-slate-800 font-mono">
                      {parsedData.totalRows} registros
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold uppercase">
                      Mapeamento
                    </span>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {mappingName || 'Padrão'}
                    </p>
                  </div>
                </div>

                {/* CHIPS DOS CAMPOS MAPEADOS */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Campos Mapeados
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CAMPOS_HORAS.map((key) => {
                      const col = mapping[key]
                      const isWarn = emptyMappedWarnings.some((w) => w.key === key)
                      const isRequired =
                        key === 'numero_ticket' || key === 'tempo_lancamento' || key === 'cliente'
                      return (
                        <div
                          key={key}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            isWarn
                              ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                              : col
                                ? 'bg-teal-50/40 border-teal-200 text-teal-900'
                                : isRequired
                                  ? 'bg-rose-50/40 border-rose-200 text-rose-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <span className="font-semibold">{LABELS_CAMPOS_HORAS[key]}:</span>
                          <span className="font-mono text-[11px] truncate max-w-[150px]">
                            {col ? `"${col}"${isWarn ? ' (vazia)' : ''}` : 'Não mapeado'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* REGRAS DE NORMALIZAÇÃO EXPLICADAS */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    Regras da importação de horas:
                  </p>
                  <p>• Tempos aceitos: "0,71h", "01:30", "1h30", "45min" e decimais (horas).</p>
                  <p>• Datas serão convertidas para o formato padrão (ISO YYYY-MM-DD).</p>
                  <p>• Só serão gravadas linhas com status Resolvido/Fechado (quando mapeado).</p>
                  <p>
                    • Linhas sem cliente, sem ticket ou com tempo inválido serão ignoradas e
                    reportadas.
                  </p>
                </div>
              </div>

              {/* BARRA DE PROGRESSO SE ESTIVER IMPORTANDO */}
              {importing && (
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      Gravando lançamentos de horas...
                    </span>
                    <span className="font-mono">
                      {importProgress.inserted} / {importProgress.total}
                    </span>
                  </div>
                  <Progress
                    value={
                      importProgress.total > 0
                        ? Math.round((importProgress.inserted / importProgress.total) * 100)
                        : 0
                    }
                    className="h-2 bg-teal-100"
                  />
                </div>
              )}

              {/* BOTÕES DE AÇÃO DO PASSO 3 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importing}
                  onClick={() => setCurrentStep(2)}
                  className="text-xs rounded-xl"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Voltar e ajustar
                </Button>

                <Button
                  size="sm"
                  disabled={importing || !isAdmin}
                  onClick={handleExecuteImport}
                  title={
                    isAdmin
                      ? undefined
                      : 'Somente administradores podem gravar lançamentos de horas.'
                  }
                  className="text-xs rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2 shadow-md shadow-teal-600/20 px-5"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Importar agora</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* RESULTADO DA IMPORTAÇÃO */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">
                  Importação de horas finalizada!
                </h3>
                <p className="text-xs text-slate-500">
                  Os lançamentos foram gravados na tabela de horas (time_logs).
                </p>
              </div>

              {/* CARDS DE RESUMO DO RESULTADO */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Total Lidas
                  </span>
                  <p className="text-lg font-bold text-slate-800 font-mono">
                    {importResult.totalLinhas}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 uppercase font-semibold">
                    Inseridas
                  </span>
                  <p className="text-lg font-bold text-emerald-700 font-mono">
                    {importResult.inseridas}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-600 uppercase font-semibold">
                    Ignoradas (status)
                  </span>
                  <p className="text-lg font-bold text-amber-700 font-mono">
                    {importResult.ignoradasStatus}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-600 uppercase font-semibold">Erros</span>
                  <p className="text-lg font-bold text-rose-700 font-mono">{importResult.erros}</p>
                </div>
              </div>

              {/* LISTA EXPANSÍVEL DE DETALHES */}
              {importResult.detalhes.length > 0 && (
                <div className="max-w-xl mx-auto text-left">
                  <button
                    type="button"
                    onClick={() => setShowErrorList(!showErrorList)}
                    className="w-full p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between"
                  >
                    <span>
                      Ver detalhes das {importResult.detalhes.length} linhas ignoradas/erro
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showErrorList ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {showErrorList && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto space-y-1.5 text-xs text-slate-600">
                      {importResult.detalhes.map((err, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0 gap-3"
                        >
                          <span className="font-mono font-semibold text-rose-600 whitespace-nowrap">
                            Linha {err.linha}:
                          </span>
                          <span className="text-slate-600 text-right">{err.motivo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
