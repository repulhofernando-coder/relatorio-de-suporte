-- ============================================================
-- Metas/benchmarks de Projetos (fila única) e Ativação
-- ============================================================
-- Reescrita da migração 20261114100000 que falhou com
-- ERROR 42703: column "observacoes" of relation "department_capacity"
-- does not exist. Esta versão usa SOMENTE colunas existentes e é
-- idempotente (upsert por departamento).
--
--department_capacity
--  id uuid pk default gen_random_uuid()
--  created_at timestamptz default now()
--  updated_at timestamptz
--  user_id uuid → auth.users(id)
--  departamento text not null unique
--  qtd_tecnicos int
--  dias_uteis int
--  limite_diario numeric
--  meta_tma_min numeric | meta_tma_min_num numeric
--  meta_tma_max_num numeric
--  meta_chamados_dia numeric | meta_chamados_dia_min/max numeric
--  meta_ocupacao_min/max numeric
--
-- Mapeamento das metas (indicadores não medidos — WIP, taxa de bloqueio,
-- lead time, handover — não têm coluna e ficam como constantes em
-- src/lib/benchmarks-projetos-ativacao.ts, exibidos na UI):
--   Projetos: TMA 8–16h líquidas → meta_tma_*_num 480–960 (min);
--     volume 25–35 projetos/mês → meta_chamados_dia_min/max 1,25–1,75/dia
--     (25–35 ÷ 20 dias úteis); equipe ideal 3 técnicos → qtd_tecnicos 3;
--     ocupação compatível com TMA × volume → meta_ocupacao_min/max 40–90%.
--   Ativação: lead time 7–15 dias úteis (não medido, constante); handover
--     > 90% (não medido, constante); impacto ≤ 25% da capacidade (não medido,
--     constante); ocupação/alocação de referência → meta_ocupacao_min/max
--     0–25%.

delete from public.department_capacity where departamento in ('Projetos Locais');

-- Fila única de Projetos: remove linha legada com volume antigo, se existir,
-- para que o upsert abaixo grave a nova faixa unificada.
delete from public.department_capacity where departamento = 'Projetos';

insert into public.department_capacity (
  user_id, departamento, qtd_tecnicos, dias_uteis, limite_diario,
  meta_tma_min, meta_tma_min_num, meta_tma_max_num,
  meta_chamados_dia, meta_chamados_dia_min, meta_chamados_dia_max,
  meta_ocupacao_min, meta_ocupacao_max, updated_at
)
values (
  (select id from auth.users order by created_at asc limit 1),
  'Projetos', 3, 20, 1.75,
  480, 480, 960,
  1.25, 1.25, 1.75,
  40, 90, now()
)
on conflict (departamento) do update set
  qtd_tecnicos = excluded.qtd_tecnicos,
  dias_uteis = excluded.dias_uteis,
  limite_diario = excluded.limite_diario,
  meta_tma_min = excluded.meta_tma_min,
  meta_tma_min_num = excluded.meta_tma_min_num,
  meta_tma_max_num = excluded.meta_tma_max_num,
  meta_chamados_dia = excluded.meta_chamados_dia,
  meta_chamados_dia_min = excluded.meta_chamados_dia_min,
  meta_chamados_dia_max = excluded.meta_chamados_dia_max,
  meta_ocupacao_min = excluded.meta_ocupacao_min,
  meta_ocupacao_max = excluded.meta_ocupacao_max,
  updated_at = now();

insert into public.department_capacity (
  user_id, departamento, qtd_tecnicos, dias_uteis, limite_diario,
  meta_tma_min, meta_tma_min_num, meta_tma_max_num,
  meta_chamados_dia, meta_chamados_dia_min, meta_chamados_dia_max,
  meta_ocupacao_min, meta_ocupacao_max, updated_at
)
values (
  (select id from auth.users order by created_at asc limit 1),
  'Ativação', 2, 20, 0.75,
  null, null, null,
  0.5, 0.5, 0.75,
  0, 25, now()
)
on conflict (departamento) do update set
  qtd_tecnicos = excluded.qtd_tecnicos,
  dias_uteis = excluded.dias_uteis,
  limite_diario = excluded.limite_diario,
  meta_tma_min = excluded.meta_tma_min,
  meta_tma_min_num = excluded.meta_tma_min_num,
  meta_tma_max_num = excluded.meta_tma_max_num,
  meta_chamados_dia = excluded.meta_chamados_dia,
  meta_chamados_dia_min = excluded.meta_chamados_dia_min,
  meta_chamados_dia_max = excluded.meta_chamados_dia_max,
  meta_ocupacao_min = excluded.meta_ocupacao_min,
  meta_ocupacao_max = excluded.meta_ocupacao_max,
  updated_at = now();
