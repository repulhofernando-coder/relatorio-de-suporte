-- Adiciona colunas de faixas de meta (mínima e máxima) em department_capacity
-- sem quebrar colunas legadas meta_tma_min e meta_chamados_dia
ALTER TABLE public.department_capacity
  ADD COLUMN IF NOT EXISTS meta_tma_min_num numeric,
  ADD COLUMN IF NOT EXISTS meta_tma_max_num numeric,
  ADD COLUMN IF NOT EXISTS meta_chamados_dia_min numeric,
  ADD COLUMN IF NOT EXISTS meta_chamados_dia_max numeric,
  ADD COLUMN IF NOT EXISTS meta_ocupacao_min numeric,
  ADD COLUMN IF NOT EXISTS meta_ocupacao_max numeric;

-- Inicializa linhas existentes
-- Para N2 ou Windows N2: TMA 60 a 90 min, 1.8 a 2.7 chamados/dia, ocupação 65% a 75%
UPDATE public.department_capacity
SET
  meta_tma_min = 60,
  meta_tma_min_num = 60,
  meta_tma_max_num = 90,
  meta_chamados_dia = 2.25,
  meta_chamados_dia_min = 1.8,
  meta_chamados_dia_max = 2.7,
  meta_ocupacao_min = 65,
  meta_ocupacao_max = 75
WHERE departamento IN ('Windows N2', 'N2', 'N2 Remoto');

-- Para os demais departamentos já cadastrados (ex.: Windows N1 remoto), se estiverem com valores padrão ou sem faixa
UPDATE public.department_capacity
SET
  meta_tma_min_num = COALESCE(meta_tma_min_num, 15),
  meta_tma_max_num = COALESCE(meta_tma_max_num, 25),
  meta_chamados_dia_min = COALESCE(meta_chamados_dia_min, 12),
  meta_chamados_dia_max = COALESCE(meta_chamados_dia_max, 18),
  meta_ocupacao_min = COALESCE(meta_ocupacao_min, 70),
  meta_ocupacao_max = COALESCE(meta_ocupacao_max, 85)
WHERE departamento NOT IN ('Windows N2', 'N2', 'N2 Remoto');
