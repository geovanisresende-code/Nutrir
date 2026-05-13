
-- Primeiro removemos duplicatas mantendo o registro mais antigo
DELETE FROM nutrir_formula_regra a
USING nutrir_formula_regra b
WHERE a.id > b.id
  AND a.formula_codigo = b.formula_codigo
  AND a.nivel = b.nivel
  AND a.ordem = b.ordem
  AND a.materia_prima_nome = b.materia_prima_nome;

-- Agora podemos adicionar a constraint única
ALTER TABLE nutrir_formula_regra
  ADD CONSTRAINT nutrir_formula_regra_uq UNIQUE (formula_codigo, nivel, ordem, materia_prima_nome);
