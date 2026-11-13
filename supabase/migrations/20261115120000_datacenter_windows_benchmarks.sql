-- Metas de Datacenter Windows — benchmark cadastrado pela gestão (tabela
-- "Quadro Atualizado: Datacenter Windows (170 Chamados/Mês)").
--
-- A tabela department_capacity não tem colunas para volume mensal, equipe ideal
-- nem faixas de SLA por complexidade: esses indicadores ficam como constantes em
-- src/lib/benchmarks-datacenter-windows.ts, exibidos nos cards. Aqui semeamos
-- apenas o que a estrutura comporta:
--   - meta_chamados_dia_min/max: 100–140 chamados/mês ÷ 22 dias úteis = 4,55–6,36/dia (equipe)
--   - meta_ocupacao_min/max: 65–75% do tempo em chamados
--   - qtd_tecnicos: 3 (operação real atual: 2 analistas + 1 gestor)
--   - dias_uteis: 22 (base de conversão do volume mensal)
-- O TMA real está "a levantar" e o SLA por complexidade tem DUAS faixas
-- (Rotinas 45min–1h30 · Cloud 4h–12h): como department_capacity comporta uma
-- única faixa de TMA, elas ficam em constantes no app — mesma decisão já tomada
-- para as faixas cPanel/PHP e Fortigate/UniFi do Linux.

UPDATE public.department_capacity
SET
  qtd_tecnicos = 3,
  dias_uteis = 22,
  limite_diario = GREATEST(ROUND(140.0 / 22)::numeric, limite_diario),
  meta_tma_min_num = NULL,
  meta_tma_max_num = NULL,
  meta_tma_min = NULL,
  meta_chamados_dia = ROUND(100.0 / 22, 2),
  meta_chamados_dia_min = ROUND(100.0 / 22, 2),
  meta_chamados_dia_max = ROUND(140.0 / 22, 2),
  meta_ocupacao_min = 65,
  meta_ocupacao_max = 75,
  updated_at = now()
WHERE departamento = 'Datacenter: Windows';
