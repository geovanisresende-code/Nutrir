/**
 * Engine de cálculo unificada para Formulações e Programa NUTRIR.
 *
 * Fórmulas (extraídas da planilha CONTAS.FORM):
 *   sal_kg_ha    = dose_g_ha / (garantia_pct * 10)         // dose g/ha ÷ (% × 1000) × 100 = ÷ (% × 10)
 *   sal_total_kg = sal_kg_ha * area_ha
 *   sacos_25kg   = ROUND(sal_total_kg / saco_padrao_kg)
 *   custo_kg_ha  = sal_kg_ha * preco_kg
 *   custo_total  = sal_total_kg * preco_kg
 *   complex_l_ha = sal_kg_ha * fator_complexador_l_kg_sal
 *
 * Atendimento(%) = (contribuição_real / alvo) × 100
 */

export interface MateriaPrimaInfo {
  id: string;
  nome: string;
  preco_kg: number;
  /** garantias por nutriente_id -> teor% */
  garantias: Record<string, number>;
}

export interface NutrienteAlvo {
  nutriente_id: string;
  simbolo: string;
  nome: string;
  /** alvo em g/ha (micros) ou kg/ha (macros) — sempre normalizado para g/ha internamente */
  alvo_g_ha: number;
  categoria: "macro" | "micro";
}

export interface ItemFormulacao {
  materia_prima_id: string;
  /** kg/ha de sal (editável manualmente) */
  sal_kg_ha: number;
  bloqueado?: boolean;
  observacao?: string;
}

export interface CalculoItemResultado {
  materia_prima_id: string;
  nome: string;
  sal_kg_ha: number;
  sal_total_kg: number;
  sacos_25kg: number;
  custo_kg_ha: number;
  custo_total: number;
  complex_l_ha: number;
  /** contribuição em g/ha por nutriente_id */
  contribuicoes: Record<string, number>;
}

export interface CalculoAtendimento {
  nutriente_id: string;
  simbolo: string;
  nome: string;
  alvo_g_ha: number;
  fornecido_g_ha: number;
  atendimento_pct: number;
  status: "abaixo" | "ok" | "excesso" | "ausente";
}

export interface CalculoResultado {
  itens: CalculoItemResultado[];
  atendimento: CalculoAtendimento[];
  custo_total_ha: number;
  custo_total_area: number;
  complex_total_l_ha: number;
  alertas_incompatibilidade: Array<{ a: string; b: string; severidade: string; motivo?: string }>;
}

export interface CalcularInput {
  itens: ItemFormulacao[];
  alvos: NutrienteAlvo[];
  materias_primas: MateriaPrimaInfo[];
  area_ha: number;
  saco_padrao_kg: number;
  fatores_complexador?: Record<string, number>; // nutriente_id -> fator
  incompatibilidades?: Array<{ a: string; b: string; severidade: string; motivo?: string }>;
  tolerancia_min_pct: number;
  tolerancia_max_pct: number;
}

