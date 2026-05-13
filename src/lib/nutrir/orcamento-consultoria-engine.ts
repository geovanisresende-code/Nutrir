/**
 * Motor de precificação proporcional para Orçamento de Consultoria.
 * Replica a dinâmica da planilha "orçamento_consultoria.xlsm".
 *
 * Regras:
 * 1. Valor da amostra = MAX(rendimento/ha × fator, piso mínimo).
 * 2. Nº amostras = ARREDONDAR.PARA.CIMA(area / grid) × nº amostragens.
 * 3. Total por cultura = N_amostras × valor_amostra.
 * 4. Valor/ha = Total_cultura / Area_cultura.
 * 5. Cereais (Cereal/Grão): grid mínimo recomendado conforme parâmetro.
 */

export interface ParametrosConsultoria {
  custo_amostra: number;
  meta_lucratividade: number; // %
  rendimento_ref_soja: number; // R$/ha
  piso_amostra: number;
  piso_hectare: number;
  grid_min_cereais: number;
}

export interface CulturaConsultoria {
  id?: string;
  nome: string;
  rendimento_bruto_ha: number;
  grid_minimo: number;
  categoria: string;
}

export type MetodoAmostragem = "grade" | "talhoes";

export interface ItemOrcamento {
  cultura_id?: string;
  cultura_nome: string;
  area_ha: number;
  metodo_amostragem: MetodoAmostragem;
  grid_ha: number;            // usado quando metodo = "grade"
  numero_talhoes: number;     // usado quando metodo = "talhoes"
  amostras_por_talhao: number;// usado quando metodo = "talhoes"
  numero_amostragens: number;
  // calculados
  total_amostras: number;
  valor_amostra: number;
  valor_ha: number;
  subtotal: number;
}

export function calcularFatorProporcional(p: ParametrosConsultoria): number {
  const valorAmostraSoja = p.custo_amostra / (1 - p.meta_lucratividade / 100);
  return valorAmostraSoja / p.rendimento_ref_soja;
}

export function calcularValorAmostra(
  rendimentoHa: number,
  p: ParametrosConsultoria,
): number {
  const fator = calcularFatorProporcional(p);
  return Math.max(rendimentoHa * fator, p.piso_amostra);
}

/**
 * Novo modelo (manual / operacional):
 * - valor_amostra = custo_operacional / (1 - meta_lucratividade/100)
 * - NÃO depende mais do rendimento da cultura.
 * - Pisos (piso_amostra / piso_hectare) ainda se aplicam como salvaguarda.
 */
export function calcularValorAmostraOperacional(p: ParametrosConsultoria): number {
  const margem = Math.min(Math.max(p.meta_lucratividade ?? 0, 0), 99.9);
  const base = (p.custo_amostra ?? 0) / (1 - margem / 100);
  return Math.max(base, p.piso_amostra ?? 0);
}

export function calcularItem(
  cultura: CulturaConsultoria,
  area_ha: number,
  metodo: MetodoAmostragem,
  grid_ha: number,
  numero_talhoes: number,
  amostras_por_talhao: number,
  numero_amostragens: number,
  p: ParametrosConsultoria,
): ItemOrcamento {
  const amostragens = Math.max(1, numero_amostragens || 1);
  let total_amostras = 0;
  if (metodo === "talhoes") {
    const t = Math.max(0, Math.floor(numero_talhoes || 0));
    const apt = Math.max(1, Math.floor(amostras_por_talhao || 1));
    total_amostras = t * apt * amostragens;
  } else {
    const gridEfetivo = Math.max(grid_ha || 0.1, 0.1);
    total_amostras = Math.ceil((area_ha || 0) / gridEfetivo) * amostragens;
  }
  const valor_amostra = calcularValorAmostraOperacional(p);
  const subtotalRaw = total_amostras * valor_amostra;
  const subtotal = area_ha > 0 ? Math.max(subtotalRaw, (p.piso_hectare ?? 0) * area_ha) : subtotalRaw;
  const valor_ha = area_ha > 0 ? subtotal / area_ha : 0;
  return {
    cultura_id: cultura.id,
    cultura_nome: cultura.nome,
    area_ha,
    metodo_amostragem: metodo,
    grid_ha,
    numero_talhoes,
    amostras_por_talhao,
    numero_amostragens: amostragens,
    total_amostras,
    valor_amostra,
    valor_ha,
    subtotal,
  };
}

export interface TotaisOrcamento {
  area_total: number;
  total_amostras: number;
  valor_total: number;
  valor_medio_ha: number;
}

export function calcularTotais(itens: ItemOrcamento[]): TotaisOrcamento {
  const area_total = itens.reduce((s, i) => s + (i.area_ha || 0), 0);
  const total_amostras = itens.reduce((s, i) => s + (i.total_amostras || 0), 0);
  const valor_total = itens.reduce((s, i) => s + (i.subtotal || 0), 0);
  const valor_medio_ha = area_total > 0 ? valor_total / area_total : 0;
  return { area_total, total_amostras, valor_total, valor_medio_ha };
}

export function isCereal(categoria: string): boolean {
  return /cereal|grão|grao/i.test(categoria || "");
}

export function gridMinimoSugerido(cultura: CulturaConsultoria, p: ParametrosConsultoria): number {
  if (isCereal(cultura.categoria)) return Math.max(cultura.grid_minimo, p.grid_min_cereais);
  return cultura.grid_minimo;
}

export const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const formatNum = (n: number, dec = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0);
