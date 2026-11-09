-- Adiciona a coluna "assunto" (título curto do chamado) em support_records.
-- Nullable: registros importados antes desta versão ficam sem assunto (exibidos como "—").

alter table public.support_records
  add column if not exists assunto text;

comment on column public.support_records.assunto is
  'Assunto/título curto do chamado, vindo da planilha; nulo em registros antigos';
