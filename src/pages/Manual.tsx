import { BarChart3, Printer, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SecaoVisaoGeral, SecaoImportar } from '@/components/manual/Secoes1'
import {
  SecaoDashboard,
  SecaoChamados,
  SecaoHoras,
  SecaoContratos,
} from '@/components/manual/Secoes2'
import { SecaoSatisfacao, SecaoPontuacao, SecaoDepartamentos } from '@/components/manual/Secoes3'
import { SecaoImportacoes, SecaoEquipes, SecaoUsuarios } from '@/components/manual/Secoes4'

const SUMARIO = [
  { id: 'visao-geral', label: '1. Visão geral do sistema' },
  { id: 'importar', label: '2. Importar Planilha' },
  { id: 'dashboard', label: '3. Visão Geral (dashboard)' },
  { id: 'chamados', label: '4. Chamados' },
  { id: 'horas', label: '5. Horas' },
  { id: 'contratos', label: '6. Contratos' },
  { id: 'satisfacao', label: '7. Satisfação' },
  { id: 'pontuacao', label: '8. Pontuação da satisfação' },
  { id: 'departamentos', label: '9. Regras de departamento' },
  { id: 'importacoes', label: '10. Importações e Mapeamentos' },
  { id: 'equipes', label: '11. Equipes e metas' },
  { id: 'usuarios', label: '12. Usuários' },
]

export default function Manual() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER — padrão das demais páginas */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 -ml-2 print:hidden"
              aria-label="Voltar para a Visão Geral"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-teal-600" />
              Manual do Sistema
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">
            Como o Suporte Analytics funciona, seção por seção
          </p>
        </div>
        <Button
          onClick={() => window.print()}
          className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm shrink-0 print:hidden"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>

      {/* SUMÁRIO — div (não <nav>) para também aparecer na impressão */}
      <div
        id="sumario"
        className="bg-white rounded-2xl shadow-sm border border-slate-200/80 px-5 sm:px-6 py-4"
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          Sumário
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
          {SUMARIO.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-teal-700 hover:text-teal-900 hover:underline font-medium"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* CONTEÚDO */}
      <div className="space-y-6">
        <SecaoVisaoGeral />
        <SecaoImportar />
        <SecaoDashboard />
        <SecaoChamados />
        <SecaoHoras />
        <SecaoContratos />
        <SecaoSatisfacao />
        <SecaoPontuacao />
        <SecaoDepartamentos />
        <SecaoImportacoes />
        <SecaoEquipes />
        <SecaoUsuarios />
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        Suporte Analytics · Mundo Open Tecnologia · Manual do Sistema
      </p>
    </div>
  )
}
