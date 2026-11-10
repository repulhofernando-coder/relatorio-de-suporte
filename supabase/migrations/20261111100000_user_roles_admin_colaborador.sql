-- Migration: Perfis de acesso (admin e colaborador)
-- 1. Cria tabela public.user_profiles para armazenar o perfil de cada usuário (admin / colaborador)
-- 2. Preenche os usuários já existentes na auth.users como 'admin'
-- 3. Atualiza list_system_users() para retornar o campo role ('admin' | 'colaborador')
-- 4. Atualiza admin_create_user(p_email, p_password, p_nome, p_role) com suporte a perfil
-- 5. Cria admin_update_user_role(p_target_user_id, p_new_role) para promover/demover
-- 6. Cria função auxiliar public.is_admin() e ajusta RLS de escrita para exigir admin

-- Criação da tabela de perfis
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'colaborador' CHECK (role IN ('admin', 'colaborador')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Ativa RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado pode consultar perfis
DROP POLICY IF EXISTS "authenticated_select_user_profiles" ON public.user_profiles;
CREATE POLICY "authenticated_select_user_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserção/Atualização direta: apenas service_role ou funções security definer
-- Mas para robustez, criamos policies para authenticated se necessário
DROP POLICY IF EXISTS "authenticated_all_user_profiles" ON public.user_profiles;
CREATE POLICY "authenticated_all_user_profiles"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Popula os usuários existentes como 'admin' para garantir que ninguém perca acesso
INSERT INTO public.user_profiles (id, role, created_at, updated_at)
SELECT u.id, 'admin', COALESCE(u.created_at, now()), now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Sincroniza também no raw_app_meta_data / raw_user_meta_data dos usuários existentes
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE raw_user_meta_data->>'role' IS NULL OR raw_user_meta_data->>'role' = '';

-- Função auxiliar is_admin(user_id)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_role IS NOT NULL THEN
    RETURN v_role = 'admin';
  END IF;

  -- Fallback: verifica no metadata da auth.users
  SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role', 'admin') INTO v_role
  FROM auth.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_role = 'admin', true);
END;
$$;

-- Atualiza list_system_users para retornar a coluna role
DROP FUNCTION IF EXISTS public.list_system_users();
CREATE OR REPLACE FUNCTION public.list_system_users()
RETURNS TABLE(
  id uuid,
  email character varying,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  name text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::text AS name,
    COALESCE(p.role, u.raw_user_meta_data->>'role', 'admin')::text AS role
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Estende admin_create_user para aceitar p_role ('admin' | 'colaborador')
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text);
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_nome text DEFAULT NULL::text,
  p_role text DEFAULT 'colaborador'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
  v_clean_email text;
  v_clean_name text;
  v_clean_role text;
  v_caller_role text;
BEGIN
  -- Permite apenas usuários autenticados chamarem
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: faça login para criar novos usuários';
  END IF;

  -- Valida se quem está chamando é admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar usuários';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
  END IF;

  v_clean_role := lower(trim(COALESCE(p_role, 'colaborador')));
  IF v_clean_role NOT IN ('admin', 'colaborador') THEN
    v_clean_role := 'colaborador';
  END IF;

  -- Verifica se o e-mail já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
    RAISE EXCEPTION 'Este e-mail já está em uso';
  END IF;

  v_clean_name := trim(COALESCE(p_nome, split_part(v_clean_email, '@', 1)));
  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pw,
    now(),
    NULL,
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', v_clean_role),
    jsonb_build_object('name', v_clean_name, 'role', v_clean_role),
    now(),
    now(),
    false,
    '',   -- confirmation_token
    '',   -- recovery_token
    '',   -- email_change_token_new
    '',   -- email_change
    '',   -- email_change_token_current
    NULL, -- phone
    '',   -- phone_change
    '',   -- phone_change_token
    ''    -- reauthentication_token
  );

  -- Registra na tabela de perfis
  INSERT INTO public.user_profiles (id, role, created_at, updated_at)
  VALUES (v_user_id, v_clean_role, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  RETURN v_user_id;
END;
$$;

-- Função para admin alterar perfil de um usuário (promover/demover)
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_clean_role text;
  v_current_admins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar perfis de acesso';
  END IF;

  v_clean_role := lower(trim(p_new_role));
  IF v_clean_role NOT IN ('admin', 'colaborador') THEN
    RAISE EXCEPTION 'Perfil inválido. Escolha admin ou colaborador.';
  END IF;

  -- Se estiver tentando demover a si mesmo, garantir que resta pelo menos mais 1 admin
  IF auth.uid() = p_target_user_id AND v_clean_role = 'colaborador' THEN
    SELECT count(*) INTO v_current_admins
    FROM public.user_profiles
    WHERE role = 'admin' AND id <> auth.uid();

    IF v_current_admins = 0 THEN
      RAISE EXCEPTION 'Você não pode remover seu próprio perfil de administrador porque é o único admin ativo.';
    END IF;
  END IF;

  -- Atualiza na tabela user_profiles
  INSERT INTO public.user_profiles (id, role, created_at, updated_at)
  VALUES (p_target_user_id, v_clean_role, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = v_clean_role, updated_at = now();

  -- Atualiza no raw_user_meta_data / raw_app_meta_data da auth.users
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_clean_role),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_clean_role)
  WHERE id = p_target_user_id;

  RETURN v_clean_role;
END;
$$;
