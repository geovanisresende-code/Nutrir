// Engine única de cálculo de preço final.
// Fórmula: preço_base (custo do produto) é multiplicado pelos fatores ativos
// (modalidade, embalagem, regional) e pela margem da categoria do produto
// definida na modalidade. Descontos por item ainda são aplicados depois.

export const TIPOS_NEGOCIACAO = [
  { value: "venda_direta", label: "Venda Direta" },
  { value: "b2b", label: "B2B" },
  { value: "revenda", label: "Revenda" },
  { value: "grupo_compra", label: "Grupo de Compra" },
  { value: "distribuicao", label: "Distribuição" },
] as const;

export type TipoNegociacao = (typeof TIPOS_NEGOCIACAO)[number]["value"];

export const TIPO_NEGOCIACAO_PADRAO: TipoNegociacao = "venda_direta";

export interface PrecoInputs {
  custoBase: number; // custo do produto por LITRO (custo_industria ou preço-base manual)
  custoAdicionalEmbalagem?: number | null; // custo adicional por litro da embalagem selecionada
  custoAdicionalRegional?: number | null; // custo adicional por litro da regional selecionada
  multiplicadorModalidade?: number | null;
  multiplicadorEmbalagem?: number | null;
  multiplicadorRegional?: number | null;
  margemCategoriaPercentual?: number | null; // ex: 0.35 ou 35 = 35%
  descontoPercentual?: number | null;
  prazoDias?: number | null; // prazo de pagamento em dias (para juros)
}

// Regras de juros financeiros:
// - Até 30 dias: à vista, sem juros.
// - Acima de 30 dias: 1,8% ao mês pro-rata por dia (sobre os dias EXCEDENTES a 30).
export const JUROS_MENSAL = 0.018;
export const PRAZO_SEM_JUROS_DIAS = 30;

export function calcularFatorJuros(prazoDias: number | null | undefined): number {
  const dias = Math.max(0, Number(prazoDias ?? 0) || 0);
  if (dias <= PRAZO_SEM_JUROS_DIAS) return 1;
  const diasExcedentes = dias - PRAZO_SEM_JUROS_DIAS;
  // juros simples diário pro-rata: (1,8%/30) ao dia sobre os dias excedentes
  const taxaDiaria = JUROS_MENSAL / 30;
  return 1 + taxaDiaria * diasExcedentes;
}

export function normalizarPercentual(valor: number | null | undefined): number {
  const numero = Number(valor ?? 0) || 0;
  return numero > 1 ? numero / 100 : numero;
}

export function calcularCustoOperacionalLitro(i: Pick<PrecoInputs, "custoBase" | "custoAdicionalEmbalagem" | "custoAdicionalRegional">): number {
  const custoLitro = Number(i.custoBase) || 0;
  const custoEmbalagem = Number(i.custoAdicionalEmbalagem ?? 0) || 0;
  const custoRegional = Number(i.custoAdicionalRegional ?? 0) || 0;
  return custoLitro + custoEmbalagem + custoRegional;
}

export function calcularMargemRealPercentual(precoFinal: number, custoOperacionalLitro: number): number | null {
  if (!precoFinal || precoFinal <= 0) return null;
  return ((precoFinal - custoOperacionalLitro) / precoFinal) * 100;
}

// Preço final por litro = (custo_indústria + custo_embalagem + custo_regional)
//                         ÷ (1 − margem_categoria)
//                         × mult_modalidade × mult_embalagem × mult_regional × (1 − desconto)
export function calcularPrecoFinal(i: PrecoInputs): number {
  const custoOperacional = calcularCustoOperacionalLitro(i);
  const mMod = Number(i.multiplicadorModalidade ?? 1) || 1;
  const mEmb = Number(i.multiplicadorEmbalagem ?? 1) || 1;
  const mReg = Number(i.multiplicadorRegional ?? 1) || 1;
  const margem = Math.min(0.999999, Math.max(0, normalizarPercentual(i.margemCategoriaPercentual ?? 0)));
  const desc = Math.min(0.999999, Math.max(0, normalizarPercentual(i.descontoPercentual ?? 0)));
  const juros = calcularFatorJuros(i.prazoDias);
  const bruto = (custoOperacional / (1 - margem)) * mMod * mEmb * mReg * juros;
  return Math.max(0, bruto * (1 - desc));
}

export function margemCategoriaDe(
  margens_por_categoria: Record<string, number> | null | undefined,
  categoria: string | null | undefined
): number {
  if (!margens_por_categoria || !categoria) return 0;
  const v = margens_por_categoria[categoria] ?? margens_por_categoria["padrao"];
  return Number(v ?? 0);
}

export function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
