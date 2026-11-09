-- Migration para registrar/atualizar metas padrão do departamento Linux
-- Departamento misto (Linux/infraestrutura, 7 especialistas, ~351 chamados/mês)
-- Metas: TMA 30–50 min, Produtividade 4–7 chamados/dia/técnico, Ocupação 65%–75%

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.department_capacity WHERE departamento = 'Linux') THEN
    UPDATE public.department_capacity
    SET
      qtd_tecnicos = COALESCE(qtd_tecnicos, 7),
      dias_uteis = COALESCE(dias_uteis, 22),
      limite_diario = 7,
      meta_tma_min = 30,
      meta_tma_min_num = 30,
      meta_tma_max_num = 50,
      meta_chamados_dia = 4,
      meta_chamados_dia_min = 4,
      meta_chamados_dia_max = 7,
      meta_ocupacao_min = 65,
      meta_ocupacao_max = 75,
      updated_at = NOW()
    WHERE departamento = 'Linux';
  ELSE
    INSERT INTO public.department_capacity (
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
      'Linux',
      7,
      22,
      7,
      30,
      30,
      50,
      4,
      4,
      7,
      65,
      75
    )
    ON CONFLICT (departamento) DO UPDATE SET
      meta_tma_min = EXCLUDED.meta_tma_min,
      meta_tma_min_num = EXCLUDED.meta_tma_min_num,
      meta_tma_max_num = EXCLUDED.meta_tma_max_num,
      meta_chamados_dia = EXCLUDED.meta_chamados_dia,
      meta_chamados_dia_min = EXCLUDED.meta_chamados_dia_min,
      meta_chamados_dia_max = EXCLUDED.meta_chamados_dia_max,
      meta_ocupacao_min = EXCLUDED.meta_ocupacao_min,
      meta_ocupacao_max = EXCLUDED.meta_ocupacao_max;
  END IF;
END $$;
