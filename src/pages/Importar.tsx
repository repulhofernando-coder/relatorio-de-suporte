import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  parseSpreadsheetFile,
  autoDetectMapping,
  parseDateToISO,
  parseTimeToMinutes,
  ParsedSpreadsheet,
} from '@/lib/spreadsheet'
import {
  fetchMapeamentos,
  upsertMapeamento,
  createImportRecord,
  insertSupportRecordsBatch,
} from '@/services/support'
import {
  STANDARD_FIELDS,
  StandardFieldKey,
  MapeamentoRecord,
  SupportRecordInsert,
  normalizeDepartamento,
} from '@/types/support'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Layers,
  Sparkles,
  HelpCircle,
  Check,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

export default function Importar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedMapeamentoId = searchParams.get('mapeamento')

  // Mapeamentos salvos
  const [savedMappings, setSavedMappings] = useState<MapeamentoRecord[]>([])
  const [selectedMappingId, setSelectedMappingId] = useState<string>('auto')

  // Passo do wizard
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Passo 1: Arquivo e Parse
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Passo 2: Mapeamento de Colunas
  const [mapping, setMapping] = useState<Record<StandardFieldKey, string>>({
    cliente: '',
    tecnico: '',
    data_chamado: '',
    tipo_chamado: '',
    tempo_atendimento_min: '',
    prioridade: '',
    observacoes: '',
    aberto_por: '',
    departamento: '',
  })
  const [mappingName, setMappingName] = useState<string>('')
  const [saveMapping, setSaveMapping] = useState<boolean>(true)
  const [autoDetectedMessage, setAutoDetectedMessage] = useState<string | null>(null)

  // Passo 3: Importação e Resultado
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ inserted: number; total: number }>({
    inserted: 0,
    total: 0,
  })
  const [importResult, setImportResult] = useState<{
    importId: string
    totalLinhas: number
    importadas: number
    ignoradas: number
    erros: number
    detalhesErro: Array<{ linha: number; motivo: string }>
  } | null>(null)
  const [showErrorList, setShowErrorList] = useState(false)

  // Carregar mapeamentos salvos
  useEffect(() => {
    fetchMapeamentos()
      .then((data) => {
        setSavedMappings(data)
        if (preselectedMapeamentoId) {
          const match = data.find((m) => m.id === preselectedMapeamentoId)
          if (match) {
            setSelectedMappingId(match.id)
          }
        }
      })
      .catch((err) => console.error('Erro ao buscar mapeamentos:', err))
  }, [preselectedMapeamentoId])

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
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').trim()
      setMappingName(baseName || 'Mapeamento Mensal')

      // Verifica se há match exato com algum mapeamento salvo
      let matchedSavedMapping: MapeamentoRecord | null = null

      // Se já veio com preseleção por query param
      if (selectedMappingId !== 'auto') {
        matchedSavedMapping = savedMappings.find((m) => m.id === selectedMappingId) || null
      }

      if (!matchedSavedMapping) {
        // Tenta encontrar um mapeamento salvo cujas colunas mapeadas batem com os headers
        for (const saved of savedMappings) {
          const mappedCols = Object.values(saved.mapeamento).filter(Boolean)
          if (mappedCols.length >= 3) {
            const allExist = mappedCols.every((col) => data.headers.includes(col))
            if (allExist) {
              matchedSavedMapping = saved
              break
            }
          }
        }
      }

      if (matchedSavedMapping) {
        // Usa o mapeamento salvo
        const newMap: Record<StandardFieldKey, string> = {
          cliente: matchedSavedMapping.mapeamento['cliente'] || '',
          tecnico: matchedSavedMapping.mapeamento['tecnico'] || '',
          data_chamado: matchedSavedMapping.mapeamento['data_chamado'] || '',
          tipo_chamado: matchedSavedMapping.mapeamento['tipo_chamado'] || '',
          tempo_atendimento_min: matchedSavedMapping.mapeamento['tempo_atendimento_min'] || '',
          prioridade: matchedSavedMapping.mapeamento['prioridade'] || '',
          observacoes: matchedSavedMapping.mapeamento['observacoes'] || '',
          aberto_por: matchedSavedMapping.mapeamento['aberto_por'] || '',
          departamento: matchedSavedMapping.mapeamento['departamento'] || '',
        }
        setMapping(newMap)
        setSelectedMappingId(matchedSavedMapping.id)
        setAutoDetectedMessage(`Mapeamento "${matchedSavedMapping.nome}" detectado automaticamente`)
        setSaveMapping(false)
        setCurrentStep(2)
      } else {
        // Executa auto-detecção por sinônimos
        const detected = autoDetectMapping(data.headers)
        setMapping(detected)
        setSelectedMappingId('auto')
        setSaveMapping(true)
        setCurrentStep(2)
      }
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err)
      setParseError(
        err.message ||
          'Erro ao processar o arquivo. Verifique se a planilha é válida e contém dados.',
      )
      setFile(null)
      setParsedData(null)
    } finally {
      setParsing(false)
    }
  }

  // Troca de aba da planilha
  const handleSheetChange = async (sheetName: string) => {
    if (!file) return
    setParsing(true)
    setParseError(null)
    try {
      const data = await parseSpreadsheetFile(file, sheetName)
      setParsedData(data)
      const detected = autoDetectMapping(data.headers)
      setMapping(detected)
    } catch (err: any) {
      setParseError(err.message || 'Erro ao carregar a aba selecionada.')
    } finally {
      setParsing(false)
    }
  }

  // Troca de mapeamento salvo no Passo 2
  const handleSwitchSavedMapping = (mappingId: string) => {
    setSelectedMappingId(mappingId)
    if (!parsedData) return

    if (mappingId === 'auto') {
      const detected = autoDetectMapping(parsedData.headers)
      setMapping(detected)
      setAutoDetectedMessage(null)
      setSaveMapping(true)
    } else {
      const target = savedMappings.find((m) => m.id === mappingId)
      if (target) {
        const newMap: Record<StandardFieldKey, string> = {
          cliente: target.mapeamento['cliente'] || '',
          tecnico: target.mapeamento['tecnico'] || '',
          data_chamado: target.mapeamento['data_chamado'] || '',
          tipo_chamado: target.mapeamento['tipo_chamado'] || '',
          tempo_atendimento_min: target.mapeamento['tempo_atendimento_min'] || '',
          prioridade: target.mapeamento['prioridade'] || '',
          observacoes: target.mapeamento['observacoes'] || '',
          aberto_por: target.mapeamento['aberto_por'] || '',
          departamento: target.mapeamento['departamento'] || '',
        }
        setMapping(newMap)
        setAutoDetectedMessage(`Usando mapeamento salvo: ${target.nome}`)
        setSaveMapping(false)
      }
    }
  }

  // Validação do Passo 2: 3 obrigatórios devem estar mapeados
  const isRequiredMapped = useMemo(() => {
    return Boolean(mapping.cliente && mapping.tecnico && mapping.data_chamado)
  }, [mapping])

  // Executa a importação no Passo 3
  const handleExecuteImport = async () => {
    if (!file || !parsedData) return

    setImporting(true)
    setImportProgress({ inserted: 0, total: parsedData.rows.length })

    try {
      const validRecords: SupportRecordInsert[] = []
      const errorList: Array<{ linha: number; motivo: string }> = []

      parsedData.rows.forEach((row, index) => {
        const linhaNum = index + 2 // linha 1 é o cabeçalho no Excel

        const rawCliente = row[mapping.cliente]
        const cliente =
          rawCliente !== null && rawCliente !== undefined ? String(rawCliente).trim() : ''

        const rawTecnico = row[mapping.tecnico]
        const tecnico =
          rawTecnico !== null && rawTecnico !== undefined ? String(rawTecnico).trim() : ''

        const rawData = row[mapping.data_chamado]
        const dataChamado = parseDateToISO(rawData)

        // Valida campos obrigatórios
        if (!cliente) {
          errorList.push({ linha: linhaNum, motivo: 'Cliente vazio ou ausente' })
          return
        }
        if (!tecnico) {
          errorList.push({ linha: linhaNum, motivo: 'Técnico vazio ou ausente' })
          return
        }
        if (!dataChamado) {
          errorList.push({
            linha: linhaNum,
            motivo: `Data inválida ou não reconhecida ("${rawData ?? ''}")`,
          })
          return
        }

        // Opcionais
        let tipoChamado: string | null = null
        if (mapping.tipo_chamado && row[mapping.tipo_chamado] !== undefined) {
          const val = String(row[mapping.tipo_chamado]).trim()
          tipoChamado = val || null
        }

        let tempoMin: number | null = null
        if (mapping.tempo_atendimento_min && row[mapping.tempo_atendimento_min] !== undefined) {
          tempoMin = parseTimeToMinutes(row[mapping.tempo_atendimento_min])
        }

        let prioridade: string | null = null
        if (mapping.prioridade && row[mapping.prioridade] !== undefined) {
          const val = String(row[mapping.prioridade]).trim()
          prioridade = val || null
        }

        let observacoes: string | null = null
        if (mapping.observacoes && row[mapping.observacoes] !== undefined) {
          const val = String(row[mapping.observacoes]).trim()
          observacoes = val || null
        }

        let abertoPor: string | null = null
        if (mapping.aberto_por && row[mapping.aberto_por] !== undefined) {
          const val = String(row[mapping.aberto_por]).trim()
          abertoPor = val || null
        }

        let departamento: string | null = null
        if (mapping.departamento && row[mapping.departamento] !== undefined) {
          const val = String(row[mapping.departamento]).trim()
          departamento = normalizeDepartamento(val)
        }

        validRecords.push({
          cliente,
          tecnico,
          data_chamado: dataChamado,
          tipo_chamado: tipoChamado,
          tempo_atendimento_min: tempoMin,
          prioridade,
          observacoes,
          aberto_por: abertoPor,
          departamento,
          origem_arquivo: file.name,
        })
      })

      const totalLinhas = parsedData.rows.length
      const importadas = validRecords.length
      const erros = errorList.length
      const ignoradas = erros
      const status = erros > 0 ? 'com erros' : 'concluído'

      // 1. Criar registro de import
      const createdImport = await createImportRecord({
        nome_arquivo: file.name,
        total_linhas: totalLinhas,
        importadas,
        ignoradas,
        erros,
        status,
        mapeamento_nome: mappingName || null,
        detalhes_erro: errorList.length > 0 ? errorList : null,
      })

      // 2. Inserir registros de suporte com o import_id
      if (validRecords.length > 0) {
        const recordsWithImportId = validRecords.map((r) => ({
          ...r,
          import_id: createdImport.id,
        }))

        await insertSupportRecordsBatch(recordsWithImportId, (inserted, total) => {
          setImportProgress({ inserted, total })
        })
      }

      // 3. Se marcou para salvar mapeamento, upsert
      if (saveMapping && mappingName.trim()) {
        try {
          await upsertMapeamento({
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
        importadas,
        ignoradas,
        erros,
        detalhesErro: errorList,
      })
    } catch (err: any) {
      console.error('Erro ao executar importação:', err)
      setParseError(err.message || 'Erro durante a importação.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Importar Planilha
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Envie o relatório de atendimentos mensal em Excel ou CSV e mapeie as colunas para o banco
          de dados.
        </p>
      </div>

      {/* CARD DO WIZARD */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        {/* INDICADOR DE PASSOS */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 w-full z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-teal-600 transition-all duration-300 z-0"
              style={{
                width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
              }}
            />

            {[
              { step: 1, title: '1. Enviar arquivo' },
              { step: 2, title: '2. Mapear colunas' },
              { step: 3, title: '3. Revisar e importar' },
            ].map((s) => {
              const active = currentStep === s.step
              const completed = currentStep > s.step || importResult !== null

              return (
                <div
                  key={s.step}
                  className="flex flex-col items-center relative z-10 bg-white px-2"
                >
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

        {parseError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Erro ao processar planilha</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{parseError}</p>
            </div>
          </div>
        )}

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
                    : 'Arraste a planilha aqui ou clique para selecionar'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Formatos aceitos:{' '}
                  <strong className="font-semibold text-slate-700">.xlsx, .xls ou .csv</strong>{' '}
                  (qualquer layout com cabeçalho na primeira linha)
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
                  onClick={() => {
                    setFile(null)
                    setParsedData(null)
                    setParseError(null)
                  }}
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
            {/* Mensagem de auto-detecção ou mapeamento salvo */}
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
                  htmlFor="sheetSelect"
                  className="text-xs font-semibold text-slate-700 whitespace-nowrap"
                >
                  Aba da planilha:
                </Label>
                <select
                  id="sheetSelect"
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
                  value={selectedMappingId}
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
                {STANDARD_FIELDS.map((field) => {
                  const currentValue = mapping[field.key] || ''
                  const hasMatch = Boolean(currentValue)

                  return (
                    <div
                      key={field.key}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-0.5 sm:max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{field.label}</span>
                          {field.required && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded">
                              Obrigatório
                            </span>
                          )}
                          {hasMatch && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {field.description}
                        </p>
                      </div>

                      <div className="w-full sm:w-64">
                        <select
                          value={currentValue}
                          onChange={(e) =>
                            setMapping((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className={`w-full h-9 text-xs rounded-xl px-3 font-medium transition-all ${
                            field.required && !currentValue
                              ? 'border-rose-300 bg-rose-50/20 text-rose-700 focus:ring-rose-500'
                              : 'border-slate-200 bg-white text-slate-800 focus:ring-teal-500 focus:border-teal-500'
                          }`}
                        >
                          <option value="">
                            {field.required
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

            {/* OPÇÕES DE SALVAR MAPEAMENTO */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mappingName" className="text-xs font-semibold text-slate-700">
                  Nome deste layout / mapeamento
                </Label>
                <Input
                  id="mappingName"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="Ex.: Relatório Mensal Padrão"
                  className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="saveMappingCheckbox"
                  checked={saveMapping}
                  onCheckedChange={(checked) => setSaveMapping(Boolean(checked))}
                  className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                />
                <Label
                  htmlFor="saveMappingCheckbox"
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
                      {STANDARD_FIELDS.map((f) => {
                        const col = mapping[f.key]
                        return (
                          <div
                            key={f.key}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                              col
                                ? 'bg-teal-50/40 border-teal-200 text-teal-900'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <span className="font-semibold">{f.label}:</span>
                            <span className="font-mono text-[11px] truncate max-w-[150px]">
                              {col ? `"${col}"` : 'Não mapeado'}
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
                      Regras de normalização automática:
                    </p>
                    <p>• Datas serão convertidas para formato padrão (ISO YYYY-MM-DD).</p>
                    <p>
                      • Tempo de atendimento aceita minutos puros, decimais ou formatos como "1h30"
                      e "45min".
                    </p>
                    <p>
                      • Linhas com cliente, técnico ou data vazios/inválidos serão puladas e
                      reportadas.
                    </p>
                    <p>
                      • Departamento será normalizado para os setores fixos (Windows, Campo, Windows
                      N2, Ativação, Projetos); valores fora da lista são mantidos como vieram.
                    </p>
                  </div>
                </div>

                {/* BARRA DE PROGRESSO SE ESTIVER IMPORTANDO */}
                {importing && (
                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                        Gravando registros no Supabase...
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
                    disabled={importing}
                    onClick={handleExecuteImport}
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
              /* ========================================================
                 RESULTADO DA IMPORTAÇÃO (SUCESSO)
                 ======================================================== */
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">Importação finalizada!</h3>
                  <p className="text-xs text-slate-500">
                    Os dados foram processados e vinculados com sucesso à sua conta.
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
                      Importadas
                    </span>
                    <p className="text-lg font-bold text-emerald-700 font-mono">
                      {importResult.importadas}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-600 uppercase font-semibold">
                      Ignoradas
                    </span>
                    <p className="text-lg font-bold text-amber-700 font-mono">
                      {importResult.ignoradas}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] text-rose-600 uppercase font-semibold">Erros</span>
                    <p className="text-lg font-bold text-rose-700 font-mono">
                      {importResult.erros}
                    </p>
                  </div>
                </div>

                {/* LISTA EXPANSÍVEL DE ERROS */}
                {importResult.detalhesErro && importResult.detalhesErro.length > 0 && (
                  <div className="max-w-xl mx-auto text-left">
                    <button
                      type="button"
                      onClick={() => setShowErrorList(!showErrorList)}
                      className="w-full p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between"
                    >
                      <span>
                        Ver detalhes das {importResult.detalhesErro.length} linhas ignoradas
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${showErrorList ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showErrorList && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto space-y-1.5 text-xs text-slate-600">
                        {importResult.detalhesErro.map((err, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1 border-b border-slate-100 last:border-b-0"
                          >
                            <span className="font-mono font-semibold text-rose-600">
                              Linha {err.linha}:
                            </span>
                            <span className="text-slate-600">{err.motivo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* BOTÕES DE REDIRECIONAMENTO */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                  <Button
                    size="sm"
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 gap-2 shadow-sm"
                  >
                    <span>Ver no dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/importacoes')}
                    className="w-full sm:w-auto h-10 rounded-xl text-slate-700 px-6"
                  >
                    Ver histórico de importações
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
