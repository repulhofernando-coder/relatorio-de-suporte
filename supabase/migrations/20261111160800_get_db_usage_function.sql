-- Função de leitura de uso de espaço do banco (apenas tamanhos, sem dados).
-- Usada pelo card "Espaço utilizado" nas telas de importação.
CREATE OR REPLACE FUNCTION public.get_db_usage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_limit_bytes CONSTANT bigint := 500 * 1024 * 1024;
  v_total bigint;
  v_tables jsonb;
  v_imports jsonb;
BEGIN
  v_total := pg_database_size(current_database());

  SELECT COALESCE(jsonb_agg(t ORDER BY t.bytes DESC), '[]'::jsonb)
    INTO v_tables
  FROM (
    SELECT c.relname AS name,
           pg_total_relation_size(c.oid) AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  ) t;

  SELECT COALESCE(jsonb_object_agg(x.import_id::text, x.bytes), '{}'::jsonb)
    INTO v_imports
  FROM (
    SELECT s.import_id, SUM(pg_column_size(s.*))::bigint AS bytes
    FROM public.support_records s
    WHERE s.import_id IS NOT NULL
    GROUP BY s.import_id
  ) x;

  RETURN jsonb_build_object(
    'total_bytes', v_total,
    'limit_bytes', v_limit_bytes,
    'tables', v_tables,
    'imports', v_imports
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_db_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_db_usage() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_db_usage() TO authenticated;
