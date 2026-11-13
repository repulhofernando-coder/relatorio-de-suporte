import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseSpreadsheetFile, parseDateToISO, ParsedSpreadsheet } from '@/lib/spreadsheet'
import {
  autoDetectMappingSatisfacao,
  parseNotaSatisfacao,
  sugestaoColunaSatisfacao,
} from '@/lib/satisfacao-spreadsheet'
import { insertSatisfacaoBatch, fetchTicketsJaImportados } from '@/services/satisfacao'
import { consolidarRespostasPorTicket } from '@/lib/satisfacao-dedup'
import { upsertMapeamento, createImportRecord } from '@/services/support'
import type { MapeamentoRecord } from '@/types/support'
import {
  CAMPOS_SATISFACAO,
  CampoSatisfacaoKey,
  LABELS_CAMPOS_SATISFACAO,
  MappingSatisfacao,
  emojiNota,
  rotuloNota,
} from '@/types/satisfacao'
import { traduzirErro } from '@/lib/erros'
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronDown,
  Layers,
  Sparkles,
  HelpCircle,
  Check,
  Smile,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

const EMPTY_MAPPING_SATISFACAO: Record<CampoSatisfacaoKey, string> = {
  numero_ticket: '',
  cliente: '',
  tecnico: '',
  departamento: '',
  data_resposta: '',
  resposta_satisfacao: '',
  comentario: '',
}

const SINONIMOS_SATISFACAO = {
  numero_ticket: ['tíquete', 'ticket', 'chamado', 'número do chamado', 'número'],
  cliente: ['cliente', 'organização', 'empresa'],
  tecnico: ['atendente', 'técnico', 'responsável'],
  departamento: ['departamento', 'setor', 'área'],
  data_resposta: ['data da resposta', 'data', 'data de finalização'],
  resposta_satisfacao: ['satisfação', 'avaliação', 'nota'],
  comentario: ['comentário', 'feedback', 'sugestão'],
}

interface SatisfacaoWizardProps {
  savedMappings: MapeamentoRecord[]
}

/**
 * Wizard de importação de "Satisfação" (pesquisa Movidesk). Mesmo fluxo de 3
 * passos do wizard de Horas: arquivo → mapeamento memorizado → importar.
 * Mapeamentos salvos usam o prefixo "[Satisfação]" no nome.
 * Tipo de importação registrado na tabela imports: "satisfacao".
 */
