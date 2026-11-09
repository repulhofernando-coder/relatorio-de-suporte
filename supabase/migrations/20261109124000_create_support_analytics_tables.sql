-- Migration: Create support_records, imports, and mapeamentos tables with RLS and seed user
-- Idempotent script

-- 1. Create imports table
CREATE TABLE IF NOT EXISTS public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  importadas INTEGER NOT NULL DEFAULT 0,
  ignoradas INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'concluído',
  mapeamento_nome TEXT,
  detalhes_erro JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create support_records table
CREATE TABLE IF NOT EXISTS public.support_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL,
  tecnico TEXT NOT NULL,
  data_chamado DATE NOT NULL,
  tipo_chamado TEXT,
  tempo_atendimento_min INTEGER,
  prioridade TEXT,
  observacoes TEXT,
  origem_arquivo TEXT,
  import_id UUID REFERENCES public.imports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for support_records
CREATE INDEX IF NOT EXISTS idx_support_records_user_data ON public.support_records(user_id, data_chamado);
CREATE INDEX IF NOT EXISTS idx_support_records_user_cliente ON public.support_records(user_id, cliente);
CREATE INDEX IF NOT EXISTS idx_support_records_user_tecnico ON public.support_records(user_id, tecnico);
CREATE INDEX IF NOT EXISTS idx_support_records_import_id ON public.support_records(import_id);

-- 3. Create mapeamentos table
CREATE TABLE IF NOT EXISTS public.mapeamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  mapeamento JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mapeamentos_user_nome_unique UNIQUE (user_id, nome)
);

-- Enable RLS
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapeamentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for imports
DROP POLICY IF EXISTS "imports_user_select" ON public.imports;
CREATE POLICY "imports_user_select" ON public.imports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "imports_user_insert" ON public.imports;
CREATE POLICY "imports_user_insert" ON public.imports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "imports_user_update" ON public.imports;
CREATE POLICY "imports_user_update" ON public.imports
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "imports_user_delete" ON public.imports;
CREATE POLICY "imports_user_delete" ON public.imports
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for support_records
DROP POLICY IF EXISTS "support_records_user_select" ON public.support_records;
CREATE POLICY "support_records_user_select" ON public.support_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "support_records_user_insert" ON public.support_records;
CREATE POLICY "support_records_user_insert" ON public.support_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_records_user_update" ON public.support_records;
CREATE POLICY "support_records_user_update" ON public.support_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_records_user_delete" ON public.support_records;
CREATE POLICY "support_records_user_delete" ON public.support_records
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for mapeamentos
DROP POLICY IF EXISTS "mapeamentos_user_select" ON public.mapeamentos;
CREATE POLICY "mapeamentos_user_select" ON public.mapeamentos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mapeamentos_user_insert" ON public.mapeamentos;
CREATE POLICY "mapeamentos_user_insert" ON public.mapeamentos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mapeamentos_user_update" ON public.mapeamentos;
CREATE POLICY "mapeamentos_user_update" ON public.mapeamentos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mapeamentos_user_delete" ON public.mapeamentos;
CREATE POLICY "mapeamentos_user_delete" ON public.mapeamentos
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Seed initial user if not exists
DO $$
DECLARE
  seed_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'projetos@mundoopen.com.br') THEN
    seed_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      seed_user_id,
      '00000000-0000-0000-0000-000000000000',
      'projetos@mundoopen.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Mundo Open"}',
      false, 'authenticated', 'authenticated',
      '',
      '',
      '',
      '',
      '',
      NULL,
      '',
      '',
      ''
    );
  END IF;
END $$;
