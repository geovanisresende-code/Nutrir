/**
 * Formatação numérica padronizada para o Programa NUTRIR.
 *  - Separador de milhar BR (1.000)
 *  - Vírgula decimal, no máximo 2 casas
 *  - Símbolos sempre presentes (gr/ha, kg/ha, R$, L, ton...)
 *  - Aplicação de produto pronto: arredondada para inteiro (Math.round)
 */

const BR = "pt-BR";

export type Unit =
  | "gr/ha"
  | "kg/ha"
  | "ton/ha"
  | "L/ha"
  | "mL/ha"
  | "kg"
  | "gr"
  | "L"
  | "mL"
  | "ton"
  | "%"
  | "un"
  | "ha";

/** Formata número inteiro com separador de milhar */
export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return "0";
  return Math.round(Number(v)).toLocaleString(BR, { maximumFractionDigits: 0 });
}

/** Formata número com vírgula decimal e separador de milhar (até 2 casas) */
export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return "0";
  return Number(v).toLocaleString(BR, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata número, mas remove decimais zerados (ex.: 1500,00 → 1.500) */
export function fmtSmart(v: number | null | undefined, maxDec = 2): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return "0";
  return Number(v).toLocaleString(BR, { maximumFractionDigits: maxDec });
}

/** Formata moeda BRL */
export function fmtBRL(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return "R$ 0,00";
  return Number(v).toLocaleString(BR, { style: "currency", currency: "BRL" });
}

/** Formata moeda BRL sem casas decimais */
export function fmtBRLInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return "R$ 0";
  return Number(v).toLocaleString(BR, {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Arredonda para inteiro a aplicação de produto pronto (ex.: 69,3 L/ha → 69) */
export function arredondaAplicacao(v: number | null | undefined): number {
  if (v === null || v === undefined || !isFinite(Number(v))) return 0;
  return Math.round(Number(v));
}

/** Formata uma quantidade COM seu símbolo. Decide casas decimais por contexto. */
export function fmtQty(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined || !isFinite(Number(v))) return `0 ${unit}`;
  const n = Number(v);

  switch (unit) {
    // Aplicações de produto pronto → SEMPRE inteiro
    case "L/ha":
    case "mL/ha":
      return `${fmtInt(arredondaAplicacao(n))} ${unit}`;
    // Doses agronômicas (gr/ha, kg/ha) → inteiro se for >= 10, senão 2 casas
    case "gr/ha":
      return `${Math.abs(n) >= 10 ? fmtInt(n) : fmtNum(n, 2)} ${unit}`;
    case "kg/ha":
      return `${Math.abs(n) >= 100 ? fmtInt(n) : fmtNum(n, 2)} ${unit}`;
    case "ton":
    case "ton/ha":
      return `${fmtSmart(n, 2)} ${unit}`;
    // Quantidades de embalagem
    case "kg":
    case "gr":
    case "L":
    case "mL":
      return `${Math.abs(n) >= 100 ? fmtInt(n) : fmtSmart(n, 2)} ${unit}`;
    case "%":
      return `${fmtSmart(n, 1)}%`;
    case "un":
      return `${fmtInt(n)} un`;
    case "ha":
      return `${fmtSmart(n, 2)} ha`;
    default:
      return `${fmtSmart(n, 2)} ${unit}`;
  }
}

/** Parser de números BR/EN aceitando "1.234,56", "1234.56", "1,234.56" etc. */
export function parseNumberBR(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s) return 0;
  s = s.replace(/[^\d.,\-]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // formato BR: "1.234,56" — ponto é milhar, vírgula é decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // formato US: "1,234.56" — vírgula é milhar
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
