INSERT INTO public.nutrir_culturas (nome, nome_cientifico, categoria, ciclo_dias, ativo)
VALUES
  ('Beterraba', 'Beta vulgaris', 'Anual', 90, true),
  ('Brócolis', 'Brassica oleracea var. italica', 'Anual', 100, true)
ON CONFLICT (nome) DO NOTHING;