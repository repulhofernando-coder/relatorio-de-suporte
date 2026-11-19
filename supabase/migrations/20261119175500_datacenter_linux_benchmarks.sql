-- Benchmarks do Datacenter Linux: quadro oficial da gestão ("Quadro Atualizado:
-- Datacenter Linux (60 Chamados / 2 Técnicos)", cenário Ideal N2/N3 Cloud).
-- Alinha a linha 'Datacenter: Linux' em department_capacity (grafia real do
-- banco, com dois-pontos) com os limites do quadro: 2 técnicos, produtividade
-- 1,2–2,0 chamados/dia por técnico (≈ volume 50–80 ch/mês para 2 técnicos,
-- 22 dias úteis). Ocupação segue o padrão de datacenter (65–75%). TMA geral
-- permanece a levantar pela gestão (meta_tma_* NULL).

UPDATE public.department_capacity
SET
  qtd_tecnicos = 2,
  meta_chamados_dia_min = 1.2,
  meta_chamados_dia_max = 2.0,
  meta_ocupacao_min = 65,
  meta_ocupacao_max = 75,
  updated_at = NOW()
WHERE lower(trim(departamento)) = 'datacenter: linux';
