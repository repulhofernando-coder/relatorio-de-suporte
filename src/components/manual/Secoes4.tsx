import SecaoCard from '@/components/manual/SecaoCard'
import { Item, Destaque, Bloco } from '@/components/manual/Blocos'
import { History, Users, UserCog } from 'lucide-react'

export function SecaoImportacoes() {
  return (
    <SecaoCard
      id="importacoes"
      numero={10}
      titulo="Importações e Mapeamentos"
      descricao="Histórico e configurações de colunas"
      icone={<History className="w-5 h-5" />}
    >
      <ul className="space-y-1.5">
        <Item>
          <Destaque>Importações</Destaque> — histórico de tudo que entrou no sistema, com data,
          arquivo e quantas linhas foram importadas. A exclusão é <Destaque>em cascata</Destaque>:
          ao apagar uma importação, todos os registros que vieram dela são removidos juntos (sem
          deixar linhas órfãs nos painéis).
        </Item>
        <Item>
          <Destaque>Mapeamentos</Destaque> — as correspondências de colunas memorizadas, separadas
          por tipo (chamados, "[Horas]" e o marcador próprio de satisfação). É possível editar um
          mapeamento quando a planilha muda de formato.
        </Item>
      </ul>
    </SecaoCard>
  )
}

export function SecaoEquipes() {
  return (
    <SecaoCard
      id="equipes"
      numero={11}
      titulo="Equipes e metas"
      descricao="Metas de referência por equipe e alertas de medida"
      icone={<Users className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Equipes</Destaque> ficam as metas de referência usadas para comparar o
        desempenho real com o esperado, por equipe:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-xl overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Equipe</th>
              <th className="text-left px-3 py-2 font-semibold">TMA (tempo médio/chamado)</th>
              <th className="text-left px-3 py-2 font-semibold">Produtividade</th>
              <th className="text-left px-3 py-2 font-semibold">Ocupação</th>
              <th className="text-left px-3 py-2 font-semibold">Fonte das metas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-3 py-2 font-medium">N1 remoto</td>
              <td className="px-3 py-2">15–25 min</td>
              <td className="px-3 py-2">12–18 chamados/dia</td>
              <td className="px-3 py-2">—</td>
              <td className="px-3 py-2 text-slate-500">HDI / MetricNet</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">N2</td>
              <td className="px-3 py-2">60–90 min</td>
              <td className="px-3 py-2">1,8–2,7 chamados/dia</td>
              <td className="px-3 py-2">65–75%</td>
              <td className="px-3 py-2 text-slate-500">ITIL 4 / Gartner</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">Campo</td>
              <td className="px-3 py-2">3h–4h30</td>
              <td className="px-3 py-2">1,2–1,8 chamados/dia</td>
              <td className="px-3 py-2">70–80%</td>
              <td className="px-3 py-2 text-slate-500">MetricNet Field Service / CompTIA</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">Linux (misto)</td>
              <td className="px-3 py-2">30–50 min</td>
              <td className="px-3 py-2">4–7 chamados/dia</td>
              <td className="px-3 py-2">65–75%</td>
              <td className="px-3 py-2 text-slate-500">Intelligent Swarming / HDI</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Bloco tone="amber">
        <Destaque>Linux (misto):</Destaque> volume de referência de ~351 chamados/mês com equipe
        ideal de <Destaque>2 a 3 técnicos</Destaque> (a operação real atual tem 7, dimensionada para
        alta disponibilidade, projetos e margem de crescimento). SLA por complexidade: 30–45 min
        para cPanel/PHP (N1) e 1h30–3h para Fortigate/UniFi (N2).
      </Bloco>
      <Bloco tone="red">
        <Destaque>Outliers não são filtrados.</Destaque> Registros de tempo muito curtos podem ser
        preenchimento errado, então um TMA abaixo de <Destaque>5 minutos</Destaque> é{' '}
        <Destaque>sinalizado</Destaque> (não removido) como possível erro de digitação ou hábito de
        lançamento — sempre confira antes de tirar conclusões.
      </Bloco>
    </SecaoCard>
  )
}

export function SecaoUsuarios() {
  return (
    <SecaoCard
      id="usuarios"
      numero={12}
      titulo="Usuários"
      descricao="Somente administrador"
      icone={<UserCog className="w-5 h-5" />}
    >
      <p>
        Em <Destaque>Usuários</Destaque> (visível apenas para administradores) são criados os
        acessos ao sistema. Ao criar um usuário você escolhe o <Destaque>perfil</Destaque>:{' '}
        <Destaque>admin</Destaque> (acesso completo) ou <Destaque>colaborador</Destaque> (somente
        visualizar + exportar PDF — ver seção 1).
      </p>
      <p>
        <Destaque>Dica:</Destaque> para pessoas que só vão consultar os painéis, crie sempre como
        colaborador — assim o menu já mostra apenas o que elas podem usar.
      </p>
    </SecaoCard>
  )
}
