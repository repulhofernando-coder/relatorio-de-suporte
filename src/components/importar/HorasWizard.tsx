/**
 * Wizard de importação de "Horas trabalhadas" (relatório Tempo trabalhado nos
 * tickets do Movidesk), renderizado dentro do wizard de /importar quando o tipo
 * escolhido é "horas". Segue o mesmo visual/fluxo do fluxo de chamados:
 * 1) arquivo → 2) mapeamento → 3) revisar/importar.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  parseSpreadsheetFile,
  autoDetectMappingHoras,
  parseDateToISO,
  parseHoras as parseValorHoras,
  ParsedSpreadsheet,
} from '@/lib/horas-spreadsheet'
import { traduzirErro } from '@/lib/erros'
import { insertTimeLogsBatch, createImportRecord, upsertMapeamentoHoras } from '@/services/horas'
import { upsertMapeamento } from '@/services/support'
import { CAMPOS_HORAS, CampoHoraKey, LABELS_CAMPOS_HORAS, MappingHoras } from '@/types/horas'
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
  ChevronRight,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

const EMPTY_MAPPING_HORAS: MappingHoras = {
  numero_ticket: '',
  cliente: '',
  tecnico: '',
  departamento: '',
  data_lancamento: ''
  tempo_lancamento: '',
  tempo_total_chamado: '',
  status: '',
}