export default function SatisfacaoWizard({ savedMappings }: SatisfacaoWizardProps) {
  const navigate = useNavigate()

  // Passo do wizard
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Passo 1: Arquivo e Parse
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedSpreadsheet | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Passo 2: Mapeamento
  const [mapping, setMapping] = useState<Record<CampoSatisfacaoKey, string>>({
    ...EMPTY_MAPPING_SATISFACAO,
  })
  const [mappingName, setMappingName] = useState<string>('')
  const [saveMapping, setSaveMapping] = useState<boolean>(true)
  const [autoDetectedMessage, setAutoDetectedMessage] = useState<string | null>(null)
  const [selectedMappingId, setSelectedMappingId] = useState<string>('auto')

  // Passo 3: Importação e Resultado
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ inserted: number; total: number }>({
    inserted: 0,
    total: 0,
  })
  const [importResult, setImportResult] = useState<{
    totalLinhas: number
    importadas: number
    ignoradas: number
    detalhesErro: Array<{ linha: number; motivo: string }>
    ticketsJaImportados: string[]
    linhasMescladas: number
  } | null>(null)
  const [showErrorList, setShowErrorList] = useState(false)

  const savedMappingsSatisfacao = useMemo(
    () => savedMappings.filter((m) => m.nome.startsWith('[Satisfação]')),
    [savedMappings],
  )

  useEffect(() => {
    // Mapeamentos são carregados pelo pai (Importar.tsx) — nada a fazer aqui.
  }, [])

  const handleFileSelect = async (selectedFile: File) => {
    setParseError(null)
    setAutoDetectedMessage(null)

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

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').trim()
      setMappingName(baseName ? `[Satisfação] ${baseName}` : '[Satisfação] Pesquisa')

      // Mapeamento salvo cujas colunas batem com os headers desta planilha
      let matchedSavedMapping: MapeamentoRecord | null = null
      for (const saved of savedMappingsSatisfacao) {
        const mappedCols = Object.values(saved.mapeamento).filter(Boolean)
        if (mappedCols.length >= 2) {
          const allExist = mappedCols.every((col) => data.headers.includes(col))
          if (allExist) {
            matchedSavedMapping = saved
            break
          }
        }
      }

      if (matchedSavedMapping) {
        const newMap: Record<CampoSatisfacaoKey, string> = { ...EMPTY_MAPPING_SATISFACAO }
        for (const key of Object.keys(EMPTY_MAPPING_SATISFACAO) as CampoSatisfacaoKey[]) {
          newMap[key] = (matchedSavedMapping!.mapeamento as Record<string, string>)[key] || ''
        }
        setMapping(newMap)
        setSelectedMappingId(matchedSavedMapping.id)
        setAutoDetectedMessage(`Mapeamento "${matchedSavedMapping.nome}" detectado automaticamente`)
        setSaveMapping(false)
        setCurrentStep(2)
      } else {
        const detected = autoDetectMappingSatisfacao(data.headers)
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

  const handleSwitchSavedMapping = (mappingId: string) => {
    setSelectedMappingId(mappingId)
    if (!parsedData) return
    if (mappingId === 'auto') {
      const detected = autoDetectMappingSatisfacao(parsedData.headers)
      setMapping(detected)
      setAutoDetectedMessage(null)
      setSaveMapping(true)
    } else {
      const target = savedMappingsSatisfacao.find((m) => m.id === mappingId)
      if (target) {
        const newMap: Record<CampoSatisfacaoKey, string> = { ...EMPTY_MAPPING_SATISFACAO }
        for (const key of Object.keys(EMPTY_MAPPING_SATISFACAO) as CampoSatisfacaoKey[]) {
          newMap[key] = (target.mapeamento as Record<string, string>)[key] || ''
        }
        setMapping(newMap)
        setAutoDetectedMessage(`Usando mapeamento salvo: ${target.nome}`)
        setSaveMapping(false)
      }
    }
  }

  // Campos obrigatórios: resposta de satisfação + (tíquete OU cliente) — o
  // cruzamento com chamados precisa do tíquete, mas a resposta em si vale sozinha.
  const isRequiredMapped = useMemo(() => {
    return Boolean(
      mapping.resposta_satisfacao && (mapping.numero_ticket || mapping.cliente || mapping.tecnico),
    )
  }, [mapping])

  const linhasValidas = useMemo(() => {
    if (!parsedData) return []
    return parsedData.rows.map((row, index) => {
      const linhaNum = index + 2
      const rawNota = mapping.resposta_satisfacao ? row[mapping.resposta_satisfacao] : null
      const nota = parseNotaSatisfacao(rawNota)
      return { linhaNum, rawNota, nota, row }
    })
  }, [parsedData, mapping])

  const totalIgnoradas = linhasValidas.filter((l) => l.nota === null).length

  // Diagnóstico do passo 3: quando NENHUMA nota é reconhecida, revela os
  // valores brutos distintos da coluna mapeada como resposta de satisfação e,
  // se for o caso, sugere a coluna alternativa que "parece" conter as respostas.
  const diagnosticoSatisfacao = useMemo(() => {
    const todasNull =
      parsedData && parsedData.rows.length > 0 && linhasValidas.every((l) => l.nota === null)
    if (!parsedData || !todasNull) return null

    const col = mapping.resposta_satisfacao
    const contagem = new Map<string, number>()
    for (const row of parsedData.rows) {
      const raw = col ? row[col] : null
      const chave =
        raw === null || raw === undefined || String(raw).trim() === '' ? '(vazio)' : String(raw)
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    }
    const valoresBrutos = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    const colunaVazia = contagem.size === 1 && contagem.has('(vazio)')
    const colunaSugerida =
      colunaVazia || !col ? sugestaoColunaSatisfacao(parsedData, col || undefined) : null
    return { valoresBrutos, colunaVazia, colunaSugerida, colSemColuna: !col }
  }, [parsedData, linhasValidas, mapping.resposta_satisfacao])

  const handleExecuteImport = async () => {
    if (!file || !parsedData) return

    setImporting(true)
    setImportProgress({ inserted: 0, total: parsedData.rows.length })

    try {
      const validRows: import('@/types/satisfacao').SatisfactionInsert[] = []
      const errorList: Array<{ linha: number; motivo: string }> = []

      for (const l of linhasValidas) {
        const { linhaNum, rawNota, nota, row } = l
        if (nota === null) {
          errorList.push({
            linha: linhaNum,
            motivo: `Sem resposta de satisfação reconhecível ("${String(rawNota ?? '').trim()}") — fora da escala 😀/🙂/😠`,
          })
          continue
        }

        const numeroTicket = mapping.numero_ticket
          ? String(row[mapping.numero_ticket] ?? '').trim() || null
          : null
        const cliente = mapping.cliente ? String(row[mapping.cliente] ?? '').trim() || null : null
        const tecnico = mapping.tecnico ? String(row[mapping.tecnico] ?? '').trim() || null : null
        const departamento = mapping.departamento
          ? String(row[mapping.departamento] ?? '').trim() || null
          : null
        const comentario = mapping.comentario
          ? String(row[mapping.comentario] ?? '').trim() || null
          : null
        const dataResposta = mapping.data_resposta
          ? parseDateToISO(row[mapping.data_resposta])
          : null

        if (!numeroTicket && !cliente && !tecnico) {
          errorList.push({
            linha: linhaNum,
            motivo: 'Linha sem tíquete, cliente nem técnico — impossível contextualizar a nota',
          })
          continue
        }

        validRows.push({
          numero_ticket: numeroTicket,
          nota,
          comentario,
          tecnico,
          cliente,
          departamento,
          data_resposta: dataResposta,
          origem_arquivo: file.name,
        })
      }

      // Ignora tíquetes já importados e une as linhas do mesmo tíquete (1 tíquete = 1 avaliação)
      const jaImportados = await fetchTicketsJaImportados()
      const consolidacao = consolidarRespostasPorTicket(validRows, jaImportados)

      const totalLinhas = parsedData.rows.length
      const importadas = consolidacao.consolidadas.length
      const ignoradas = errorList.length

      // 1. Criar registro de import (tipo "satisfacao")
      const createdImport = await createImportRecord({
        nome_arquivo: file.name,
        total_linhas: totalLinhas,
        importadas,
        ignoradas,
        erros: ignoradas,
        status: ignoradas > 0 ? 'com erros' : 'concluído',
        mapeamento_nome: mappingName || null,
        detalhes_erro: errorList.length > 0 ? errorList : null,
        tipo: 'satisfacao',
      })

      // 2. Inserir respostas
      if (consolidacao.consolidadas.length > 0) {
        await insertSatisfacaoBatch(
          consolidacao.consolidadas,
          createdImport.id,
          (inserted, total) => {
            setImportProgress({ inserted, total })
          },
        )
      }

      // 3. Salvar mapeamento (prefixo [Satisfação])
      if (saveMapping && mappingName.trim()) {
        try {
          await upsertMapeamento({
            nome: mappingName.trim(),
            mapeamento: mapping,
          })
        } catch (mapErr) {
          console.error('Erro ao salvar mapeamento de satisfação:', mapErr)
        }
      }

      setImportResult({
        totalLinhas,
        importadas,
        ignoradas,
        detalhesErro: errorList,
        ticketsJaImportados: consolidacao.ticketsJaImportados,
        linhasMescladas: consolidacao.linhasMescladas,
      })
      setCurrentStep(3)
    } catch (err: any) {
      console.error('Erro ao executar importação de satisfação:', err)
      setParseError(traduzirErro(err))
      setCurrentStep(3)
    } finally {
      setImporting(false)
    }
  }

  return (
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

      {/* PASSO 1 — ARQUIVO */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0])
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
                e.target.value = ''
              }}
            />
            <UploadCloud className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <p className="text-sm font-semibold text-slate-700">
              Arraste o relatório de satisfação do Movidesk ou clique para selecionar
            </p>
            <p className="text-xs text-slate-400 mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
            {file && <p className="text-xs text-teal-700 mt-3 font-medium">Arquivo: {file.name}</p>}
          </div>

          {parsing && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Lendo planilha…
            </div>
          )}
          {parseError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {parseError}
            </div>
          )}
        </div>
      )}

      {/* PASSO 2 — MAPEAMENTO */}
      {currentStep === 2 && parsedData && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Smile className="w-5 h-5 text-teal-600" /> Mapear colunas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {parsedData.rows.length} linhas · {parsedData.headers.length} colunas detectadas
              </p>
            </div>
            {savedMappingsSatisfacao.length > 0 && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedMappingId}
                  onChange={(e) => handleSwitchSavedMapping(e.target.value)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="auto">Detecção automática</option>
                  {savedMappingsSatisfacao.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {autoDetectedMessage && (
            <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-xl p-3 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" /> {autoDetectedMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAMPOS_SATISFACAO.map((campo) => (
              <div key={campo} className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  {LABELS_CAMPOS_SATISFACAO[campo]}
                  {campo === 'resposta_satisfacao' && <span className="text-rose-600"> *</span>}
                </Label>
                <select
                  value={mapping[campo]}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [campo]: e.target.value }))}
                  className="text-sm w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">— Não mapear —</option>
                  {parsedData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {mapping[campo] && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Exemplo:{' '}
                    {campo === 'resposta_satisfacao'
                      ? '😀 / 🙂 / carinha brava / "Muito satisfeito"'
                      : (() => {
                          const v = parsedData.rows[0]?.[mapping[campo]]
                          const s = v === null || v === undefined ? '' : String(v).trim()
                          return s ? s.slice(0, 60) : 'coluna vazia nas primeiras linhas'
                        })()}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Contagem de linhas sem nota */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>{totalIgnoradas}</strong>{' '}
              {totalIgnoradas === 1 ? 'linha será ignorada' : 'linhas serão ignoradas'} por não ter
              resposta de satisfação reconhecível (emoji 😀/🙂/carinha brava ou texto "Muito
              satisfeito"/"Satisfeito"/"Insatisfeito"). O motivo aparece no resultado da importação.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="save-mapping-satisfacao"
              checked={saveMapping}
              onCheckedChange={(v) => setSaveMapping(v === true)}
            />
            <Label
              htmlFor="save-mapping-satisfacao"
              className="text-xs font-medium text-slate-600 cursor-pointer"
            >
              Salvar este mapeamento para as próximas importações
            </Label>
            <Input
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="Nome do mapeamento"
              className="h-9 text-xs flex-1 min-w-[160px]"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button
              onClick={() => setCurrentStep(3)}
              disabled={!isRequiredMapped}
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              Revisar <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3 — REVISÃO E IMPORTAÇÃO */}
      {currentStep === 3 && parsedData && (
        <div className="space-y-5">
          {!importResult ? (
            <>
              <h2 className="text-base font-bold text-slate-900">Revisar e importar</h2>
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {CAMPOS_SATISFACAO.filter((c) => mapping[c]).map((c) => (
                        <th
                          key={c}
                          className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap"
                        >
                          {LABELS_CAMPOS_SATISFACAO[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasValidas.slice(0, 5).map((l, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {CAMPOS_SATISFACAO.filter((c) => mapping[c]).map((c) => (
                          <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                            {c === 'resposta_satisfacao' && l.nota !== null
                              ? `${emojiNota(l.nota)} (${rotuloNota(l.nota)})`
                              : c === 'resposta_satisfacao'
                                ? '⚠ não reconhecida'
                                : String(l.row[mapping[c]] ?? '').trim() || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {diagnosticoSatisfacao && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div className="space-y-1">
                      <p className="font-bold">Nenhuma resposta de satisfação foi reconhecida.</p>
                      <p>
                        Verifique se a coluna correta foi mapeada e veja abaixo os valores
                        encontrados.
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1.5">
                      Valores encontrados na coluna{' '}
                      <span className="font-mono">
                        “{mapping.resposta_satisfacao || '(coluna não mapeada)'}”
                      </span>
                      :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {diagnosticoSatisfacao.valoresBrutos.map(([valor, qtd]) => (
                        <span
                          key={valor}
                          className="inline-flex items-center gap-1 bg-white border border-amber-200 rounded-md px-2 py-0.5 text-xs text-slate-700"
                        >
                          <span className="font-mono">“{valor}”</span>
                          <span className="text-amber-700 font-semibold">×{qtd}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {diagnosticoSatisfacao.colunaSugerida && (
                    <div className="flex items-start gap-2 bg-white border border-amber-200 rounded-lg p-2.5 text-xs">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <p>
                        A coluna <strong>“{diagnosticoSatisfacao.colunaSugerida}”</strong> parece
                        conter as respostas de satisfação — volte ao passo de mapeamento e
                        selecione-a.
                      </p>
                    </div>
                  )}

                  {diagnosticoSatisfacao.colunaVazia && !diagnosticoSatisfacao.colunaSugerida && (
                    <div className="flex items-start gap-2 bg-white border border-amber-200 rounded-lg p-2.5 text-xs">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <p>
                        As carinhas podem ter sido exportadas como imagem pelo Movidesk. Reexporte o
                        relatório em formato que traga as respostas como texto (ex.: 'Muito
                        satisfeito') e tente novamente.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <Progress
                    value={
                      importProgress.total > 0
                        ? (importProgress.inserted / importProgress.total) * 100
                        : 0
                    }
                  />
                  <p className="text-xs text-slate-500 text-center">
                    Importando… {importProgress.inserted}/{importProgress.total} respostas
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={importing}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={importing || linhasValidas.every((l) => l.nota === null)}
                  className="gap-2 bg-teal-600 hover:bg-teal-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Importando…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirmar importação
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Importação concluída!</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    {importResult.importadas} de {importResult.totalLinhas} linhas importadas
                    {importResult.ignoradas > 0
                      ? ` · ${importResult.ignoradas} ignoradas (sem resposta reconhecível)`
                      : ''}
                  </p>
                </div>
              </div>

              {importResult.ticketsJaImportados.length > 0 && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900">
                  <p className="font-semibold">
                    {importResult.ticketsJaImportados.length}{' '}
                    {importResult.ticketsJaImportados.length === 1
                      ? 'tíquete já importado foi ignorado'
                      : 'tíquetes já importados foram ignorados'}{' '}
                    (não duplicados):
                  </p>
                  <p className="font-mono mt-1 break-words">
                    {importResult.ticketsJaImportados.join(', ')}
                  </p>
                </div>
              )}

              {importResult.linhasMescladas > 0 && (
                <p className="text-xs text-slate-500">
                  {importResult.linhasMescladas}{' '}
                  {importResult.linhasMescladas === 1
                    ? 'linha do mesmo tíquete foi unida'
                    : 'linhas do mesmo tíquete foram unidas'}{' '}
                  à avaliação (comentários preservados).
                </p>
              )}

              {importResult.detalhesErro.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <button
                    type="button"
                    onClick={() => setShowErrorList((v) => !v)}
                    className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 w-full text-left"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showErrorList ? 'rotate-180' : ''}`}
                    />
                    {importResult.detalhesErro.length}{' '}
                    {importResult.detalhesErro.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}{' '}
                    — ver motivos
                  </button>
                  {showErrorList && (
                    <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {importResult.detalhesErro.map((e, i) => (
                        <li key={i} className="text-[11px] text-amber-800">
                          Linha {e.linha}: {e.motivo}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => navigate('/satisfacao')}
                  className="gap-2 bg-teal-600 hover:bg-teal-700"
                >
                  Ver relatório de Satisfação <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportResult(null)
                    setFile(null)
                    setParsedData(null)
                    setCurrentStep(1)
                  }}
                >
                  Importar outra planilha
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {parseError && currentStep === 3 && importResult && (
        <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {parseError}
        </div>
      )}
    </div>
  )
}
