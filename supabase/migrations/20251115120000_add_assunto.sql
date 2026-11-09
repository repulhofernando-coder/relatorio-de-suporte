-- Campo "Assunto": título curto do chamado (nullable).
-- (Os mapeamentos salvos são jsonb campo_padrao -> coluna, então o novo campo
--  "assunto" entra como chave nova no jsonb, sem mudança de estrutura.)
alter table public.support_records
  add column if not exists assunto text;
