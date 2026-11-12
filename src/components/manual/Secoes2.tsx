import SecaoCard from '@/components/manual/SecaoCard'
import { Item, Destaque, Bloco } from '@/components/manual/Blocos'
import { Ticket, Clock, FileClock } from 'lucide-react'

export function SecaoDashboard() {
  return (
    <SecaoCard
      id="dashboard"
      numero={3}
      titulo="Visão Geral (dashboard)"
      descricao="O painel inicial, com filtros, resumos e rankings"
      icone={<Ticket className="w-5 h-5" />}
    >
      <p>
        A <Destaque>Visão Geral</Destaque> é o painel inicial. No topo ficam os filtros:
        <Destaque> chips de período</Destaque> (Este mês, Mês passado, Últimos 3 meses, Este ano,
        Tudo e Personalizado) e o <Destaque>seletor de departamento</Destaque>. Ao trocar o período,
        o departamento continua selecionado (e vice-versa); trocar de técnico, sim, volta ao padrão.
      </p>
      <p>
        Abaixo dos filtros aparecem os <Destaque>cards de resumo</Destaque> (total de chamados,
        tempo médio etc.), os <Destaque>rankings de clientes e técnicos</Destaque> e o card{' '}
        <Destaque>"Clientes que mais consumiram horas"</Destaque>, alimentado pelos lançamentos de
        horas importadas.
      </p>
      <Bloco>
        <Destaque>Drill-down do técnico:</Destaque> clique no nome de um técnico para abrir um card
        com o detalhe dele — contadores de satisfação (😀/🙂/😠), uma barra colorida com a proporção
        das notas, a média, o % de insatisfeitos, a seção "Onde lança mais horas (Top 3)" (cliente +
        horas + barra) e a lista de chamados avaliados, com número do tíquete, emoji da nota e o
        comentário do cliente.
      </Bloco>
    </SecaoCard>
  )
}

export function SecaoChamados() {
  return (
    <SecaoCard
      id="chamados"
      numero={4}
      titulo="Chamados"
      descricao="Lista e pesquisa de chamados por cliente e técnico"
      icone={<Ticket className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Chamados</Destaque> você lista e pesquisa os chamados por cliente e por
        técnico, respeitando o <Destaque>período</Destaque> e o <Destaque>departamento</Destaque>{' '}
        ativos nos filtros.
      </p>
      <Bloco>
        Ao pesquisar por um <Destaque>cliente</Destaque>, além dos chamados aparece o card{' '}
        <Destaque>"Resumo de horas do cliente"</Destaque>: total de horas, número de lançamentos,
        quantos chamados distintos tiveram horas e qual técnico mais lançou horas para esse cliente.
        A busca é tolerante a diferenças de grafia — funciona com acentos, maiúsculas e nomes
        parciais (ex.: "mundao" acha "Mundo Open").
      </Bloco>
    </SecaoCard>
  )
}

export function SecaoHoras() {
  return (
    <SecaoCard
      id="horas"
      numero={5}
      titulo="Horas"
      descricao="Onde o esforço da equipe foi lançado"
      icone={<Clock className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Horas</Destaque> ficam os cards de resumo: <Destaque>total de horas</Destaque>,{' '}
        <Destaque>chamados com lançamento</Destaque>, <Destaque>média por chamado</Destaque> e{' '}
        <Destaque>horas sem chamado vinculado</Destaque> (lançamentos que não casaram com nenhum
        tíquete da base).
      </p>
      <p>
        Logo após os resumos vem a seção <Destaque>"Departamento × cliente"</Destaque>: o total do
        setor no período, a quebra por cliente e qual porcentagem do esforço do setor cada cliente
        representa — a leitura de contrato (quem consome mais de cada equipe).
      </p>
      <ul className="space-y-1.5">
        <Item>
          <Destaque>Ranking de clientes</Destaque> clicável — ao clicar, você vai para Chamados já
          filtrado por aquele cliente, período e departamento.
        </Item>
        <Item>
          <Destaque>Horas por técnico</Destaque> com a média por chamado de cada um.
        </Item>
        <Item>
          <Destaque>Média mensal por cliente</Destaque> — a coluna "média/mês" conta apenas os meses
          em que houve lançamentos, para não diluir a média em meses vazios.
        </Item>
        <Item>
          <Destaque>Busca</Destaque> por cliente e por técnico.
        </Item>
      </ul>
      <p>
        No topo ficam os botões <Destaque>Exportar</Destaque> (Excel com as abas Resumo, Ranking de
        clientes e Horas por técnico — exporta exatamente o que está na tela, incluindo filtros e
        busca) e <Destaque>Imprimir</Destaque>.
      </p>
    </SecaoCard>
  )
}

export function SecaoContratos() {
  return (
    <SecaoCard
      id="contratos"
      numero={6}
      titulo="Contratos"
      descricao="Horas contratadas por cliente e o contraste com o consumo real"
      icone={<FileClock className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Contratos</Destaque> (item do menu abaixo de Horas) cada cliente tem um
        cadastro com: as <Destaque>horas contratadas</Destaque> (aceita "20", "20,5", "2h30"), se o
        contrato é <Destaque>cumulativo</Destaque> e, sendo, o <Destaque>período em meses</Destaque>{' '}
        (vazio quando não é cumulativo). É possível editar e excluir; salvar o mesmo cliente duas
        vezes <Destaque>atualiza</Destaque> o contrato existente, não cria um segundo.
      </p>
      <p>
        <Destaque>Somente o administrador cadastra</Destaque>; o colaborador visualiza. O contraste
        aparece em Horas e no resumo do cliente em Chamados: um <Destaque>selo vermelho</Destaque>{' '}
        quando a média mensal consumida excede o contratado e <Destaque>verde</Destaque> quando está
        dentro. Um card âmbar no topo de Horas lista os{' '}
        <Destaque>5 contratos mais estourados</Destaque>.
      </p>
    </SecaoCard>
  )
}
