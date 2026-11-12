-- Respostas de pesquisa de satisfação (Movidesk), terceiro tipo de importação.
-- Escala: nota 3 = muito satisfeito, 2 = satisfeito, 1 = insatisfeito.
create table if not exists public.satisfaction_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  numero_ticket text,
  nota integer not null check (nota between 1 and 3),
  comentario text,
  tecnico text,
  cliente text,
  departamento text,
  data_resposta date,
  origem_arquivo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_satisfaction_numero_ticket
  on public.satisfaction_responses (numero_ticket);
create index if not exists idx_satisfaction_cliente
  on public.satisfaction_responses (cliente);
create index if not exists idx_satisfaction_tecnico
  on public.satisfaction_responses (tecnico);
create index if not exists idx_satisfaction_data_resposta
  on public.satisfaction_responses (data_resposta);

alter table public.satisfaction_responses enable row level security;

-- Leitura liberada para todos os autenticados (dados compartilhados, como chamados e horas)
create policy "authenticated_select_satisfaction_responses"
  on public.satisfaction_responses
  for select
  to authenticated
  using (true);

-- Escrita (insert) somente admin — importar satisfação é exclusivo de admin
create policy "admin_insert_satisfaction_responses"
  on public.satisfaction_responses
  for insert
  to authenticated
  with check (is_admin());

create policy "admin_update_satisfaction_responses"
  on public.satisfaction_responses
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "admin_delete_satisfaction_responses"
  on public.satisfaction_responses
  for delete
  to authenticated
  using (is_admin());
