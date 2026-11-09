-- Migration para cadastrar e atualizar as metas de benchmark do departamento Campo (Field Service)
-- TMA 180 a 270 min (3h a 4h30min), Produtividade 1.2 a 1.8 chamados/dia/técnico, Ocupação direta em tickets 70% a 80%

-- 1. Se o departamento Campo já existir na tabela department_capacity, atualiza suas faixas de metas
UPDATE public.department_capacity
SET
  meta_tma_min = 180,
  meta_tma_min_num = 180,
  meta_tma_max_num = 270,
  meta_chamados_dia = 1.5,
  meta_chamados_dia_min = 1.2,
  meta_chamados_dia_max = 1.8,
  meta_ocupacao_min = 70,
  meta_ocupacao_max = 80
WHERE departamento IN ('Campo', 'Field Service', '04. Campo');

-- 2. Se o departamento Campo não existir para os usuários já cadastrados na base, insere com os valores padrão
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.department_capacity
      WHERE user_id = u.id AND departamento = 'Campo'
    ) THEN
      INSERT INTO public.department_capacity (
        user_id,
        departamento,
        qtd_tecnicos,
        dias_uteis,
        limite_diario,
        meta_tma_min,
        meta_tma_min_num,
        meta_tma_max_num,
        meta_chamados_dia,
        meta_chamados_dia_min,
        meta_chamados_dia_max,
        meta_ocupacao_min,
        meta_ocupacao_max
      ) VALUES (
        u.id,
        'Campo',
        5,
        22,
        8,
        180,
        180,
        270,
        1.5,
        1.2,
        1.8,
        70,
        80
      )
      ON CONFLICT (user_id, departamento) DO NOTHING;
    END IF;
  END LOOP;
END $$;
