-- Colunas de horário dos lançamentos de horas (v0.0.84):
-- o export "Tempo trabalhado nos tickets" do Movidesk traz as colunas
-- "Início"/"Fim" e "Horas apontadas"; são necessárias para a deduplicação
-- por sobreposição (a linha consolidada cobre o intervalo das partes —
-- ex.: tíquete 154336, 36+194 = 230 consolidado).
ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS inicio timestamptz,
  ADD COLUMN IF NOT EXISTS fim timestamptz,
  ADD COLUMN IF NOT EXISTS minutos_trabalhados numeric;

CREATE INDEX IF NOT EXISTS time_logs_inicio_idx ON public.time_logs (inicio);
