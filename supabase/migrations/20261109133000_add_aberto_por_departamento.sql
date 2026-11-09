-- Migration: Adiciona colunas aberto_por e departamento em support_records
-- Idempotente: colunas novas são nuláveis (importações antigas ficam sem os valores)

ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS aberto_por TEXT;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS departamento TEXT;

CREATE INDEX IF NOT EXISTS idx_support_records_user_departamento
  ON public.support_records(user_id, departamento);
