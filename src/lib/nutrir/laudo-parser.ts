/**
 * Parser universal de laudos (PDF/Excel/texto) para o Programa NUTRIR.
 *
 * - Lê arquivo enviado pelo usuário (Excel via SheetJS; PDF é encaminhado para
 *   a edge function `extract-lab-pdf`).
 * - Detecta nutrientes em **gr/ha** e **kg/ha** (também aceita g/ha, kg ha-1).
 * - Detecta indicações textuais de tipo de aplicação (foliar, drench,
 *   fertirrigação, pulverizador, nonino, sulco) e complexador sugerido
 *   (LEG, TSH, ÍON, BOR), além de dose recomendada de complexador, quando
 *   estiver impressa no laudo.
 * - Devolve estrutura normalizada para auto-preenchimento das calculadoras
 *   Foliar e NPK.
 */

import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { parseNumberBR } from "./format";

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

export type LaudoTipo = "foliar" | "solo" | "fertirrigacao" | "drench" | "desconhecido";
export type LaudoAplicacao =
  | "foliar"
  | "fertirrigacao"
  | "drench"
  | "nonino"
  | "pulverizador"
  | "sulco"
  | "localizada"
  | null;
export type LaudoComplexador = "leg" | "tsh" | "ion" | "bor" | null;

export interface NutrienteLaudo {
  /** Símbolo padronizado (N, P, K, Ca, Mg, S, B, Cu, Fe, Mn, Zn, Mo, Co, Ni, Si, Se) */
  simbolo: string;
  /** Dose detectada */
  valor: number;
  /** Unidade detectada — sempre "gr/ha" ou "kg/ha" depois da normalização */
  unidade: "gr/ha" | "kg/ha";
  /** Texto bruto encontrado (para debug/UI) */
  raw?: string;
}

export interface LaudoExtraido {
  tipo: LaudoTipo;
  cultura?: string;
  produtor?: string;
  fazenda?: string;
  area_ha?: number;
  aplicacao_sugerida: LaudoAplicacao;
  complexador_sugerido: LaudoComplexador;
  nivel_complexacao_sugerido?: "forte" | "padrao" | "fraca";
  /** Nutrientes detectados em gr/ha ou kg/ha */
  nutrientes: NutrienteLaudo[];
  /** Demanda NPK em kg/ha (quando o laudo for de fertirrigação/solo) */
  demanda_npk?: { N: number; P2O5: number; K2O: number };
  /** Texto bruto do laudo para inspeção */
  texto_bruto?: string;
  alertas: string[];
}

// ────────────────────────────────────────────────────────────
// DICIONÁRIOS
// ────────────────────────────────────────────────────────────

/**
 * Mapa de termos textuais para o símbolo padrão do nutriente.
 * A ordem importa: itens mais específicos primeiro.
 */
const NUTRIENTES_DICT: Array<{ pattern: RegExp; sym: string }> = [
  { pattern: /\b(p2o5|p₂o₅|fosforo|fósforo|p\b)/i, sym: "P" },
  { pattern: /\b(k2o|k₂o|potassio|potássio|k\b)/i, sym: "K" },
  { pattern: /\b(nitrog[eê]nio|nitrato|n\b)/i, sym: "N" },
  { pattern: /\b(c[aá]lcio|ca\b)/i, sym: "Ca" },
  { pattern: /\b(magn[eé]sio|mg\b)/i, sym: "Mg" },
  { pattern: /\b(enxofre|s\b|sulfur)/i, sym: "S" },
  { pattern: /\b(boro|b\b|h3bo3)/i, sym: "B" },
  { pattern: /\b(mangan[eê]s|mn\b)/i, sym: "Mn" },
  { pattern: /\b(zinco|zn\b)/i, sym: "Zn" },
  { pattern: /\b(cobre|cu\b)/i, sym: "Cu" },
  { pattern: /\b(ferro|fe\b)/i, sym: "Fe" },
  { pattern: /\b(mol[ií]bd[eê]nio|mo\b)/i, sym: "Mo" },
  { pattern: /\b(cobalto|co\b)/i, sym: "Co" },
  { pattern: /\b(n[ií]quel|ni\b)/i, sym: "Ni" },
  { pattern: /\b(sil[ií]cio|si\b)/i, sym: "Si" },
  { pattern: /\b(sel[eê]nio|se\b)/i, sym: "Se" },
];

