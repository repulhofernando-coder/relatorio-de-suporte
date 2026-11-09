-- Migration: função RPC para listar todos os departamentos distintos em uso
-- pelo usuário, sem o corte de 1.000 linhas do PostgREST.
-- Filtra por auth.uid() internamente (RLS continua valendo na tabela).

CREATE OR REPLACE FUNCTION public.get_departamentos_em_uso()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT departamento
  FROM public.support_records
  WHERE user_id = auth.uid()
    AND departamento IS NOT NULL
    AND departamento <> ''
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_departamentos_em_uso() TO authenticated;
