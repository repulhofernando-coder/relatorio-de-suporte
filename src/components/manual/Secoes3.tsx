import SecaoCard from '@/components/manual/SecaoCard'
import { Item, Destaque, Bloco } from '@/components/manual/Blocos'
import { Smile, Star, Network } from 'lucide-react'

export function SecaoSatisfacao() {
  return (
    <SecaoCard
      id="satisfacao"
      numero={7}
      titulo="Satisfação"
      descricao="Como os clientes avaliaram o atendimento"
      icone={<Smile className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Satisfação</Destaque> ficam os filtros de período e departamento (com o mesmo
        casamento de rótulos usado em todo o sistema — ver seção 9) e os cards de resumo: total de
        respostas, % muito satisfeito, % insatisfeito e o índice médio (1 a 3).
      </p>
      <ul className="space-y-1.5">
        <Item>
          <Destaque>Evolução mensal</Destaque> — como o índice se comportou mês a mês.
        </Item>
        <Item>
          <Destaque>Rankings por técnico, cliente e departamento</Destaque> — cada linha mostra a
          média, a distribuição por emoji (ex.: <em>"46 😀 · 4 🙂 · 0 😠"</em>), o % de
          insatisfeitos e o número de respostas.
        </Item>
        <Item>
          <Destaque>Comentários qualitativos</Destaque> — os textos que os clientes escreveram, com
          o selo <Destaque>"✓ na base de chamados"</Destaque> quando o número do tíquete casa com um
          chamado importado (ou seja, dá para ver quem atendeu e quando).
        </Item>
      </ul>
      <Bloco>
        <Destaque>1 tíquete = 1 avaliação.</Destaque> Um mesmo chamado gera três perguntas na
        pesquisa, e por isso o sistema conta uma única avaliação por tíquete: a nota é a da pergunta
        1, e os comentários das outras linhas do mesmo tíquete são unidos a ela. O total de
        avaliações mostra, portanto, o número de tíquetes avaliados, não o de linhas da planilha. Ao
        reimportar uma planilha, os tíquetes que já estão na base são ignorados e a tela de
        importação informa quais foram.
      </Bloco>
    </SecaoCard>
  )
}

export function SecaoPontuacao() {
  return (
    <SecaoCard
      id="pontuacao"
      numero={8}
      titulo="Pontuação da satisfação"
      descricao="Como cada resposta vira nota — leia antes de interpretar os rankings"
      icone={<Star className="w-5 h-5" />}
    >
      <p>
        A pesquisa usa uma <Destaque>escala de 3 níveis</Destaque>, com uma nota por resposta:
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
          <p className="text-3xl">😀</p>
          <p className="mt-1 font-semibold text-slate-900">Muito satisfeito</p>
          <p className="text-2xl font-extrabold text-teal-700 mt-1">3 pontos</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-3xl">🙂</p>
          <p className="mt-1 font-semibold text-slate-900">Satisfeito</p>
          <p className="text-2xl font-extrabold text-sky-700 mt-1">2 pontos</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-3xl">😠</p>
          <p className="mt-1 font-semibold text-slate-900">Insatisfeito</p>
          <p className="text-2xl font-extrabold text-red-700 mt-1">1 ponto</p>
        </div>
      </div>
      <p>
        O <Destaque>índice médio</Destaque> varia de <Destaque>1 a 3</Destaque>:
      </p>
      <ul className="space-y-1.5">
        <Item>
          <Destaque>3,0</Destaque> — perfeição: 100% das avaliações no nível mais alto.
        </Item>
        <Item>
          <Destaque>2,5</Destaque> — bom equilíbrio entre satisfeitos e muito satisfeitos.
        </Item>
        <Item>
          <Destaque>Abaixo de 2,0</Destaque> — sinal de insatisfação relevante; vale investigar os
          comentários.
        </Item>
      </ul>
      <Bloco tone="amber">
        <Destaque>Por que a média sozinha engana:</Destaque> a média esconde a mistura. Metade das
        respostas 😀 (3 pontos) e metade 😠 (1 ponto) também dá 2,0 — o mesmo número de um time com
        respostas só 🙂. Por isso, junto da média, mostramos sempre a{' '}
        <Destaque>distribuição por emoji</Destaque> e o <Destaque>% de insatisfeitos</Destaque>.
      </Bloco>
      <p className="font-semibold text-slate-900">As perguntas da pesquisa são:</p>
      <ol className="space-y-1.5 list-decimal list-inside">
        <li>Avalie a satisfação com a conclusão do atendimento (a nota 😀/🙂/😠).</li>
        <li>Comentário ou sugestão (texto livre).</li>
        <li>
          Número do tíquete — é ele que <Destaque>vincula a resposta ao chamado</Destaque> e permite
          cruzar satisfação com técnico e cliente.
        </li>
      </ol>
    </SecaoCard>
  )
}

export function SecaoDepartamentos() {
  return (
    <SecaoCard
      id="departamentos"
      numero={9}
      titulo="Regras de departamento"
      descricao="Como os rótulos do Movidesk são casados com os filtros"
      icone={<Network className="w-5 h-5" />}
    >
      <p>
        Os rótulos de time que vêm do Movidesk nem sempre combinam com os nomes dos filtros. O
        sistema usa <Destaque>regras semânticas</Destaque> de casamento:
      </p>
      <ul className="space-y-1.5">
        <Item>
          O filtro <Destaque>"Linux"</Destaque> casa com <Destaque>"Linux N1/N2"</Destaque> — todas
          as horas do time Linux contam como Linux.
        </Item>
        <Item>
          O filtro <Destaque>"N2"</Destaque> pega apenas o N2 de time específico que{' '}
          <Destaque>não seja Linux</Destaque> (ex.: <em>"Windows - N2"</em>).
        </Item>
        <Item>
          O filtro <Destaque>"Todos"</Destaque> soma tudo — e é o único lugar onde o total do
          cliente aparece completo.
        </Item>
        <Item>
          Setores que só existem nas horas lançadas (Comercial, Cabeamento, Laboratório, Datacenter
          Windows/Linux etc.) também aparecem nas opções dos filtros.
        </Item>
        <Item>
          Os setores <Destaque>"Projetos Internos"</Destaque> e <Destaque>"Ativação"</Destaque>{' '}
          entram como filtros <Destaque>"Projetos"</Destaque> e <Destaque>"Ativação"</Destaque> — os
          rótulos <em>"Projetos"</em>, <em>"Projetos Internos"</em> e <em>"Projetos Locais"</em> da
          planilha são <Destaque>a mesma fila</Destaque> no Movidesk e aparecem somados no filtro{' '}
          "Projetos", sem misturar com os demais setores.
        </Item>
        <Item>
          O rótulo da planilha <Destaque>"07-datacenter-windows"</Destaque> (e variações, com ou sem
          hífen/número) é reconhecido como o setor <Destaque>"Datacenter Windows"</Destaque>, com
          filtro próprio. É <Destaque>fila separada</Destaque>: o filtro{' '}
          <Destaque>"Windows"</Destaque> <b>não</b> puxa os lançamentos de datacenter — um time de
          Datacenter Windows aparece só no filtro "Datacenter Windows".
        </Item>
      </ul>
      <Bloco tone="teal">
        <Destaque>Metas de Datacenter Windows implantadas:</Destaque> benchmark cadastrado pela
        gestão (tabela "Quadro Atualizado: Datacenter Windows — 170 Chamados/Mês"). <b>Ideal:</b>{' '}
        volume de <Destaque>100 a 140 chamados/mês</Destaque> (referência para 2,5 técnicos), equipe
        de <Destaque>3 a 4 analistas + gestor dedicado</Destaque>, produtividade de{' '}
        <Destaque>1,8 a 2,5 chamados/dia por recurso</Destaque> e ocupação direta de{' '}
        <Destaque>65% a 75% do tempo</Destaque>. O TMA real por complexidade segue{' '}
        <Destaque>a levantar</Destaque> — as faixas de SLA alvo já estão implantadas:{' '}
        <Destaque>Rotinas (RAM/VPN): 45min a 1h30</Destaque> e{' '}
        <Destaque>Cloud (VPS/Migração/POC): 4h a 12h</Destaque>. O sistema deve separar o tempo de
        manutenção rápida do tempo de projetos de nuvem. Fontes: Gartner (Cloud Infrastructure &
        Operations), ITIL 4 (Gerenciamento de Capacidade e Disponibilidade) e Uptime Institute
        (Padrões de Operação de Datacenter).
      </Bloco>
      <Bloco>
        Isso significa que um técnico do "Linux N1/N2" aparece quando você filtra por Linux, mas{' '}
        <Destaque>não</Destaque> quando filtra por N2 — o N2 do filtro é só o de times específicos
        como "Windows - N2".
      </Bloco>
    </SecaoCard>
  )
}
