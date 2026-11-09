-- Migration para adicionar metas de TMA e produtividade por departamento
ALTER TABLE public.department_capacity
  ADD COLUMN IF NOT EXISTS meta_tma_min numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS meta_chamados_dia numeric DEFAULT 15;
