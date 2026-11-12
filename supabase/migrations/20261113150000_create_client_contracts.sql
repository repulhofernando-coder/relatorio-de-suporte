-- Migration: Contratos de horas por cliente (client_contracts)
-- Cada contrato: cliente (nome tolerante), horas contratadas (mensal), se é
-- cumulativo e, se for, o período em meses (nullable — vazio quando não for).
-- RLS: leitura para autenticados, escrita somente admin (padrão das outras tabelas).

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  horas_contratadas numeric NOT NULL CHECK (horas_contratadas > 0),
  cumulativo boolean NOT NULL DEFAULT false,
  periodo_meses integer CHECK (periodo_meses IS NULL OR periodo_meses > 0),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um contrato ativo por cliente: recriar um contrato para o mesmo cliente
-- substitui o anterior (upsert por cliente, ignorando maiúsculas/minúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS client_contracts_cliente_norm_unique
  ON public.client_contracts (lower(trim(cliente)));

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_client_contracts" ON public.client_contracts;
CREATE POLICY "authenticated_select_client_contracts"
  ON public.client_contracts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_insert_client_contracts" ON public.client_contracts;
CREATE POLICY "admin_insert_client_contracts"
  ON public.client_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_client_contracts" ON public.client_contracts;
CREATE POLICY "admin_update_client_contracts"
  ON public.client_contracts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_client_contracts" ON public.client_contracts;
CREATE POLICY "admin_delete_client_contracts"
  ON public.client_contracts
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
