-- Migração para cadastrar as metas/benchmarks dos departamentos "Projetos" e
-- "Ativação" (quadros consolidados enviados pela gestão).
--
-- "Projetos" é a fila ÚNICA do Movidesk (rótulos "Projetos", "Projetos
-- Internos" e "Projetos Locais" — ver src/lib/departamentos.ts, v0.0.69);
-- a tabela da gestão dizia "Projetos Locais", agora unificada como "Projetos".
--
-- Mapeamento dos indicadores para os campos existentes da tabela:
--   Projetos:
--     - Volume mensal ideal (25 a 35 projetos/mês, 3 técnicos)
--       → meta_chamados_dia(_min/_max): 25/22 ≈ 1,14 e 35/22 ≈ 1,59 projetos/dia
--     - TMA ideal (8 a 16 horas líquidas) → meta_tma_min_num 480 / meta_tma_max_num 960 (min)
--     - WIP (3 a 5 projetos/técnico), taxa de bloqueio (<30% do tempo) e os
--       valores/diagnósticos verbatim → não têm coluna: ficam nas observações.
--   Ativação:
--     - Lead time ideal (7 a 15 dias úteis) → meta_tma_min_num 10080 / meta_tma_max_num 21600 (min)
--     - Carga da equipe (até 25% da capacidade) → meta_ocupacao_min 0 / meta_ocupacao_max 25
--     - Volume (dependente da meta comercial), handover (>90% sem falhas) e os
--       diagnósticos verbatim → não têm coluna: ficam nas observações.
--
-- A coluna de texto livre usada é "observacoes" (equivalente da "observações"
-- dos demais setores — o tipo do registro de capacidade é estruturado; os
-- textos entram como bloco JSON no campo de obs. do departamento).

-- =========================================================
-- 1. ATUALIZA linhas já existentes (se o departamento já tiver sido criado)
-- =========================================================

UPDATE public.department_capacity
SET
  qtd_tecnicos = 3,
  limite_diario = 1.6,
  meta_tma_min = 480,
  meta_tma_min_num = 480,
  meta_tma_max_num = 960,
  meta_chamados_dia = 1.6,
  meta_chamados_dia_min = 1.14,
  meta_chamados_dia_max = 1.6,
  meta_ocupacao_min = NULL,
  meta_ocupacao_max = NULL,
  observacoes = '...projetos obs...',
  updated_at = now()
WHERE departamento IN ('Projetos', 'Projetos Locais', 'Projetos Internos');
