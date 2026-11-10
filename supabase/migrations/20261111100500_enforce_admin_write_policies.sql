-- Migration: Políticas RLS para reforçar restrição de escrita apenas para Admin
-- Colaboradores podem LER todas as tabelas (support_records, imports, mapeamentos, department_capacity, saved_reports)
-- Somente administradores (public.is_admin()) podem INSERIR, ATUALIZAR ou EXCLUIR dados.

-- 1. imports
DROP POLICY IF EXISTS "authenticated_insert_imports" ON public.imports;
DROP POLICY IF EXISTS "authenticated_update_imports" ON public.imports;
DROP POLICY IF EXISTS "authenticated_delete_imports" ON public.imports;

CREATE POLICY "admin_insert_imports"
  ON public.imports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_imports"
  ON public.imports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_imports"
  ON public.imports
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 2. support_records
DROP POLICY IF EXISTS "authenticated_insert_support_records" ON public.support_records;
DROP POLICY IF EXISTS "authenticated_update_support_records" ON public.support_records;
DROP POLICY IF EXISTS "authenticated_delete_support_records" ON public.support_records;

CREATE POLICY "admin_insert_support_records"
  ON public.support_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_support_records"
  ON public.support_records
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_support_records"
  ON public.support_records
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 3. mapeamentos
DROP POLICY IF EXISTS "authenticated_insert_mapeamentos" ON public.mapeamentos;
DROP POLICY IF EXISTS "authenticated_update_mapeamentos" ON public.mapeamentos;
DROP POLICY IF EXISTS "authenticated_delete_mapeamentos" ON public.mapeamentos;

CREATE POLICY "admin_insert_mapeamentos"
  ON public.mapeamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_mapeamentos"
  ON public.mapeamentos
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_mapeamentos"
  ON public.mapeamentos
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. department_capacity
DROP POLICY IF EXISTS "authenticated_insert_department_capacity" ON public.department_capacity;
DROP POLICY IF EXISTS "authenticated_update_department_capacity" ON public.department_capacity;
DROP POLICY IF EXISTS "authenticated_delete_department_capacity" ON public.department_capacity;

CREATE POLICY "admin_insert_department_capacity"
  ON public.department_capacity
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_department_capacity"
  ON public.department_capacity
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_department_capacity"
  ON public.department_capacity
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. saved_reports
DROP POLICY IF EXISTS "authenticated_insert_saved_reports" ON public.saved_reports;
DROP POLICY IF EXISTS "authenticated_update_saved_reports" ON public.saved_reports;
DROP POLICY IF EXISTS "authenticated_delete_saved_reports" ON public.saved_reports;

CREATE POLICY "admin_insert_saved_reports"
  ON public.saved_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_saved_reports"
  ON public.saved_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_saved_reports"
  ON public.saved_reports
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
