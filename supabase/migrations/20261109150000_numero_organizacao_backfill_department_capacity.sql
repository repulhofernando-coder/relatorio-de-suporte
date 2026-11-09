-- Migration: campos para consulta individual de chamados, backfill de departamento
-- e tabela de capacidade de técnicos por departamento.
-- Tudo nullable/idempotente: registros antigos não têm numero/organizacao e continuam válidos.

-- 1. Novas colunas em support_records
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.support_records ADD COLUMN IF NOT EXISTS organizacao TEXT;

CREATE INDEX IF NOT EXISTS idx_support_records_user_numero
  ON public.support_records(user_id, numero);
CREATE INDEX IF NOT EXISTS idx_support_records_user_organizacao
  ON public.support_records(user_id, organizacao);

-- 2. Backfill de departamento: remove prefixos numéricos ("01.", "04. ") e
--    compara sem acentos, gravando o nome canônico do setor.
--    "01.Windows" → Windows | "02. Windows N2" → Windows N2 | "04. Campo" → Campo
UPDATE public.support_records
SET departamento = CASE
  WHEN norm ~ '^windows\s*n2$' THEN 'Windows N2'
  WHEN norm = 'windows'        THEN 'Windows'
  WHEN norm = 'campo'          THEN 'Campo'
  WHEN norm = 'ativacao'       THEN 'Ativação'
  WHEN norm = 'projetos'       THEN 'Projetos'
  ELSE departamento
END
FROM (
  SELECT
    id AS row_id,
    regexp_replace(
      translate(lower(trim(departamento)),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '^[0-9]+[\.\-]?\s*', ''
    ) AS norm
  FROM public.support_records
  WHERE departamento IS NOT NULL
) sub
WHERE public.support_records.id = sub.row_id;

-- 3. Tabela de capacidade por departamento
CREATE TABLE IF NOT EXISTS public.department_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  departamento TEXT NOT NULL,
  qtd_tecnicos INTEGER NOT NULL DEFAULT 1 CHECK (qtd_tecnicos >= 0),
  dias_uteis INTEGER NOT NULL DEFAULT 22 CHECK (dias_uteis > 0 AND dias_uteis <= 31),
  limite_diario NUMERIC NOT NULL DEFAULT 8 CHECK (limite_diario > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT department_capacity_user_departamento_unique UNIQUE (user_id, departamento)
);

ALTER TABLE public.department_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "department_capacity_user_select" ON public.department_capacity;
CREATE POLICY "department_capacity_user_select" ON public.department_capacity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "department_capacity_user_insert" ON public.department_capacity;
CREATE POLICY "department_capacity_user_insert" ON public.department_capacity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "department_capacity_user_update" ON public.department_capacity;
CREATE POLICY "department_capacity_user_update" ON public.department_capacity
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "department_capacity_user_delete" ON public.department_capacity;
CREATE POLICY "department_capacity_user_delete" ON public.department_capacity
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
