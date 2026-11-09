-- Migration para corrigir a função public.admin_create_user
-- Em versões recentes do Supabase Auth, a coluna auth.users.confirmed_at é uma coluna GERADA
-- (GENERATED ALWAYS AS LEAST(email_confirmed_at, phone_confirmed_at) STORED).
-- Tentar inserir um valor não-DEFAULT nela resulta em erro Postgres 428C9.
-- Removendo confirmed_at da lista de colunas no INSERT, permitindo que seja gerada automaticamente
-- a partir de email_confirmed_at = now().

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_nome text DEFAULT NULL
)
RETURNS uuid
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

  v_clean_email := lower(trim(p_email));
  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
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
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', v_clean_name),
    now(),
    now(),
    false,
    '',   -- confirmation_token: vazio, nunca NULL
    '',   -- recovery_token: vazio, nunca NULL
    '',   -- email_change_token_new: vazio, nunca NULL
    '',   -- email_change: vazio, nunca NULL
    '',   -- email_change_token_current: vazio, nunca NULL
    NULL, -- phone: NULL devido à restrição unique
    '',   -- phone_change: vazio, nunca NULL
    '',   -- phone_change_token: vazio, nunca NULL
    ''    -- reauthentication_token: vazio, nunca NULL
  );

  RETURN v_user_id;
END;
$$;

-- Permissões de execução: revoga acesso público / anônimo e garante apenas para authenticated
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO service_role;