// Ordem de prioridade — "foliar" antes de "pulverizador" pois "foliar via
// pulverizador" deve ser interpretado como aplicação foliar.
const APLICACAO_DICT: Array<{ pattern: RegExp; tipo: LaudoAplicacao }> = [
  { pattern: /foliar/i, tipo: "foliar" },
  { pattern: /fertirrig/i, tipo: "fertirrigacao" },
  { pattern: /drench/i, tipo: "drench" },
  { pattern: /nonino/i, tipo: "nonino" },
  { pattern: /sulco/i, tipo: "sulco" },
  { pattern: /pulverizador|pulveriza[çc][aã]o/i, tipo: "pulverizador" },
  { pattern: /localizada|faixa/i, tipo: "localizada" },
];

const COMPLEXADOR_DICT: Array<{ pattern: RegExp; cx: LaudoComplexador }> = [
  { pattern: /complex\s*leg|legumin/i, cx: "leg" },
  { pattern: /complex\s*tsh|tsh\b/i, cx: "tsh" },
  { pattern: /complex\s*[íi]on|ion\b/i, cx: "ion" },
  { pattern: /complex\s*bor|bor\b/i, cx: "bor" },
];

const NIVEL_DICT: Array<{ pattern: RegExp; nivel: "forte" | "padrao" | "fraca" }> = [
  { pattern: /\bforte\b/i, nivel: "forte" },
  { pattern: /\bpadr[aã]o\b/i, nivel: "padrao" },
  { pattern: /\bfraca|leve\b/i, nivel: "fraca" },
];

// ────────────────────────────────────────────────────────────
// EXTRAÇÃO DE TEXTO
// ────────────────────────────────────────────────────────────

/**
 * Lê um Excel e devolve seu conteúdo concatenado como texto plano,
 * preservando linhas e separando colunas com "  |  ".
 */
export async function lerExcelComoTexto(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const linhas: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown as unknown[][];
    linhas.push(`# Aba: ${sheetName}`);
    for (const row of json) {
      const cells = (row as unknown[]).map((c) => String(c ?? "").trim()).filter(Boolean);
      if (cells.length === 0) continue;
      linhas.push(cells.join("  |  "));
    }
    linhas.push("");
  }
  return linhas.join("\n");
}

/**
 * Extrai nutrientes (gr/ha ou kg/ha) a partir de texto bruto.
 *
 * Regex global cobre:
 *   - "Mn 600 gr/ha" / "Mn: 600 g ha"
 *   - "Manganês  ............  0,6 kg/ha"
 *   - "P2O5 90 kg/ha" → simbolo "P"
 *   - "Boro 300g/ha"
 */
export function extrairNutrientes(texto: string): NutrienteLaudo[] {
  const linhas = texto.split(/\r?\n/);
  const out: NutrienteLaudo[] = [];
  const visto = new Set<string>();

  // Regex: <nutriente> ... <numero> <gr|g|kg> /ha
  // Termo do nutriente pode incluir dígitos (P2O5, K2O) e subscripts (P₂O₅).
  const reLinha =
    /([A-Za-zÀ-ú][A-Za-zÀ-ú0-9₂₃₄₅]{0,14}(?:\s*[A-Za-zÀ-ú][A-Za-zÀ-ú0-9₂₃₄₅]{0,8})?)[^0-9\n]{0,30}([\d.,]+)\s*(gr|g|kg|kilogr|grama)\s*[\/\-\s]?\s*ha\b/gi;

  for (const ln of linhas) {
    let m: RegExpExecArray | null;
    reLinha.lastIndex = 0;
    while ((m = reLinha.exec(ln)) !== null) {
      const termoBruto = m[1].trim();
      const valorStr = m[2];
      const unidadeRaw = m[3].toLowerCase();
      // Identificar símbolo
      let sym: string | null = null;
      for (const d of NUTRIENTES_DICT) {
        if (d.pattern.test(termoBruto)) {
          sym = d.sym;
          break;
        }
      }
      if (!sym) continue;
      if (visto.has(sym)) continue; // primeira ocorrência prevalece
      const valor = parseNumberBR(valorStr);
      if (!isFinite(valor) || valor <= 0) continue;
      const unidade: "gr/ha" | "kg/ha" =
        unidadeRaw.startsWith("kg") || unidadeRaw.startsWith("kil") ? "kg/ha" : "gr/ha";
      visto.add(sym);
      out.push({ simbolo: sym, valor, unidade, raw: m[0] });
    }
  }
  return out;
}

