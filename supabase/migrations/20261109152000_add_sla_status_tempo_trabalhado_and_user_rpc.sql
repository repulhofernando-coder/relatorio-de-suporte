-- Migration: adicionar sla_status e tempo_trabalhado, constraint de unicidade para upsert, e funções de gestão de usuários
-- Data: 2026-11-09

-- 1. Colunas novas em public.support_records
ALTER TABLE public.support_records
  ADD COLUMN IF NOT EXISTS sla_status text,
  ADD COLUMN IF NOT EXISTS tempo_trabalhado numeric;

-- Adicionar índice para filtros e agregações
CREATE INDEX IF NOT EXISTS idx_support_records_user_sla_status
  ON public.support_records USING btree (user_id, sla_status);

CREATE INDEX IF NOT EXISTS idx_support_records_user_tempo_trabalhado
  ON public.support_records USING btree (user_id, tempo_trabalhado);

-- 2. Restrição UNIQUE em (user_id, numero) para suportar ON CONFLICT (user_id, numero) DO UPDATE
-- Como a tabela tem 9636 registros e todos têm número único para o mesmo user_id, podemos criar uma constraint única formal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.support_records'::regclass
      AND conname = 'support_records_user_id_numero_key'
  ) THEN
    ALTER TABLE public.support_records
      ADD CONSTRAINT support_records_user_id_numero_key UNIQUE (user_id, numero);
  END IF;
END $$;

-- 3. Função para listar usuários do sistema (apenas para usuários autenticados)
CREATE OR REPLACE FUNCTION public.list_system_users()
RETURNS TABLE (
  id uuid,
  email varchar,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Permite apenas chamadas de usuários autenticados
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::text AS name
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_system_users() TO authenticated;

-- 4. Função para criar um novo usuário no auth.users com confirmação imediata
CREATE OR REPLACE FUNCTION public.create_system_user(
  new_email text,
  new_password text,
  new_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
  v_clean_email text;
  v_clean_name text;
BEGIN
  -- Permite apenas usuários autenticados chamarem
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: faça login para criar novos usuários';
  END IF;

  v_clean_email := lower(trim(new_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;

  IF new_password IS NULL OR length(new_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Verifica se o e-mail já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado no sistema';
  END IF;

  v_clean_name := trim(COALESCE(new_name, split_part(v_clean_email, '@', 1)));
  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(new_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pw,
    now(),
    now(),
    NULL,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', v_clean_name),
    now(),
    now(),
    false
  );

  RETURN jsonb_build_object(
    'id', v_user_id,
    'email', v_clean_email,
    'name', v_clean_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_system_user(text, text, text) TO authenticated;
