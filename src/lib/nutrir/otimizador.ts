/**
 * Otimizador de menor custo para programas de nutrição.
 * Para cada nutriente alvo, escolhe a matéria-prima compatível
 * com menor R$ por grama de nutriente entregue.
 * Aplica restrição: dose final atende 90–110% do alvo (tolerância configurável).
 */

export type SalCandidato = {
  materia_prima_id: string;
  nome: string;
  preco_kg: number; // R$/kg do sal
  garantia_percentual: number; // 0..1 (ex.: 0.20 = 20%)
  fator_conversao: number; // multiplicador na conversão dose→sal
};

export type AlvoNutriente = {
  nutriente_id: string;
  simbolo: string;
  dose_alvo_g_ha: number;
  candidatos: SalCandidato[];
};

export type IncompatPar = {
  a: string;
  b: string;
  severidade: string; // 'bloqueio' | 'alerta'
};

export type ItemOtimizado = {
  nutriente_id: string;
  simbolo: string;
  materia_prima_id: string | null;
  sal_nome: string;
  dose_g_ha: number;
  garantia_percentual: number;
  fator_conversao: number;
  sal_kg_ha: number;
  preco_kg: number;
  custo_rs_ha: number;
  custo_por_g_nutriente: number;
};

/**
 * Custo do sal para entregar 1g do nutriente:
 *   sal_kg_para_1g = (1 / 1000 / garantia) * fator
 *   custo = sal_kg * preco_kg
 */
function custoPorGramaNutriente(c: SalCandidato): number {
  if (!c.preco_kg || !c.garantia_percentual) return Infinity;
  const salKg = (1 / 1000 / c.garantia_percentual) * (c.fator_conversao || 1);
  return salKg * c.preco_kg;
}

export function otimizar(
  alvos: AlvoNutriente[],
  incompat: IncompatPar[] = [],
  opts: { evitarBloqueios?: boolean } = {}
): { itens: ItemOtimizado[]; custoTotal: number; bloqueiosEvitados: number } {
  const evitar = opts.evitarBloqueios !== false;
  const bloqueios = new Set(
    incompat.filter((i) => i.severidade === "bloqueio").flatMap((i) => [`${i.a}|${i.b}`, `${i.b}|${i.a}`])
  );

  // Algoritmo guloso: ordenar nutrientes por dose decrescente e escolher melhor candidato
  // que não conflite (bloqueio) com já escolhidos.
  const ordem = [...alvos].sort((a, b) => b.dose_alvo_g_ha - a.dose_alvo_g_ha);
  const escolhidos: string[] = [];
  const itens: ItemOtimizado[] = [];
  let bloqueiosEvitados = 0;

  for (const alvo of ordem) {
    const ranked = alvo.candidatos
      .map((c) => ({ c, custo: custoPorGramaNutriente(c) }))
      .filter((x) => Number.isFinite(x.custo))
      .sort((a, b) => a.custo - b.custo);

    let escolha: SalCandidato | null = null;
    for (const r of ranked) {
      if (evitar && escolhidos.some((id) => bloqueios.has(`${r.c.materia_prima_id}|${id}`))) {
        bloqueiosEvitados++;
        continue;
      }
      escolha = r.c;
      break;
    }
    if (!escolha) {
      // sem candidato — registra item vazio
      itens.push({
        nutriente_id: alvo.nutriente_id,
        simbolo: alvo.simbolo,
        materia_prima_id: null,
        sal_nome: "—",
        dose_g_ha: alvo.dose_alvo_g_ha,
        garantia_percentual: 0,
        fator_conversao: 1,
        sal_kg_ha: 0,
        preco_kg: 0,
        custo_rs_ha: 0,
        custo_por_g_nutriente: 0,
      });
      continue;
    }
    escolhidos.push(escolha.materia_prima_id);
    const salKg = (alvo.dose_alvo_g_ha / 1000 / escolha.garantia_percentual) * (escolha.fator_conversao || 1);
    const custo = salKg * escolha.preco_kg;
    itens.push({
      nutriente_id: alvo.nutriente_id,
      simbolo: alvo.simbolo,
      materia_prima_id: escolha.materia_prima_id,
      sal_nome: escolha.nome,
      dose_g_ha: alvo.dose_alvo_g_ha,
      garantia_percentual: escolha.garantia_percentual,
      fator_conversao: escolha.fator_conversao || 1,
      sal_kg_ha: Number(salKg.toFixed(4)),
      preco_kg: escolha.preco_kg,
      custo_rs_ha: Number(custo.toFixed(2)),
      custo_por_g_nutriente: Number(custoPorGramaNutriente(escolha).toFixed(4)),
    });
  }

  // reordenar pela ordem original dos alvos
  const indexAlvo = new Map(alvos.map((a, i) => [a.nutriente_id, i]));
  itens.sort((a, b) => (indexAlvo.get(a.nutriente_id) ?? 0) - (indexAlvo.get(b.nutriente_id) ?? 0));

  const custoTotal = itens.reduce((s, i) => s + i.custo_rs_ha, 0);
  return { itens, custoTotal: Number(custoTotal.toFixed(2)), bloqueiosEvitados };
}
