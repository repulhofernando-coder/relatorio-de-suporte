-- Adiciona coluna de Tempo de SLA (em horas, numeric, nullable) aos registros de suporte.
-- Registros antigos ficam com NULL (planilhas sem a coluna continuam importando).

ALTER TABLE public.support_records
  ADD COLUMN IF NOT EXISTS sla_horas numeric;

CREATE INDEX IF NOT EXISTS idx_support_records_user_sla
  ON public.support_records (user_id, sla_horas);
