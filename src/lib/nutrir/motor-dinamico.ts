// Motor de cálculo dinâmico — lê fórmulas e regras do banco (nutrir_formula_cabecalho + nutrir_formula_regra)
// Substitui motores hardcoded permitindo edição livre via UI Fontes & Fórmulas
import { supabase } from "@/integrations/supabase/client";

export type RegraDB = {
  id: string;
  formula_codigo: string;
  nivel: string;
  ordem: number;
  materia_prima_nome: string;
  materia_prima_id: string | null;
  tipo_calculo: "PCT_BASE" | "DOSE_FIXA" | "COMPLEXADOR" | "DILUENTE" | string;
  base_calculo: "BATIDA_KG" | "VOLUME_L" | "SAIS_KG" | string | null;
  percentual: number;
  dose_valor: number | null;
  unidade: string;
  fator_diluicao: number;
  fator_complex_l_kg: number;
  complexante_nome: string | null;
};

export type CabecalhoDB = {
  id: string;
  formula_codigo: string;
  titulo: string;
  nivel: string;
  volume_batida_padrao_l: number;
  fator_diluicao: number;
  auto_ajuste_limite: boolean;
  ativa_calculadora: boolean;
};

export type ItemCalculado = {
  ordem: number;
  materia_prima: string;
  quantidade: number;
  unidade: string;
  tipo: string;
  custo?: number;
};

export type ResultadoCalculo = {
  formula: string;
  titulo: string;
  volume_total_l: number;
  total_sais_kg: number;
  total_complexador_l: number;
  itens: ItemCalculado[];
  observacoes: string[];
};

export async function listarFormulasAtivas(): Promise<CabecalhoDB[]> {
  const { data } = await supabase
    .from("nutrir_formula_cabecalho")
    .select("*")
    .eq("ativa_calculadora", true)
    .eq("status", "publicada")
    .order("formula_codigo");
  return (data as any) || [];
}

export async function carregarRegras(formula_codigo: string, nivel = "padrao"): Promise<RegraDB[]> {
  const { data } = await supabase
    .from("nutrir_formula_regra")
    .select("*")
    .eq("formula_codigo", formula_codigo)
    .eq("nivel", nivel)
    .eq("ativo", true)
    .order("ordem");
  return (data as any) || [];
}

/**
 * Calcula uma batida usando regras do banco.
 * @param cab cabeçalho da fórmula
 * @param regras regras ativas (ordem importa)
 * @param volume_l volume desejado (default = batida padrão)
 * @param precoMP map { materia_prima_nome: preco_kg }
 */
export function calcularBatida(
  cab: CabecalhoDB,
  regras: RegraDB[],
  volume_l?: number,
  precoMP: Record<string, number> = {}
): ResultadoCalculo {
  const VOL = volume_l && volume_l > 0 ? volume_l : cab.volume_batida_padrao_l;
  // Base inicial estimada: assume batida (kg sais) ~ VOL * fator_diluicao_global
  // Iteração: primeiro calcula sais (PCT_BASE), depois complexador (sobre sais), depois diluente (água)
  const itens: ItemCalculado[] = [];
  const obs: string[] = [];

  // Passo 1: regras de sais (PCT_BASE / DOSE_FIXA)
  let totalSais = 0;
  const baseInicial = VOL; // usaremos VOL como base provisória; refinaremos
  for (const r of regras) {
    if (r.tipo_calculo === "PCT_BASE") {
      let base = baseInicial;
      if (r.base_calculo === "VOLUME_L") base = VOL;
      const qtd = (base * (r.percentual || 0)) / 100;
      itens.push({ ordem: r.ordem, materia_prima: r.materia_prima_nome, quantidade: qtd, unidade: r.unidade, tipo: r.tipo_calculo });
      if (r.unidade === "kg" || r.unidade === "g") totalSais += r.unidade === "g" ? qtd / 1000 : qtd;
    } else if (r.tipo_calculo === "DOSE_FIXA") {
      const qtd = r.dose_valor || 0;
      itens.push({ ordem: r.ordem, materia_prima: r.materia_prima_nome, quantidade: qtd, unidade: r.unidade, tipo: r.tipo_calculo });
      if (r.unidade === "kg") totalSais += qtd;
      if (r.unidade === "g") totalSais += qtd / 1000;
    }
  }

  // Passo 2: complexadores (sobre soma de sais)
  let totalComplex = 0;
  for (const r of regras) {
    if (r.tipo_calculo === "COMPLEXADOR") {
      const qtd = totalSais * (r.fator_complex_l_kg || 0);
      itens.push({ ordem: r.ordem, materia_prima: r.materia_prima_nome, quantidade: qtd, unidade: "L", tipo: r.tipo_calculo });
      totalComplex += qtd;
    }
  }

  // Passo 3: diluente (água) — completa volume
  for (const r of regras) {
    if (r.tipo_calculo === "DILUENTE") {
      // volume final = VOL → água = VOL - totalSais(L equiv) - totalComplex
      // simplificação: 1 kg sal ≈ 0.6 L, mas por padrão assume volume adicionado igual ao kg em L (densidade ~1)
      const ocupado = totalSais + totalComplex;
      const agua = Math.max(VOL - ocupado, 0);
      itens.push({ ordem: r.ordem, materia_prima: r.materia_prima_nome || "Água", quantidade: agua, unidade: "L", tipo: r.tipo_calculo });
    }
  }

  // Custo
  let custoTotal = 0;
  itens.forEach((i) => {
    const preco = precoMP[i.materia_prima] || 0;
    const qtdKgOuL = i.unidade === "g" ? i.quantidade / 1000 : i.quantidade;
    i.custo = preco * qtdKgOuL;
    custoTotal += i.custo;
  });

  // Auto-ajuste limite (40% sais por padrão)
  if (cab.auto_ajuste_limite) {
    const limite = VOL * 0.4;
    if (totalSais > limite) obs.push(`⚠️ Sais (${totalSais.toFixed(1)} kg) acima de 40% do volume — considere reduzir doses.`);
  }

  itens.sort((a, b) => a.ordem - b.ordem);

  return {
    formula: cab.formula_codigo,
    titulo: cab.titulo,
    volume_total_l: VOL,
    total_sais_kg: totalSais,
    total_complexador_l: totalComplex,
    itens,
    observacoes: obs,
  };
}