export function calcularFormulacao(input: CalcularInput): CalculoResultado {
  const {
    itens,
    alvos,
    materias_primas,
    area_ha,
    saco_padrao_kg,
    fatores_complexador = {},
    incompatibilidades = [],
    tolerancia_min_pct,
    tolerancia_max_pct,
  } = input;

  const mpById = new Map(materias_primas.map((m) => [m.id, m]));

  // 1) Calcular cada item
  const itensCalc: CalculoItemResultado[] = itens.map((it) => {
    const mp = mpById.get(it.materia_prima_id);
    if (!mp) {
      return {
        materia_prima_id: it.materia_prima_id,
        nome: "(desconhecido)",
        sal_kg_ha: it.sal_kg_ha,
        sal_total_kg: 0,
        sacos_25kg: 0,
        custo_kg_ha: 0,
        custo_total: 0,
        complex_l_ha: 0,
        contribuicoes: {},
      };
    }
    const sal_total_kg = it.sal_kg_ha * area_ha;
    const sacos_25kg = saco_padrao_kg > 0 ? Math.round(sal_total_kg / saco_padrao_kg) : 0;
    const custo_kg_ha = it.sal_kg_ha * (mp.preco_kg || 0);
    const custo_total = sal_total_kg * (mp.preco_kg || 0);

    // contribuições g/ha por nutriente: sal_kg_ha * (teor% / 100) * 1000
    const contribuicoes: Record<string, number> = {};
    let complex_l_ha = 0;
    for (const [nut_id, teor] of Object.entries(mp.garantias)) {
      const g_ha = it.sal_kg_ha * (teor / 100) * 1000;
      contribuicoes[nut_id] = g_ha;
      const fator = fatores_complexador[nut_id] || 0;
      complex_l_ha += it.sal_kg_ha * fator;
    }
    return {
      materia_prima_id: it.materia_prima_id,
      nome: mp.nome,
      sal_kg_ha: it.sal_kg_ha,
      sal_total_kg,
      sacos_25kg,
      custo_kg_ha,
      custo_total,
      complex_l_ha,
      contribuicoes,
    };
  });

  // 2) Calcular atendimento por nutriente
  const atendimento: CalculoAtendimento[] = alvos.map((a) => {
    const fornecido = itensCalc.reduce((s, it) => s + (it.contribuicoes[a.nutriente_id] || 0), 0);
    const pct = a.alvo_g_ha > 0 ? (fornecido / a.alvo_g_ha) * 100 : 0;
    let status: CalculoAtendimento["status"];
    if (a.alvo_g_ha === 0) status = "ausente";
    else if (pct < tolerancia_min_pct) status = "abaixo";
    else if (pct > tolerancia_max_pct) status = "excesso";
    else status = "ok";
    return {
      nutriente_id: a.nutriente_id,
      simbolo: a.simbolo,
      nome: a.nome,
      alvo_g_ha: a.alvo_g_ha,
      fornecido_g_ha: fornecido,
      atendimento_pct: pct,
      status,
    };
  });

  // 3) Totais
  const custo_total_ha = itensCalc.reduce((s, it) => s + it.custo_kg_ha, 0);
  const custo_total_area = itensCalc.reduce((s, it) => s + it.custo_total, 0);
  const complex_total_l_ha = itensCalc.reduce((s, it) => s + it.complex_l_ha, 0);

  // 4) Alertas de incompatibilidade
  const idsUsados = new Set(itens.filter((i) => i.sal_kg_ha > 0).map((i) => i.materia_prima_id));
  const alertas = incompatibilidades.filter((i) => idsUsados.has(i.a) && idsUsados.has(i.b));

  return {
    itens: itensCalc,
    atendimento,
    custo_total_ha,
    custo_total_area,
    complex_total_l_ha,
    alertas_incompatibilidade: alertas,
  };
}

/**
 * Sugere uma composição inicial: para cada nutriente alvo > 0, escolhe a matéria-prima
 * com maior teor% daquele nutriente e calcula sal_kg/ha = dose_g/ha / (teor% × 10).
 * Se dois alvos compartilham a mesma matéria-prima, usa o que precisar de maior dose.
 */
export function sugerirComposicao(
  alvos: NutrienteAlvo[],
  materias_primas: MateriaPrimaInfo[],
): ItemFormulacao[] {
  const escolhasPorMP: Map<string, number> = new Map();

  for (const alvo of alvos) {
    if (alvo.alvo_g_ha <= 0) continue;
    // Escolher a matéria-prima com maior teor desse nutriente
    let melhorMP: MateriaPrimaInfo | null = null;
    let melhorTeor = 0;
    for (const mp of materias_primas) {
      const teor = mp.garantias[alvo.nutriente_id] || 0;
      if (teor > melhorTeor) {
        melhorTeor = teor;
        melhorMP = mp;
      }
    }
    if (!melhorMP || melhorTeor <= 0) continue;
    const sal_kg_ha = alvo.alvo_g_ha / (melhorTeor * 10);
    const atual = escolhasPorMP.get(melhorMP.id) || 0;
    if (sal_kg_ha > atual) escolhasPorMP.set(melhorMP.id, sal_kg_ha);
  }

  return Array.from(escolhasPorMP.entries()).map(([materia_prima_id, sal_kg_ha]) => ({
    materia_prima_id,
    sal_kg_ha: Math.round(sal_kg_ha * 100) / 100,
  }));
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(v: number, digits = 2): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
