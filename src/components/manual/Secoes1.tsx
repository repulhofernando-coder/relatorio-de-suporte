import type { ReactNode } from 'react'
import SecaoCard from '@/components/manual/SecaoCard'
import { Item, Destaque, Bloco } from '@/components/manual/Blocos'
import { LineChart, Upload } from 'lucide-react'

export type SecaoManual = {
  id: string
  titulo: string
  icone: ReactNode
  conteudo: ReactNode
}

export function SecaoVisaoGeral() {
  return (
    <SecaoCard
      id="visao-geral"
      numero={1}
      titulo="Visão geral do sistema"
      descricao="O que é o Suporte Analytics e quem pode usar o quê"
      icone={<LineChart className="w-5 h-5" />}
    >
      <p>
        O <Destaque>Suporte Analytics</Destaque> é a ferramenta da Mundo Open Tecnologia para
        acompanhar o desempenho do suporte. A cada mês, as planilhas exportadas do Movidesk são
        importadas no sistema, que transforma essas linhas em painéis gráficos fáceis de ler: por{' '}
        <Destaque>cliente</Destaque>, por <Destaque>técnico</Destaque>, por{' '}
        <Destaque>departamento</Destaque> e por <Destaque>período</Destaque>.
      </p>
      <p>
        Na primeira importação, o sistema aprende qual coluna da planilha corresponde a cada
        informação (cliente, técnico, horas, nota de satisfação etc.) e{' '}
        <Destaque>memoriza esse mapeamento</Destaque>. Nas importações seguintes, você só sobe o
        arquivo e confirma — as colunas são casadas automaticamente.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
          <p className="font-semibold text-slate-900">Administrador</p>
          <p className="mt-1 text-slate-600">
            Acesso completo: importar planilhas, excluir importações, editar mapeamentos, Equipes e
            metas, cadastrar usuários, contratos de horas e salvar relatórios.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
          <p className="font-semibold text-slate-900">Colaborador</p>
          <p className="mt-1 text-slate-600">
            Acesso somente leitura: visualiza os painéis (Visão Geral, Chamados, Horas, Satisfação
            etc.) e exportar relatórios em PDF. Não importa, não exclui, não edita cadastros.
          </p>
        </div>
      </div>
    </SecaoCard>
  )
}

export function SecaoImportar() {
  return (
    <SecaoCard
      id="importar"
      numero={2}
      titulo="Importar Planilha"
      descricao="Três tipos de importação — cada um com o próprio card"
      icone={<Upload className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Importar Planilha</Destaque> existem três tipos de importação. O fluxo é o
        mesmo nos três: <Destaque>escolher o tipo</Destaque> → <Destaque>subir o arquivo</Destaque>{' '}
        (.xlsx, .xls ou .csv) → <Destaque>mapear as colunas</Destaque> (só na primeira vez) →{' '}
        <Destaque>confirmar a importação</Destaque>.
      </p>
      <ul className="space-y-1.5">
        <Item>
          <Destaque>Chamados</Destaque> — a planilha mensal de chamados atendidos, base de todos os
          painéis de atendimento.
        </Item>
        <Item>
          <Destaque>Horas trabalhadas</Destaque> — a planilha "Tempo trabalhado nos tickets". O
          sistema entende vários formatos de tempo: <em>"0,71h"</em>, <em>"01:30"</em>,{' '}
          <em>"150min"</em>, <em>"2h30"</em> e número puro (que vale como horas).{' '}
          <Destaque>Só entram chamados resolvidos</Destaque>; ao fim da importação, a tela mostra
          quantas linhas entraram e quantas foram descartadas, com o motivo de cada descarte.
        </Item>
        <Item>
          <Destaque>Satisfação</Destaque> — o export da pesquisa de satisfação do Movidesk (ver a
          seção 8 sobre a pontuação).
        </Item>
      </ul>
      <p>
        O mapeamento de colunas fica <Destaque>memorizado por tipo</Destaque>: as importações de
        horas aparecem marcadas com <Destaque>"[Horas]"</Destaque> na lista de mapeamentos e as de
        satisfação com o marcador próprio. Assim, o mapeamento de chamados nunca é confundido com o
        de horas ou de satisfação, mesmo que as planilhas tenham colunas parecidas.
      </p>
      <p>Erros aparecem em português claro na tela, com orientação do que fazer.</p>
      <Bloco tone="amber">
        <Destaque>Boa prática:</Destaque> importe primeiro os chamados, depois as horas e por último
        a satisfação do mesmo período. A satisfação é vinculada ao chamado pelo{' '}
        <Destaque>número do tíquete</Destaque> — se o chamado ainda não foi importado, o comentário
        aparece no painel, mas sem o vínculo "✓ na base de chamados".
      </Bloco>
    </SecaoCard>
  )
}