/** Detecta tipo de aplicação a partir do texto */
export function detectarAplicacao(texto: string): LaudoAplicacao {
  for (const d of APLICACAO_DICT) if (d.pattern.test(texto)) return d.tipo;
  return null;
}

/** Detecta complexador sugerido a partir do texto */
export function detectarComplexador(texto: string): LaudoComplexador {
  for (const d of COMPLEXADOR_DICT) if (d.pattern.test(texto)) return d.cx;
  return null;
}

/** Detecta nível de complexação sugerido */
export function detectarNivel(texto: string): "forte" | "padrao" | "fraca" | undefined {
  for (const d of NIVEL_DICT) if (d.pattern.test(texto)) return d.nivel;
  return undefined;
}

/** Detecta cabeçalho (produtor, fazenda, cultura, área) */
function detectarCabecalho(texto: string): {
  produtor?: string;
  fazenda?: string;
  cultura?: string;
  area_ha?: number;
} {
  const out: ReturnType<typeof detectarCabecalho> = {};
  const m1 = texto.match(/produtor\s*[:\-]\s*([^\n|]{2,80})/i);
  if (m1) out.produtor = m1[1].trim();
  const m2 = texto.match(/fazenda\s*[:\-]\s*([^\n|]{2,80})/i);
  if (m2) out.fazenda = m2[1].trim();
  const m3 = texto.match(/cultura\s*[:\-]\s*([^\n|]{2,40})/i);
  if (m3) out.cultura = m3[1].trim();
  const m4 = texto.match(/[áa]rea\s*[:\-]?\s*([\d.,]+)\s*(?:ha|hectares?)/i);
  if (m4) out.area_ha = parseNumberBR(m4[1]);
  return out;
}

/** Tenta detectar o tipo do laudo */
function detectarTipo(texto: string, nutrientes: NutrienteLaudo[]): LaudoTipo {
  const t = texto.toLowerCase();
  if (/foliar/.test(t)) return "foliar";
  if (/fertirrig/.test(t)) return "fertirrigacao";
  if (/drench/.test(t)) return "drench";
  if (/solo|argila|ctc|satura[cç][aã]o/.test(t)) return "solo";
  // Inferir por composição: muitos micros em gr/ha = foliar
  const micros = nutrientes.filter((n) =>
    ["B", "Cu", "Fe", "Mn", "Zn", "Mo", "Co", "Ni", "Se", "Si"].includes(n.simbolo),
  );
  const macros = nutrientes.filter((n) => ["N", "P", "K"].includes(n.simbolo));
  if (micros.length >= 3 && micros.every((n) => n.unidade === "gr/ha")) return "foliar";
  if (macros.length >= 2 && macros.every((n) => n.unidade === "kg/ha")) return "fertirrigacao";
  return "desconhecido";
}

/** Constrói demanda NPK (kg/ha) a partir dos nutrientes detectados */
function construirDemandaNPK(
  nutrientes: NutrienteLaudo[],
): { N: number; P2O5: number; K2O: number } | undefined {
  const get = (sym: string) => nutrientes.find((n) => n.simbolo === sym);
  const n = get("N");
  const p = get("P");
  const k = get("K");
  if (!n && !p && !k) return undefined;
  const conv = (x: NutrienteLaudo | undefined) =>
    x ? (x.unidade === "kg/ha" ? x.valor : x.valor / 1000) : 0;
  return { N: conv(n), P2O5: conv(p), K2O: conv(k) };
}

// ────────────────────────────────────────────────────────────
// API PRINCIPAL
// ────────────────────────────────────────────────────────────

