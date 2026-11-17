-- Escala de satisfação de 5 níveis (Ótimo 5 · Bom 4 · Neutro 3 · Ruim 2 · Péssimo 1).
-- 1) CHECK passa a aceitar 1..5.
-- 2) Conversão ÚNICA do histórico (escala antiga 1–3): 3 → 5, 2 → 4, 1 permanece 1.
--    A guarda created_at < corte preserva respostas novas (importadas depois desta
--    migração), que podem legitimamente ter nota 2 ou 3 na escala nova.
ALTER TABLE public.satisfaction_responses
  DROP CONSTRAINT IF EXISTS satisfaction_responses_nota_check;

ALTER TABLE public.satisfaction_responses
  ADD CONSTRAINT satisfaction_responses_nota_check CHECK (nota BETWEEN 1 AND 5);

UPDATE public.satisfaction_responses
SET nota = CASE nota WHEN 3 THEN 5 WHEN 2 THEN 4 ELSE nota END
WHERE nota IN (2, 3)
  AND created_at < '2026-11-17 14:00:00+00';
