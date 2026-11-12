-- ============================================================
-- IMPORTAÇÃO DE HORAS TRABALHADAS (relatório "Tempo trabalhado
-- nos tickets" do Movidesk)
-- Tabela própria time_logs — não mistura com support_records.
-- ============================================================

-- 1. Tabela de lançamentos de horas
create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_id uuid not null references public.imports (id) on delete cascade,
  numero_ticket text,
  cliente text,
  tecnico text,
  departamento text,
  data_lancamento date,
  minutos integer not null default 0,
  horas_total_chamado numeric(12, 2),
  eh_total_chamado boolean not null default false,
  status text,
  extras jsonb not null default '{}'::jsonb,
  origem_arquivo text,
  created_at timestamptz not null default now()
);

create index if not exists time_logs_import_id_idx on public.time_logs (import_id);
create index if not exists time_logs_cliente_idx on public.time_logs (cliente);
create index if not exists time_logs_tecnico_idx on public.time_logs (tecnico);
create index if not exists time_logs_data_lancamento_idx on public.time_logs (data_lancamento);
create index if not exists time_logs_numero_ticket_idx on public.time_logs (numero_ticket);

-- 2. RLS: mesmos padrões das demais tabelas (dados compartilhados entre
--    usuários autenticados; escrita apenas admin via user_profiles)
alter table public.time_logs enable row level security;

drop policy if exists "time_logs_select_authenticated" on public.time_logs;
create policy "time_logs_select_authenticated" on public.time_logs
  for select to authenticated using (true);

drop policy if exists "time_logs_insert_admin" on public.time_logs;
create policy "time_logs_insert_admin" on public.time_logs
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "time_logs_delete_admin" on public.time_logs;
create policy "time_logs_delete_admin" on public.time_logs
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- 3. imports ganha coluna tipo ('chamados' | 'horas') — default 'chamados'
--    para não afetar as importações já existentes.
alter table public.imports add column if not exists tipo text not null default 'chamados';
