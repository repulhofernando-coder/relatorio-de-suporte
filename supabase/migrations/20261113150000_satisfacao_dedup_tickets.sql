-- Deduplicação de satisfaction_responses: 1 avaliação (linha) por tíquete.
-- Chave: somente os dígitos de numero_ticket. Linhas sem tíquete não são tocadas.
-- Na linha mantida: prefere a que já tem comentário, depois a mais antiga.
-- Os comentários distintos do mesmo tíquete são unidos na linha mantida.
-- Idempotente: depois da primeira execução não há grupos duplicados e nada muda.

-- 1. Une os comentários distintos de cada tíquete na linha mantida
with b as (
  select id, created_at, comentario,
         regexp_replace(numero_ticket, '\D', '', 'g') as k
  from public.satisfaction_responses
  where regexp_replace(coalesce(numero_ticket, ''), '\D', '', 'g') <> ''
),
keeper as (
  select distinct on (k) id, k
  from b
  order by k, (comentario is null or btrim(comentario) = ''), created_at, id
),
juntados as (
  select k, string_agg(c, E'\n\n' order by c) as texto
  from (
    select distinct k, btrim(comentario) as c
    from b
    where comentario is not null and btrim(comentario) <> ''
  ) x
  group by k
)
update public.satisfaction_responses s
set comentario = j.texto
from keeper kp
join juntados j on j.k = kp.k
where s.id = kp.id
  and s.comentario is distinct from j.texto;

-- 2. Remove as demais linhas dos tíquetes duplicados
with b as (
  select id, created_at, comentario,
         regexp_replace(numero_ticket, '\D', '', 'g') as k
  from public.satisfaction_responses
  where regexp_replace(coalesce(numero_ticket, ''), '\D', '', 'g') <> ''
),
keeper as (
  select distinct on (k) id, k
  from b
  order by k, (comentario is null or btrim(comentario) = ''), created_at, id
)
delete from public.satisfaction_responses s
where s.id in (select id from b)
  and s.id not in (select id from keeper);
