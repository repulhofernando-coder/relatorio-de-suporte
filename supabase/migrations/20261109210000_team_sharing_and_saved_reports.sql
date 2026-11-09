-- Migration: Compartilhamento de dados para equipe autenticada e criação de saved_reports
-- Permite SELECT, INSERT, UPDATE, DELETE para authenticated em imports, support_records, mapeamentos, department_capacity
-- Ajusta unique constraints de (user_id, ...) para (...) de nível global de equipe
-- Atualiza a função get_departamentos_em_uso para não filtrar por user_id = auth.uid()
-- Cria a tabela saved_reports com RLS completa para authenticated

-- 1. DROP old user-restricted policies on domain tables
DROP POLICY IF EXISTS "imports_user_select" ON public.imports;
DROP POLICY IF EXISTS "imports_user_insert" ON public.imports;
DROP POLICY IF EXISTS "imports_user_update" ON public.imports;
DROP POLICY IF EXISTS "imports_user_delete" ON public.imports;

DROP POLICY IF EXISTS "support_records_user_select" ON public.support_records;
DROP POLICY IF EXISTS "support_records_user_insert" ON public.support_records;
DROP POLICY IF EXISTS "support_records_user_update" ON public.support_records;
DROP POLICY IF EXISTS "support_records_user_delete" ON public.support_records;

DROP POLICY IF EXISTS "mapeamentos_user_select" ON public.mapeamentos;
DROP POLICY IF EXISTS "mapeamentos_user_insert" ON public.mapeamentos;
DROP POLICY IF EXISTS "mapeamentos_user_update" ON public.mapeamentos;
DROP POLICY IF EXISTS "mapeamentos_user_delete" ON public.mapeamentos;

DROP POLICY IF EXISTS "department_capacity_user_select" ON public.department_capacity;
DROP POLICY IF EXISTS "department_capacity_user_insert" ON public.department_capacity;
DROP POLICY IF EXISTS "department_capacity_user_update" ON public.department_capacity;
DROP POLICY IF EXISTS "department_capacity_user_delete" ON public.department_capacity;

-- Also drop any authenticated_* policies if re-run
DROP POLICY IF EXISTS "authenticated_select_imports" ON public.imports;
DROP POLICY IF EXISTS "authenticated_insert_imports" ON public.imports;
DROP POLICY IF EXISTS "authenticated_update_imports" ON public.imports;
DROP POLICY IF EXISTS "authenticated_delete_imports" ON public.imports;

DROP POLICY IF EXISTS "authenticated_select_support_records" ON public.support_records;
DROP POLICY IF EXISTS "authenticated_insert_support_records" ON public.support_records;
DROP POLICY IF EXISTS "authenticated_update_support_records" ON public.support_records;
DROP POLICY IF EXISTS "authenticated_delete_support_records" ON public.support_records;

DROP POLICY IF EXISTS "authenticated_select_mapeamentos" ON public.mapeamentos;
DROP POLICY IF EXISTS "authenticated_insert_mapeamentos" ON public.mapeamentos;
DROP POLICY IF EXISTS "authenticated_update_mapeamentos" ON public.mapeamentos;
DROP POLICY IF EXISTS "authenticated_delete_mapeamentos" ON public.mapeamentos;

DROP POLICY IF EXISTS "authenticated_select_department_capacity" ON public.department_capacity;
DROP POLICY IF EXISTS "authenticated_insert_department_capacity" ON public.department_capacity;
DROP POLICY IF EXISTS "authenticated_update_department_capacity" ON public.department_capacity;
DROP POLICY IF EXISTS "authenticated_delete_department_capacity" ON public.department_capacity;

-- 2. CREATE team-wide policies for authenticated users
-- imports
CREATE POLICY "authenticated_select_imports" ON public.imports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_imports" ON public.imports
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_imports" ON public.imports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_imports" ON public.imports
  FOR DELETE TO authenticated USING (true);

-- support_records
CREATE POLICY "authenticated_select_support_records" ON public.support_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_support_records" ON public.support_records
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_support_records" ON public.support_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_support_records" ON public.support_records
  FOR DELETE TO authenticated USING (true);

-- mapeamentos
CREATE POLICY "authenticated_select_mapeamentos" ON public.mapeamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_mapeamentos" ON public.mapeamentos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_mapeamentos" ON public.mapeamentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_mapeamentos" ON public.mapeamentos
  FOR DELETE TO authenticated USING (true);

-- department_capacity
CREATE POLICY "authenticated_select_department_capacity" ON public.department_capacity
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_department_capacity" ON public.department_capacity
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_department_capacity" ON public.department_capacity
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_department_capacity" ON public.department_capacity
  FOR DELETE TO authenticated USING (true);

-- 3. Adjust UNIQUE constraints and indexes for shared team data
-- department_capacity: unico por departamento (não por user_id, departamento)
ALTER TABLE public.department_capacity DROP CONSTRAINT IF EXISTS department_capacity_user_departamento_unique;
DROP INDEX IF EXISTS public.department_capacity_user_departamento_unique;
CREATE UNIQUE INDEX IF NOT EXISTS department_capacity_departamento_unique ON public.department_capacity USING btree (departamento);

-- mapeamentos: unico por nome
ALTER TABLE public.mapeamentos DROP CONSTRAINT IF EXISTS mapeamentos_user_nome_unique;
DROP INDEX IF EXISTS public.mapeamentos_user_nome_unique;
CREATE UNIQUE INDEX IF NOT EXISTS mapeamentos_nome_unique ON public.mapeamentos USING btree (nome);

-- support_records: unico por numero (se numero não for nulo)
ALTER TABLE public.support_records DROP CONSTRAINT IF EXISTS support_records_user_id_numero_key;
DROP INDEX IF EXISTS public.support_records_user_id_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS support_records_numero_unique ON public.support_records USING btree (numero);

-- 4. Update get_departamentos_em_uso function to return all departments across support_records
CREATE OR REPLACE FUNCTION public.get_departamentos_em_uso()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT DISTINCT departamento
  FROM public.support_records
  WHERE departamento IS NOT NULL
    AND departamento <> ''
  ORDER BY 1;
$$;

-- 5. Create saved_reports table
CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on saved_reports
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Policies for saved_reports
DROP POLICY IF EXISTS "authenticated_select_saved_reports" ON public.saved_reports;
CREATE POLICY "authenticated_select_saved_reports" ON public.saved_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_saved_reports" ON public.saved_reports;
CREATE POLICY "authenticated_insert_saved_reports" ON public.saved_reports
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_saved_reports" ON public.saved_reports;
CREATE POLICY "authenticated_update_saved_reports" ON public.saved_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_saved_reports" ON public.saved_reports;
CREATE POLICY "authenticated_delete_saved_reports" ON public.saved_reports
  FOR DELETE TO authenticated USING (true);

-- Index for ordering saved_reports
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_at ON public.saved_reports USING btree (created_at DESC);