/** Processa o conteúdo textual de um laudo (origem PDF/Excel/colado) */
export function parseLaudoTexto(texto: string): LaudoExtraido {
  const alertas: string[] = [];
  const nutrientes = extrairNutrientes(texto);
  if (nutrientes.length === 0) {
    alertas.push("Nenhum nutriente em gr/ha ou kg/ha foi detectado no laudo.");
  }
  const cab = detectarCabecalho(texto);
  const tipo = detectarTipo(texto, nutrientes);
  const aplicacao =
    detectarAplicacao(texto) ?? (tipo === "foliar" ? "foliar" : tipo === "fertirrigacao" ? "fertirrigacao" : null);
  const complexador =
    detectarComplexador(texto) ??
    (tipo === "foliar" ? "leg" : tipo === "fertirrigacao" || tipo === "drench" ? "tsh" : null);

  return {
    tipo,
    ...cab,
    aplicacao_sugerida: aplicacao,
    complexador_sugerido: complexador,
    nivel_complexacao_sugerido: detectarNivel(texto) ?? "padrao",
    nutrientes,
    demanda_npk: construirDemandaNPK(nutrientes),
    texto_bruto: texto,
    alertas,
  };
}

/** Processa um arquivo de planilha (xlsx/xls/csv) */
export async function parseLaudoExcel(file: File | Blob): Promise<LaudoExtraido> {
  const texto = await lerExcelComoTexto(file);
  return parseLaudoTexto(texto);
}

/**
 * Processa um arquivo PDF.
 * Faz upload para o bucket privado `lab-reports` e chama a edge
 * `extract-lab-pdf`, que devolve `{ values: { ... } }`. Em paralelo,
 * tenta um parse heurístico do nome do arquivo / texto OCR caso disponível.
 */
export async function parseLaudoPDF(file: File): Promise<LaudoExtraido> {
  const alertas: string[] = [];
  try {
    const path = `auto-import/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("lab-reports").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (up.error) throw up.error;
    const { data, error } = await supabase.functions.invoke("extract-lab-pdf", {
      body: { storage_path: path, analysis_type: "leaf" },
    });
    if (error) throw error;
    const values = (data as { values?: Record<string, number | null> })?.values ?? {};
    // Mapeia retorno da edge (n,p,k,ca,mg,s,b,cu,fe,mn,zn em g/kg ou mg/kg)
    // para nutrientes em gr/ha — tratamos como gr/ha quando o valor parece grande,
    // como kg/ha quando pequeno (heurística mínima)
    const nutrientes: NutrienteLaudo[] = [];
    const mapa: Record<string, string> = {
      n: "N", p: "P", k: "K", ca: "Ca", mg: "Mg", s: "S",
      b: "B", cu: "Cu", fe: "Fe", mn: "Mn", zn: "Zn",
    };
    for (const [key, sym] of Object.entries(mapa)) {
      const v = values[key];
      if (typeof v === "number" && v > 0) {
        const unidade: "gr/ha" | "kg/ha" =
          ["N", "P", "K", "Ca", "Mg", "S"].includes(sym) && v >= 1 ? "kg/ha" : "gr/ha";
        nutrientes.push({ simbolo: sym, valor: v, unidade, raw: `${key}=${v}` });
      }
    }
    if (nutrientes.length === 0) {
      alertas.push("Edge AI não retornou nutrientes — verifique se o PDF tem texto pesquisável.");
    }
    return {
      tipo: "foliar",
      aplicacao_sugerida: "foliar",
      complexador_sugerido: "leg",
      nivel_complexacao_sugerido: "padrao",
      nutrientes,
      demanda_npk: construirDemandaNPK(nutrientes),
      alertas,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      tipo: "desconhecido",
      aplicacao_sugerida: null,
      complexador_sugerido: null,
      nutrientes: [],
      alertas: [`Falha ao processar PDF: ${msg}`],
    };
  }
}

/** Roteador automático por extensão */
export async function parseLaudoArquivo(file: File): Promise<LaudoExtraido> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parseLaudoPDF(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv"))
    return parseLaudoExcel(file);
  // tenta como texto cru
  const txt = await file.text();
  return parseLaudoTexto(txt);
}
