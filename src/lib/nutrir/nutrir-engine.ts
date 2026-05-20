/**
 * MOTOR — PROGRAMA NUTRIR — Ureia Complexada
 *
 *  Modos:  n180 | n180_b | n32_foliar
 *
 *  Substituição (modo n180/n180_b — converte adubo base em "Ureia equivalente"):
 *   - Ureia branca:    -60% (kg/ha equivalente)
 *   - Ureia protegida: -55%
 *   - Sulfato Amônio:  ≤200kg/ha → 100% à lanço; 200..400 → 150kg lanço; >400 → 200kg lanço; restante converte
 *   - Nitrato Amônio:  -45% do N total
 *
 *  CALDA (proporções por LITRO de batida):
 *     Ureia ............. 40% do volume (kg)   (não se aplica ao N32 foliar)
 *     TSH ............... 6%
 *     LIFE GROW ......... 7,5%
 *     LEG ............... 2,5%
 *     Água .............. completar até o volume
 *
 *  Regra prática de distribuição (N180 / N180+B):
 *     - Com micron: vazão efetiva no sulco = vazão_micron - 10 L/ha.
 *       Restante dividido em V1/V2, V4/V5, V8 (3 aplicações foliares).
 *     - Sem micron: 3 aplicações iguais em V1/V2, V4/V5, V8.
 *     - Mínimo 50 L/ha por aplicação foliar — pode ser quebrado se calda total < 100 L/ha.
 *     - 1ª foliar: TSH ou LIFE GROW (escolha do usuário). Demais: LEG.
 *
 *  N32 foliar:
 *     - Usuário informa L/ha de produto N32 e preço do produto cliente.
 *     - 3 aplicações foliares iguais (V1/V2, V4/V5, V8) com LEG.
 */

// ============================================================
// TIPOS
// ============================================================
export type FormulationMode = "n180" | "n180_b" | "n32_foliar" | "n180_micros";

export type AduboBase =
  | "ureia_branca"
  | "ureia_protegida"
  | "sulfato_amonio"
  | "nitrato_amonio";

export type Complexante = "tsh" | "life_grow" | "leg";
type ComplexanteMicros = import("./foliar-engine").ComplexadorPrincipal;

/** Intensidade de complexação para o modo N32 (LEG por 1.000 L de batida) */
export type IntensidadeLEG = "fraca" | "padrao" | "forte";

/** L de LEG por 1.000 L de batida (base 400 kg de Ureia) */
export const LEG_POR_1000L: Record<IntensidadeLEG, number> = {
  fraca: 40,
  padrao: 50,
  forte: 75,
};

export type EstagioId = "sulco" | "v1_v2" | "v4_v5" | "v8";

export interface EstagioRegra {
  id: EstagioId;
  nome: string;
  complexante: Complexante | "primeira";
}

export const ESTAGIOS_DEFAULT: EstagioRegra[] = [
  { id: "sulco", nome: "Sulco de Plantio", complexante: "primeira" },
  { id: "v1_v2", nome: "V1 / V2",          complexante: "primeira" },
  { id: "v4_v5", nome: "V4 / V5",          complexante: "leg" },
  { id: "v8",    nome: "V8",               complexante: "leg" },
];

export interface Precos {
  ureia_kg: number;
  sulfato_amonio_kg: number;
  nitrato_amonio_kg: number;
  ureia_protegida_kg: number;
  acido_borico_kg: number;
  bor_l: number;
  tsh_l: number;
  life_grow_l: number;
  leg_l: number;
  /** Preço do produto N32 do cliente (R$/L) — usado só como referência de comparativo */
  n32_cliente_l: number;
}

export const PRECOS_DEFAULT: Precos = {
  ureia_kg: 3.4,
  sulfato_amonio_kg: 2.7,
  nitrato_amonio_kg: 4.5,
  ureia_protegida_kg: 4.2,
  acido_borico_kg: 18,
  bor_l: 32,
  tsh_l: 18,
  life_grow_l: 22,
  leg_l: 45,
  n32_cliente_l: 8,
};

export interface CalcInput {
  modo: FormulationMode;
  adubo?: AduboBase;
  /** n180/n180_b: kg/ha do adubo. n32_foliar: L/ha do produto N32. */
  doseKgHa: number;
  areaHa: number;
  /** Possui micron de plantio? (apenas N180/N180+B) */
  possuiMicron: boolean;
  /** Vazão do micron (L/ha). Subtrai 10 L/ha para vazão efetiva. */
  vazaoMicronLHa?: number;
  /** Complexante do sulco (TSH ou LIFE GROW). */
  complexanteSulco?: "tsh" | "life_grow";
  /** Complexante da 1ª foliar (V1/V2). */
  complexantePrimeira?: "tsh" | "life_grow";
  /** Apenas n180_b: dose de Boro em g/ha. */
  boroGHa?: number;
  /** Apenas n180_b: aplicar Boro também no sulco de plantio? (máx. 75 g/ha no sulco) */
  boroNoSulco?: boolean;
  /** Preços (override). */
  precos?: Partial<Precos>;
  estagios?: EstagioRegra[];
  /** N32 foliar — garantia do produto (g/L). Padrão 380. */
  n32GarantiaGL?: number;
  /** N32 foliar — intensidade de complexação. Padrão "forte". */
  n32Intensidade?: IntensidadeLEG;
  /** N32 foliar — número de aplicações (1 a 3). Padrão 3. */
  n32NumAplicacoes?: number;

  /** Parâmetros do motor de cálculos (Supabase nutrir_motor_config). Quando fornecido,
   *  substitui as constantes hardcoded (reduções, complexantes, preços padrão). */
  motorConfig?: Record<string, number>;

  // ─── N180 + Micros (NitroPlus) ───
  /** Micros foliares para distribuir nas aplicações foliares (V1/V2, V4/V5, V8). */
  microsFoliar?: MicrosFoliarInput;
}

/** Input dos micros foliares no modo N180+Micros. */
export interface MicrosFoliarInput {
  /** Sais com nutriente, garantia e preço (carregado da Calculadora foliar). */
  sais: import("./foliar-engine").SalCatalogo[];
  /** Fatores de complexação (planilha CONTAS.FORM). */
  fatores: import("./foliar-engine").FatorComplexacao[];
  /** Doses de nutrientes em g/ha. */
  nutrientes: import("./foliar-engine").NutrienteEntrada[];
  /** Volume da batida (L). */
  volumeBatidaL: number;
  /** Nível de complexação (LEG/TSH/ÍON). */
  nivel: import("./foliar-engine").NivelComplexacao;
  /** Complexador principal. */
  complexador: ComplexanteMicros;
  /** Preços dos complexantes (R$/L). */
  precos: import("./foliar-engine").FoliarInput["precos"];
  /** Carbo Alga (mL/ha). */
  extratoAlgasMlHa?: number;
  /** Life Grow (mL/ha) — sulco/drench. */
  condicionadorSoloMlHa?: number;
  /** Limite de sais na calda (% do volume). Padrão 40%. */
  limiteSaisPct?: number;
}

export interface AplicacaoEstagio {
  id: EstagioId;
  nome: string;
  vazaoLHa: number;
  caldaTotalL: number;
  complexante: Complexante;
  ureiaKg: number;
  ureiaKgHa: number;
  complexanteL: number;
  acidoBoricoKg?: number;
  borL?: number;
  receita: ReceitaItem[];
  /** Sais extras (NitroPlus): kg na batida + nome do sal */
  saisMicrosKg?: { nome: string; simbolo: string; kgPorBatida: number; kgTotal: number }[];
  /** Complexantes extras (LEG/TSH/ÍON, BOR, Estimull, Amino+, etc.) na batida */
  complexantesExtraL?: { nome: string; lPorBatida: number; lTotal: number }[];
  /** Fator aplicado no ajuste 40% (1.0 = sem ajuste) */
  ajusteSaisFator?: number;
}

export interface ReceitaItem {
  ordem: number;
  ingrediente: string;
  quantidade: number;
  unidade: string;
  instrucao: string;
}

export interface CustoItem {
  item: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  total: number;
}

export interface ComparativoCustos {
  /** Nome do "adubo de referência" (ex: Ureia, N32 do cliente) */
  referenciaNome: string;
  /** Custo/ha do programa de referência (ex: 200kg ureia × R$3,40 = R$680/ha) */
  referenciaCustoHa: number;
  /** Quantidade × unidade descrita */
  referenciaDescricao: string;
  /** Custo/ha do programa NUTRIR */
  nutrirCustoHa: number;
  /** Quantidade × unidade descrita do programa nutrir */
  nutrirDescricao: string;
  /** Economia R$/ha (ref - nutrir) */
  economiaPorHa: number;
  /** Economia % (em relação à referência) */
  economiaPercentual: number;
  /** Economia total na área */
  economiaTotal: number;
}

export interface CalcResult {
  modo: FormulationMode;
  adubo?: AduboBase;
  nOriginalKgHa: number;
  nResidualKgHa: number;
  ureiaKgHa: number;
  sulfatoLancoKgHa: number;
  caldaTotalLHa: number;
  caldaTotalL: number;
  possuiMicron: boolean;
  vazaoMicronLHa: number;
  vazaoEfetivaSulcoLHa: number;
  aplicacoes: AplicacaoEstagio[];
  custos: CustoItem[];
  custoTotal: number;
  custoPorHa: number;
  comparativo: ComparativoCustos;
  resumo: string;
}

// ============================================================
// CONSTANTES
// ============================================================
const N_CONC: Record<AduboBase, number> = {
  ureia_branca: 0.45,
  ureia_protegida: 0.45,
  sulfato_amonio: 0.21,
  nitrato_amonio: 0.33,
};

/** Fallback constants (used when motorConfig not provided) */
const COMPLEX_PCT_DEFAULT: Record<Complexante, number> = {
  tsh: 0.06,
  life_grow: 0.075,
  leg: 0.025,
};

const UREIA_PCT_VOL = 0.4;
const BORO_CONC_ACIDO = 0.17;
const BOR_L_POR_KG_ACIDO = 0.65;

// Boro no sulco (regra fixa do agrônomo)
const BORO_SULCO_G_HA = 75;          // máx. 75 g/ha de Boro no sulco
const BORO_SULCO_VAZAO_LHA = 40;     // 40 L/ha de calda no sulco
// Receita do sulco (por 1.000 L): 400 L água + 7 L Bor + 11 kg ác. bórico + 400 kg ureia + 75 L Life Grow (ou 60 L TSH)
const BORO_SULCO_AB_KG_POR_1000L = 11;
const BORO_SULCO_BOR_L_POR_1000L = 7;

// Distribuição padrão (% da calda foliar) entre as 3 foliares
const DIST_FOLIAR = { v1_v2: 1 / 3, v4_v5: 1 / 3, v8: 1 / 3 };
const MIN_FOLIAR = 50; // L/ha — pode ser quebrado se calda foliar total < 100

// ============================================================
// MOTOR CONFIG HELPERS
// ============================================================

/** Constrói o mapa COMPLEX_PCT a partir do motorConfig (fallback → constantes hardcoded). */
function getComplexPct(cfg: Record<string, number>): Record<Complexante, number> {
  const ureiaPct = (cfg.n180_ureia_kg_1000l ?? 400) / 1000;
  return {
    tsh:       ((cfg.tsh_pct_ureia      ?? 15)    / 100) * ureiaPct,
    life_grow: ((cfg.lifegrow_pct_ureia ?? 18.75)  / 100) * ureiaPct,
    leg:       ((cfg.leg_pct_ureia      ?? 6.25)   / 100) * ureiaPct,
  };
}

/** Extrai preços do motorConfig e mescla com PRECOS_DEFAULT e input.precos. */
function buildPrecos(cfg: Record<string, number>, override?: Partial<Precos>): Precos {
  const fromCfg: Partial<Precos> = {};
  if (cfg.preco_ureia_kg)       fromCfg.ureia_kg        = cfg.preco_ureia_kg;
  if (cfg.preco_tsh_l)          fromCfg.tsh_l            = cfg.preco_tsh_l;
  if (cfg.preco_lifegrow_l)     fromCfg.life_grow_l      = cfg.preco_lifegrow_l;
  if (cfg.preco_leg_l)          fromCfg.leg_l             = cfg.preco_leg_l;
  if (cfg.preco_acido_borico_kg) fromCfg.acido_borico_kg = cfg.preco_acido_borico_kg;
  if (cfg.preco_bor_l)          fromCfg.bor_l             = cfg.preco_bor_l;
  return { ...PRECOS_DEFAULT, ...fromCfg, ...(override || {}) };
}

// ============================================================
// HELPERS
// ============================================================
function round(v: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function roundAplicacaoInteira(v: number): number {
  if (!isFinite(v) || v <= 0) return 0;
  const base = Math.trunc(v);
  const frac = v - base;
  if (Math.abs(frac) < 1e-9) return base;
  if (Math.abs(frac - 0.5) < 1e-9) return base;
  return Math.ceil(v);
}

/** Arredonda para múltiplo de 5 mais próximo (mín. 0). */
function round5(v: number): number {
  if (v <= 0) return 0;
  return Math.round(v / 5) * 5;
}

function nomeComplex(c: Complexante): string {
  return c === "tsh" ? "TSH" : c === "life_grow" ? "LIFE GROW" : "LEG";
}

function nomeComplexMicros(c: ComplexanteMicros): string {
  return c === "tsh" ? "Complex TSH" : c === "leg" ? "Complex LEG" : "Complex íON";
}

function nomeAdubo(a: AduboBase): string {
  return a === "ureia_branca" ? "Ureia Branca"
    : a === "ureia_protegida" ? "Ureia Protegida"
    : a === "sulfato_amonio" ? "Sulfato de Amônio"
    : "Nitrato de Amônio";
}

function precoAdubo(a: AduboBase, p: Precos): number {
  if (a === "ureia_branca") return p.ureia_kg;
  if (a === "ureia_protegida") return p.ureia_protegida_kg;
  if (a === "sulfato_amonio") return p.sulfato_amonio_kg;
  return p.nitrato_amonio_kg;
}

function precoComplex(c: Complexante, p: Precos): number {
  if (c === "tsh") return p.tsh_l;
  if (c === "life_grow") return p.life_grow_l;
  return p.leg_l;
}

// ============================================================
// SUBSTITUIÇÃO
// ============================================================
interface SubstResult {
  nOriginalKgHa: number;
  nResidualKgHa: number;
  ureiaKgHa: number;
  sulfatoLancoKgHa: number;
}

function calcularSubstituicao(adubo: AduboBase, doseKgHa: number, cfg: Record<string, number> = {}): SubstResult {
  const conc = N_CONC[adubo];
  const nOriginal = doseKgHa * conc;

  if (adubo === "ureia_branca") {
    const reducao = (cfg.reducao_ureia_branca ?? 60) / 100;
    const ureiaKgHa = doseKgHa * (1 - reducao);
    return { nOriginalKgHa: nOriginal, nResidualKgHa: ureiaKgHa * 0.45, ureiaKgHa, sulfatoLancoKgHa: 0 };
  }
  if (adubo === "ureia_protegida") {
    const reducao = (cfg.reducao_ureia_protegida ?? 55) / 100;
    const ureiaKgHa = doseKgHa * (1 - reducao);
    return { nOriginalKgHa: nOriginal, nResidualKgHa: ureiaKgHa * 0.45, ureiaKgHa, sulfatoLancoKgHa: 0 };
  }
  if (adubo === "nitrato_amonio") {
    const reducao = (cfg.reducao_nitrato_amonio ?? 45) / 100;
    const nResidual = nOriginal * (1 - reducao);
    const ureiaKgHa = nResidual / 0.45;
    return { nOriginalKgHa: nOriginal, nResidualKgHa: nResidual, ureiaKgHa, sulfatoLancoKgHa: 0 };
  }
  // Sulfato de Amônio — regras do DOCX:
  //   < 200 kg/ha  → substituição completa (0 à lanço, converte TUDO em ureia para N180)
  //   200–300 kg/ha → substituição completa também (limite de substituição total)
  //   > 300 kg/ha  → 150 kg à lanço + converte restante (reduz N 50%)
  //   > 400 kg/ha  → 200 kg à lanço (máx) + converte restante (reduz N 50%)
  const limiteSubstTotal = cfg.sulfato_limite_parcial ?? 300; // < este → subst. completa; >= este → parcial
  const limiteMaximoLanco = cfg.sulfato_limite_maximo  ?? 200; // kg máx à lanço quando > 400
  let sulfatoLanco = 0;
  if (doseKgHa < limiteSubstTotal) {
    sulfatoLanco = 0; // substituição completa — nada fica à lanço
  } else if (doseKgHa <= 400) {
    sulfatoLanco = 150; // 150 kg à lanço, restante vira N180
  } else {
    sulfatoLanco = limiteMaximoLanco; // 200 kg à lanço (máximo)
  }
  const restante = Math.max(0, doseKgHa - sulfatoLanco);
  const nRestante = restante * conc;
  const reducaoSulfato = (cfg.reducao_sulfato_parcial ?? 50) / 100;
  const nResidual = nRestante * reducaoSulfato;
  const ureiaKgHa = nResidual / 0.45;
  return { nOriginalKgHa: nOriginal, nResidualKgHa: nResidual, ureiaKgHa, sulfatoLancoKgHa: sulfatoLanco };
}

// ============================================================
// DISTRIBUIÇÃO PRÁTICA (N180/N180+B)
// ============================================================
function distribuirCaldaPratica(
  caldaLHa: number,
  possuiMicron: boolean,
  vazaoMicron: number,
  boroNoSulco: boolean,
): Record<EstagioId, number> {
  const out: Record<EstagioId, number> = { sulco: 0, v1_v2: 0, v4_v5: 0, v8: 0 };

  // 1) Sulco — duas regras possíveis
  if (boroNoSulco) {
    // Boro no sulco força sulco fixo em 40 L/ha (independente de micron declarado)
    out.sulco = Math.min(BORO_SULCO_VAZAO_LHA, caldaLHa);
  } else if (possuiMicron && vazaoMicron > 0) {
    const efetiva = Math.max(0, vazaoMicron - 10);
    out.sulco = Math.min(efetiva, caldaLHa);
  }

  const restanteFoliar = Math.max(0, caldaLHa - out.sulco);
  if (restanteFoliar <= 0) return out;

  // 2) Distribuição em 3 foliares — mín. 50 L/ha (quebra se restante < 100)
  const aplicarMinimo = restanteFoliar >= 100;

  if (!aplicarMinimo) {
    const por = restanteFoliar / 3;
    out.v1_v2 = por;
    out.v4_v5 = por;
    out.v8 = por;
    return out;
  }

  let v12 = restanteFoliar * DIST_FOLIAR.v1_v2;
  let v45 = restanteFoliar * DIST_FOLIAR.v4_v5;
  let v8 = restanteFoliar * DIST_FOLIAR.v8;

  if (v12 < MIN_FOLIAR) { const diff = MIN_FOLIAR - v12; v12 = MIN_FOLIAR; v8 -= diff; }
  if (v45 < MIN_FOLIAR) { const diff = MIN_FOLIAR - v45; v45 = MIN_FOLIAR; v8 -= diff; }
  if (v8 < 0) v8 = 0;

  out.v1_v2 = v12;
  out.v4_v5 = v45;
  out.v8 = v8;
  return out;
}

// ============================================================
// CÁLCULO PRINCIPAL
// ============================================================
export function calcularNutrir(input: CalcInput): CalcResult {
  const cfg = input.motorConfig ?? {};
  const precos: Precos = buildPrecos(cfg, input.precos);
  const estagios = input.estagios ?? ESTAGIOS_DEFAULT;
  const complexPct = getComplexPct(cfg);
  const ureiaPctVol  = (cfg.n180_ureia_kg_1000l ?? 400) / 1000;
  const boroConcAcido = (cfg.acido_borico_b_pct ?? 17) / 100;
  const borLPorKgAcido = cfg.bor_l_por_kg_acido ?? 0.65;

  // ============ Caso N32 foliar ============
  if (input.modo === "n32_foliar") {
    return calcularN32(input, precos, estagios);
  }

  if (!input.adubo) throw new Error("Selecione o adubo a ser substituído.");

  // 1) Substituição
  const subst = calcularSubstituicao(input.adubo, input.doseKgHa, cfg);

  // 2) Calda total
  const caldaLHa = subst.ureiaKgHa > 0 ? subst.ureiaKgHa / ureiaPctVol : 0;
  const caldaTotalL = caldaLHa * input.areaHa;

  // 3) Distribuição
  const vazaoMicron = input.possuiMicron ? (input.vazaoMicronLHa ?? 0) : 0;
  const boroNoSulco = !!(input.modo === "n180_b" && input.boroNoSulco && input.boroGHa && input.boroGHa > 0);
  const distrib = distribuirCaldaPratica(caldaLHa, input.possuiMicron || boroNoSulco, vazaoMicron, boroNoSulco);

  // 4) Aplicações
  const compSulco: Complexante = input.complexanteSulco ?? "tsh";
  const compNitroPlus = input.modo === "n180_micros" ? input.microsFoliar?.complexador : undefined;
  const compPrimeira: Complexante = compNitroPlus === "leg"
    ? "leg"
    : compNitroPlus === "tsh"
      ? "tsh"
      : (input.complexantePrimeira ?? "tsh");
  const compFoliarPadrao: Complexante = compNitroPlus === "leg"
    ? "leg"
    : compNitroPlus === "tsh"
      ? "tsh"
      : compPrimeira;

  // Boro total e divisão sulco/foliares
  const boroTotalGHa = input.modo === "n180_b" ? (input.boroGHa ?? 0) : 0;
  const boroSulcoGHa = boroNoSulco ? Math.min(BORO_SULCO_G_HA, boroTotalGHa) : 0;
  const boroFoliarGHa = Math.max(0, boroTotalGHa - boroSulcoGHa);

  // Conta quantas foliares estão ativas para dividir o boro foliar
  const foliaresAtivas = (["v1_v2", "v4_v5", "v8"] as EstagioId[]).filter((id) => distrib[id] > 0);
  const boroPorFoliarGHa = foliaresAtivas.length > 0 ? boroFoliarGHa / foliaresAtivas.length : 0;

  const aplicacoes: AplicacaoEstagio[] = estagios
    .filter((e) => distrib[e.id] > 0)
    .map((e) => {
      let comp: Complexante;
        if (e.id === "sulco") comp = compSulco;
       else if (e.id === "v1_v2") comp = compPrimeira;
       else comp = compFoliarPadrao;

      const vazaoLHa = distrib[e.id];
      const caldaTotalEst = vazaoLHa * input.areaHa;
      // Ureia e complexante — arredondar para múltiplo de 5 (kg/L total da etapa)
      const ureiaKg = round5(vazaoLHa * ureiaPctVol * input.areaHa);
      const ureiaKgHa = input.areaHa > 0 ? ureiaKg / input.areaHa : 0;
      const complexanteL = round5(caldaTotalEst * complexPct[comp]);

      // Boro nesta aplicação (g/ha) — sulco: até 75; foliar: divisão igual
      const boroEstGHa = e.id === "sulco" ? boroSulcoGHa : boroPorFoliarGHa;

      let acidoBoricoKgEst: number | undefined;
      let borLEst: number | undefined;
      let abTotalKg = 0;
      let borTotalL = 0;
      if (input.modo === "n180_b" && boroEstGHa > 0) {
        abTotalKg = (boroEstGHa / 1000 / boroConcAcido) * input.areaHa;
        borTotalL = abTotalKg * borLPorKgAcido;
        // Arredondamento para múltiplos de 5 (kg/L)
        acidoBoricoKgEst = round5(abTotalKg);
        borLEst = round5(borTotalL);
      }

      // Receita por 1.000 L de batida — usa ratios oficiais
      const batchL = 1000;
      const receita: ReceitaItem[] = [];
      let ord = 1;
      receita.push({ ordem: ord++, ingrediente: "Água", quantidade: round(batchL * 0.4, 0), unidade: "L", instrucao: "Adicionar 40% do volume em água limpa" });

      if (input.modo === "n180_b" && boroEstGHa > 0) {
        if (e.id === "sulco") {
          // Receita oficial do sulco — 7 L Bor + 11 kg ác. bórico por 1.000 L
          receita.push({ ordem: ord++, ingrediente: "Bor", quantidade: BORO_SULCO_BOR_L_POR_1000L, unidade: "L", instrucao: "Adicionar o complexador de Boro" });
          receita.push({ ordem: ord++, ingrediente: "Ácido Bórico", quantidade: BORO_SULCO_AB_KG_POR_1000L, unidade: "kg", instrucao: "Adicionar e agitar até dissolução" });
        } else {
          // Foliar — proporcional ao volume da batida (mantém g/ha alvo)
          const numBatidas = Math.max(1, Math.ceil(caldaTotalEst / batchL));
          const ab_batida = abTotalKg / numBatidas;
          const bor_batida = borTotalL / numBatidas;
          if (bor_batida > 0) receita.push({ ordem: ord++, ingrediente: "Bor", quantidade: round(bor_batida, 2), unidade: "L", instrucao: "Adicionar o complexador de Boro" });
          if (ab_batida > 0) receita.push({ ordem: ord++, ingrediente: "Ácido Bórico", quantidade: round(ab_batida, 2), unidade: "kg", instrucao: "Adicionar e agitar até dissolução" });
        }
      }

      receita.push({ ordem: ord++, ingrediente: nomeComplex(comp), quantidade: round(batchL * complexPct[comp], 1), unidade: "L", instrucao: `Adicionar ${nomeComplex(comp)} e agitar` });
      receita.push({ ordem: ord++, ingrediente: "Ureia", quantidade: round(batchL * ureiaPctVol, 0), unidade: "kg", instrucao: "Adicionar a Ureia POR ÚLTIMO, lentamente e agitar" });
      receita.push({ ordem: ord++, ingrediente: "Água (até o volume)", quantidade: 0, unidade: "L", instrucao: `Completar com água até ${batchL.toLocaleString("pt-BR")} L e misturar por 1 hora` });

      return {
        id: e.id,
        nome: e.nome,
        vazaoLHa: roundAplicacaoInteira(vazaoLHa),
        caldaTotalL: round(caldaTotalEst, 0),
        complexante: comp,
        ureiaKg,
        ureiaKgHa: round(ureiaKgHa, 1),
        complexanteL,
        acidoBoricoKg: acidoBoricoKgEst,
        borL: borLEst,
        receita,
      };
    });

  // 5) Custos NUTRIR
  const custos: CustoItem[] = [];
  const ureiaTotalKg = round5(aplicacoes.reduce((s, a) => s + a.ureiaKg, 0));
  if (ureiaTotalKg > 0) {
    custos.push({ item: "Ureia", quantidade: ureiaTotalKg, unidade: "kg", precoUnitario: precos.ureia_kg, total: round(ureiaTotalKg * precos.ureia_kg, 2) });
  }
  if (subst.sulfatoLancoKgHa > 0) {
    const qty = round5(subst.sulfatoLancoKgHa * input.areaHa);
    custos.push({ item: "Sulfato de Amônio (à lanço)", quantidade: qty, unidade: "kg", precoUnitario: precos.sulfato_amonio_kg, total: round(qty * precos.sulfato_amonio_kg, 2) });
  }
  const compSum: Record<Complexante, number> = { tsh: 0, life_grow: 0, leg: 0 };
  for (const a of aplicacoes) compSum[a.complexante] += a.complexanteL;
  (Object.keys(compSum) as Complexante[]).forEach((c) => {
    const q = round5(compSum[c]);
    if (q > 0) {
      custos.push({ item: nomeComplex(c), quantidade: q, unidade: "L", precoUnitario: precoComplex(c, precos), total: round(q * precoComplex(c, precos), 2) });
    }
  });
  if (input.modo === "n180_b") {
    const totalAB = round5(aplicacoes.reduce((s, a) => s + (a.acidoBoricoKg ?? 0), 0));
    const totalBor = round5(aplicacoes.reduce((s, a) => s + (a.borL ?? 0), 0));
    if (totalAB > 0) custos.push({ item: "Ácido Bórico", quantidade: totalAB, unidade: "kg", precoUnitario: precos.acido_borico_kg, total: round(totalAB * precos.acido_borico_kg, 2) });
    if (totalBor > 0) custos.push({ item: "Bor", quantidade: totalBor, unidade: "L", precoUnitario: precos.bor_l, total: round(totalBor * precos.bor_l, 2) });
  }
  const custoTotal = round(custos.reduce((s, c) => s + c.total, 0), 2);
  const custoPorHa = input.areaHa > 0 ? round(custoTotal / input.areaHa, 2) : 0;
  void custoTotal; void custoPorHa;

  // 6) Comparativo: adubo de referência (dose original) × programa NUTRIR
  const refPreco = precoAdubo(input.adubo, precos);
  const refCustoHa = round(input.doseKgHa * refPreco, 2);

  // ─── N180 + Micros (NitroPlus): injeta micros nas aplicações foliares ───
  let resumoExtra = "";
  if (input.modo === "n180_micros" && input.microsFoliar) {
    aplicarMicrosNasAplicacoes({
      aplicacoes,
      custos,
      micros: input.microsFoliar,
      areaHa: input.areaHa,
      precosUreia: precos.ureia_kg,
      complexPct,
    });
    resumoExtra = " + micros (NitroPlus)";
  }

  // Recalcula totais após NitroPlus
  const custoTotalFinal = round(custos.reduce((s, c) => s + c.total, 0), 2);
  const custoPorHaFinal = input.areaHa > 0 ? round(custoTotalFinal / input.areaHa, 2) : 0;

  const comparativo: ComparativoCustos = {
    referenciaNome: nomeAdubo(input.adubo),
    referenciaCustoHa: refCustoHa,
    referenciaDescricao: `${input.doseKgHa} kg/ha × R$ ${refPreco.toFixed(2)}/kg`,
    nutrirCustoHa: custoPorHaFinal,
    nutrirDescricao: `Programa NUTRIR — calda ${round(caldaLHa, 0)} L/ha${resumoExtra}`,
    economiaPorHa: round(refCustoHa - custoPorHaFinal, 2),
    economiaPercentual: refCustoHa > 0 ? round(((refCustoHa - custoPorHaFinal) / refCustoHa) * 100, 1) : 0,
    economiaTotal: round((refCustoHa - custoPorHaFinal) * input.areaHa, 2),
  };

  return {
    modo: input.modo,
    adubo: input.adubo,
    nOriginalKgHa: round(subst.nOriginalKgHa, 2),
    nResidualKgHa: round(subst.nResidualKgHa, 2),
    ureiaKgHa: round(subst.ureiaKgHa, 2),
    sulfatoLancoKgHa: round(subst.sulfatoLancoKgHa, 2),
    caldaTotalLHa: round(caldaLHa, 1),
    caldaTotalL: round(caldaTotalL, 0),
    possuiMicron: input.possuiMicron,
    vazaoMicronLHa: vazaoMicron,
    vazaoEfetivaSulcoLHa: input.possuiMicron ? Math.max(0, vazaoMicron - 10) : 0,
    aplicacoes,
    custos,
    custoTotal: custoTotalFinal,
    custoPorHa: custoPorHaFinal,
    comparativo,
    resumo: `${nomeAdubo(input.adubo)} ${input.doseKgHa} kg/ha → ${round(subst.ureiaKgHa, 0)} kg/ha de Ureia · calda ${round(caldaLHa, 0)} L/ha · ${aplicacoes.length} aplicações${resumoExtra}`,
  };
}

// ============================================================
// NITROPLUS — injeta micros nas aplicações foliares (N180+Micros)
// ============================================================
import { calcularFoliar as _calcularFoliar } from "./foliar-engine";

function aplicarMicrosNasAplicacoes(args: {
  aplicacoes: AplicacaoEstagio[];
  custos: CustoItem[];
  micros: MicrosFoliarInput;
  areaHa: number;
  precosUreia: number;
  complexPct?: Record<Complexante, number>;
}) {
  const { aplicacoes, custos, micros, areaHa, precosUreia } = args;
  const complexPct = args.complexPct ?? COMPLEX_PCT_DEFAULT;
  // Limite alvo de sais (Ureia + Ác. Bórico + sais micros) sobre o volume da calda.
  // Padrão: 40% (excepcionalmente 45% — usado como teto absoluto).
  const limiteAlvoPct = (micros.limiteSaisPct ?? 40) / 100;
  const limiteMaxPct  = 0.45;

  // Considera apenas as aplicações foliares (não o sulco)
  const foliares = aplicacoes.filter((a) => a.id !== "sulco");
  if (foliares.length === 0) return;

  // 1) Calcula o foliar UMA vez (gera sais kg/ha totais e complexantes)
  const foliarRes = _calcularFoliar({
    produtor: "", fazenda: "", cultura: "",
    areaHa,
    vazaoPulverizadorLHa: foliares[0].vazaoLHa || 50,
    numeroEntradas: foliares.length,
    estagios: [],
    microNoSolo: "nao",
    aplicacaoDiariaHa: 0,
    volumeBatidaL: micros.volumeBatidaL,
    nivel: micros.nivel,
    complexador: micros.complexador,
    precos: micros.precos,
    nutrientes: micros.nutrientes,
    extratoAlgasMlHa: micros.extratoAlgasMlHa ?? 0,
    condicionadorSoloMlHa: micros.condicionadorSoloMlHa ?? 0,
    custoFoliarConvencionalRsHa: 0,
    sais: micros.sais,
    fatores: micros.fatores,
  });

  // 2) Distribui sais e complexantes igualmente entre as aplicações foliares
  const nFol = foliares.length;
  for (const sal of foliarRes.sais) {
    if (sal.saisAreaKg <= 0) continue;
    const kgPorAppTotal = sal.saisAreaKg / nFol;
    foliares.forEach((apl) => {
      apl.saisMicrosKg = apl.saisMicrosKg ?? [];
      apl.saisMicrosKg.push({
        nome: sal.salNome,
        simbolo: sal.simbolo,
        kgPorBatida: 0, // será recalculado
        kgTotal: round(kgPorAppTotal, 1),
      });
    });
  }
  for (const c of foliarRes.complexantes) {
    if (c.lTotal <= 0) continue;
    const lPorApp = c.lTotal / nFol;
    foliares.forEach((apl) => {
      apl.complexantesExtraL = apl.complexantesExtraL ?? [];
      apl.complexantesExtraL.push({
        nome: c.produto,
        lPorBatida: 0, // será recalculado
        lTotal: round(lPorApp, 1),
      });
    });
  }

  const usarIon = micros.complexador === "ion";
  const usarTsh = micros.complexador === "tsh";
  const usarLifeOuLeg = micros.complexador === "leg";

  for (const apl of foliares) {
    const possuiBoro = (apl.acidoBoricoKg ?? 0) > 0 || (apl.borL ?? 0) > 0;
    const possuiMicrosExtras = (apl.saisMicrosKg ?? []).some((s) => s.kgTotal > 0 && s.simbolo.toLowerCase() !== "b");
    let filtrados = (apl.complexantesExtraL ?? []).filter((c) => {
      const nome = c.nome.toLowerCase();
      if (usarIon) return nome.includes("íon") || nome.includes("ion");
      if (nome.includes("íon") || nome.includes("ion")) return false;
      if (nome.includes("complex bor")) return possuiBoro;
      if (nome.includes("estimull") || nome.includes("amino")) return possuiMicrosExtras;
      if (nome.includes("tsh")) return usarTsh;
      if (nome.includes("leg") || nome.includes("life")) return usarLifeOuLeg;
      return true;
    });

    const principalExtra = filtrados.filter((c) => {
      const nome = c.nome.toLowerCase();
      return nome.includes("tsh") || nome.includes("leg") || nome.includes("life") || nome.includes("íon") || nome.includes("ion");
    });

    if (usarIon) {
      apl.complexanteL = 0;
    } else if (principalExtra.length > 0) {
      apl.complexanteL = round(apl.complexanteL + principalExtra.reduce((acc, c) => acc + c.lTotal, 0), 1);
      filtrados = filtrados.filter((c) => !principalExtra.includes(c));
    }

    apl.complexantesExtraL = filtrados;
  }

  // 3) Por aplicação: garante (Ureia + Ác.Bórico + sais micros) ≤ 40% da calda.
  //    Em vez de reduzir os sais, AUMENTA o volume da calda (e da vazão L/ha)
  //    até respeitar o limite. Teto absoluto: 45% (caso o aumento de calda
  //    fique inviável, mantém-se a 45% sem reduzir as quantidades).
  for (const apl of foliares) {
    const caldaOriginal = apl.caldaTotalL;
    if (caldaOriginal <= 0) continue;

    const saisMicros = (apl.saisMicrosKg ?? []).reduce((s, x) => s + x.kgTotal, 0);
    const acidoBor = apl.acidoBoricoKg ?? 0;
    const totalSaisKg = apl.ureiaKg + acidoBor + saisMicros;

    let caldaNova = caldaOriginal;
    let pctFinal = totalSaisKg > 0 ? totalSaisKg / caldaOriginal : 0;
    let fatorVolume = 1;

    if (totalSaisKg > 0 && totalSaisKg / caldaOriginal > limiteAlvoPct) {
      // Calda mínima necessária para atingir 40%
      caldaNova = totalSaisKg / limiteAlvoPct;
      // Mas não menos do que estaria a 45% (teto)
      const caldaTeto = totalSaisKg / limiteMaxPct;
      if (caldaNova < caldaTeto) caldaNova = caldaTeto;
      fatorVolume = caldaNova / caldaOriginal;
      pctFinal = totalSaisKg / caldaNova;
      // Atualiza vazão L/ha e calda total
      apl.caldaTotalL = round(caldaNova, 0);
      apl.vazaoLHa = roundAplicacaoInteira(apl.vazaoLHa * fatorVolume);
      // Complexante principal (TSH/LIFE GROW/LEG) escala com o volume
      const compPct = complexPct[apl.complexante];
      apl.complexanteL = round5(caldaNova * compPct);
      // Complexantes extras (NitroPlus) escalam também (ligados à calda)
      (apl.complexantesExtraL ?? []).forEach((c) => { c.lTotal = round(c.lTotal * fatorVolume, 1); });
    }
    apl.ajusteSaisFator = round(pctFinal, 3); // agora guarda o % real de sais na calda

    // Recalcula kg/L por batida (1.000 L padrão)
    const numBatidas = Math.max(1, Math.ceil(apl.caldaTotalL / 1000));
    (apl.saisMicrosKg ?? []).forEach((s) => { s.kgPorBatida = round(s.kgTotal / numBatidas, 2); });
    (apl.complexantesExtraL ?? []).forEach((c) => { c.lPorBatida = round(c.lTotal / numBatidas, 1); });

    // ─── Reconstrói a receita por 1.000 L na ORDEM CORRETA ───
    // Ordem: Água (40%) → Bor → Ác. Bórico → Complexante principal (TSH/LIFE GROW/LEG)
    //        → Complexantes extras (NitroPlus) → Sais de micros → Ureia (último)
    //        → Água até completar.
    const batchL = 1000;
    const numBatidasReceita = Math.max(1, Math.ceil(apl.caldaTotalL / batchL));
    const novaReceita: ReceitaItem[] = [];
    let ord = 1;
    novaReceita.push({ ordem: ord++, ingrediente: "Água", quantidade: round(batchL * 0.4, 0), unidade: "L", instrucao: "Adicionar 40% do volume em água limpa" });

    // Boro (se houver — N180+B inseriu acidoBoricoKg/borL)
    if ((apl.borL ?? 0) > 0) {
      const borBat = (apl.borL ?? 0) / numBatidasReceita;
      novaReceita.push({ ordem: ord++, ingrediente: "Bor", quantidade: round(borBat, 2), unidade: "L", instrucao: "Adicionar o complexador de Boro" });
    }
    if ((apl.acidoBoricoKg ?? 0) > 0) {
      const abBat = (apl.acidoBoricoKg ?? 0) / numBatidasReceita;
      novaReceita.push({ ordem: ord++, ingrediente: "Ácido Bórico", quantidade: round(abBat, 2), unidade: "kg", instrucao: "Adicionar e agitar até dissolução" });
    }

    const extras = apl.complexantesExtraL ?? [];
    const extrasSemBor = extras.filter((c) => !c.nome.toLowerCase().includes("complex bor"));
    const temPrincipalExtra = extrasSemBor.some((c) => {
      const nome = c.nome.toLowerCase();
      return nome.includes("tsh") || nome.includes("leg") || nome.includes("life") || nome.includes("íon") || nome.includes("ion");
    });

    if (!usarIon) {
      novaReceita.push({
        ordem: ord++,
        ingrediente: nomeComplex(apl.complexante),
        quantidade: round(apl.complexanteL / numBatidasReceita, 1),
        unidade: "L",
        instrucao: `Adicionar ${nomeComplex(apl.complexante)} e agitar`,
      });
    }

    // Complexantes extras (NitroPlus): principal exclusivo, BOR, Estimull, Amino+.
    for (const c of extras) {
      if (c.lPorBatida <= 0) continue;
      novaReceita.push({ ordem: ord++, ingrediente: c.nome, quantidade: c.lPorBatida, unidade: "L", instrucao: "Complexante adicional (NitroPlus)" });
    }

    if (usarIon && !temPrincipalExtra) {
      const totalSaisSemBoro = (apl.saisMicrosKg ?? [])
        .filter((s) => s.simbolo.toLowerCase() !== "b")
        .reduce((acc, s) => acc + s.kgTotal, 0);
      if (totalSaisSemBoro > 0) {
        const ionBat = round(
          foliarRes.complexantes
            .filter((c) => c.produto.toLowerCase().includes("íon") || c.produto.toLowerCase().includes("ion"))
            .reduce((acc, c) => acc + c.lTotal, 0) / nFol / numBatidasReceita,
          1,
        );
        if (ionBat > 0) {
          novaReceita.push({ ordem: ord++, ingrediente: "Complex íON", quantidade: ionBat, unidade: "L", instrucao: "Adicionar Complex íON" });
        }
      }
    }

    // Sais de micros
    if ((apl.saisMicrosKg ?? []).length > 0) {
      novaReceita.push({ ordem: ord++, ingrediente: "— Micronutrientes (NitroPlus) —", quantidade: 0, unidade: "—", instrucao: "Adicionar os sais foliares lentamente" });
      for (const s of apl.saisMicrosKg!) {
        if (s.kgPorBatida <= 0) continue;
        novaReceita.push({ ordem: ord++, ingrediente: s.nome, quantidade: s.kgPorBatida, unidade: "kg", instrucao: `Fonte de ${s.simbolo}` });
      }
    }

    // Ureia — SEMPRE o último sal antes da água final
    novaReceita.push({
      ordem: ord++,
      ingrediente: "Ureia",
      quantidade: round(apl.ureiaKg / numBatidasReceita, 0),
      unidade: "kg",
      instrucao: "Adicionar a Ureia POR ÚLTIMO, lentamente e agitar",
    });

    novaReceita.push({ ordem: ord++, ingrediente: "Água (até o volume)", quantidade: 0, unidade: "L", instrucao: `Completar com água até ${batchL.toLocaleString("pt-BR")} L e misturar por 1 hora` });

    if (fatorVolume > 1) {
      novaReceita.push({
        ordem: ord++,
        ingrediente: `⚠ Calda ajustada (${(pctFinal * 100).toFixed(1)}% sais)`,
        quantidade: 0,
        unidade: "—",
        instrucao: `Vazão ajustada de ${roundAplicacaoInteira(caldaOriginal / areaHa)} para ${apl.vazaoLHa} L/ha para respeitar o limite de ${(limiteAlvoPct * 100).toFixed(0)}% de sais na calda`,
      });
    }

    apl.receita = novaReceita;
  }

  // 4) Atualiza o custo da Ureia (que pode ter sido reduzido) e adiciona custos dos micros
  const ureiaTotalKg = round5(aplicacoes.reduce((s, a) => s + a.ureiaKg, 0));
  const idxUreia = custos.findIndex((c) => c.item === "Ureia");
  if (idxUreia >= 0) {
    custos[idxUreia].quantidade = ureiaTotalKg;
    custos[idxUreia].total = round(ureiaTotalKg * precosUreia, 2);
  }
  const complexBaseAgg: Record<string, number> = {};
  for (const apl of aplicacoes) {
    const nome = nomeComplex(apl.complexante);
    complexBaseAgg[nome] = (complexBaseAgg[nome] ?? 0) + apl.complexanteL;
  }
  for (const item of custos) {
    if (!(item.item in complexBaseAgg)) continue;
    item.quantidade = round5(complexBaseAgg[item.item]);
    item.total = round(item.quantidade * item.precoUnitario, 2);
  }

  // Sais micros (somatório por sal nas aplicações)
  const saisAgg: Record<string, { kg: number; preco: number; sym: string }> = {};
  for (const sal of foliarRes.sais) saisAgg[sal.salNome] = { kg: 0, preco: sal.precoKg, sym: sal.simbolo };
  for (const apl of foliares) {
    for (const s of (apl.saisMicrosKg ?? [])) {
      if (!saisAgg[s.nome]) saisAgg[s.nome] = { kg: 0, preco: 0, sym: s.simbolo };
      saisAgg[s.nome].kg += s.kgTotal;
    }
  }
  for (const [nome, info] of Object.entries(saisAgg)) {
    const q = round(info.kg, 1);
    if (q > 0) custos.push({ item: nome, quantidade: q, unidade: "kg", precoUnitario: info.preco, total: round(q * info.preco, 2) });
  }

  // Complexantes (somatório por nome)
  const compAgg: Record<string, { l: number; preco: number }> = {};
  for (const c of foliarRes.complexantes) compAgg[c.produto] = { l: 0, preco: c.precoLitro };
  for (const apl of foliares) {
    for (const c of (apl.complexantesExtraL ?? [])) {
      if (!compAgg[c.nome]) compAgg[c.nome] = { l: 0, preco: 0 };
      compAgg[c.nome].l += c.lTotal;
    }
  }
  for (const [nome, info] of Object.entries(compAgg)) {
    const q = round(info.l, 1);
    if (q > 0) custos.push({ item: nome, quantidade: q, unidade: "L", precoUnitario: info.preco, total: round(q * info.preco, 2) });
  }
}

// ============================================================

// N32 FOLIAR — calculadora de comparativo
// ============================================================
function calcularN32(input: CalcInput, precos: Precos, _estagios: EstagioRegra[]): CalcResult {
  // Entradas:
  //   doseKgHa = L/ha do produto N32 do cliente
  //   n32GarantiaGL = garantia do N32 (g de N por L). DOCX: 5L × 32% = 1,6kg N → 320 g/L
  //   n32Intensidade = "fraca" | "padrao" | "forte" (default "forte").
  const cfg = input.motorConfig ?? {};
  const ureiaPctVol = (cfg.n180_ureia_kg_1000l ?? 400) / 1000;
  const lProdutoHa = input.doseKgHa;
  // n32_n_pct do motor config (padrão 32%) → garantia em g/L (densidade ≈ 1 kg/L → 32% = 320 g/L)
  const n32NPct = cfg.n32_n_pct ?? 32;
  const garantiaGL = input.n32GarantiaGL ?? Math.round(n32NPct * 10); // 320 g/L conforme DOCX
  const intensidade: IntensidadeLEG = input.n32Intensidade ?? "forte";

  // 1) kg.N/ha aplicados pelo N32 do cliente
  const nKgHa = (lProdutoHa * garantiaGL) / 1000;

  // 2) Conversão para calda N180 foliar
  //    Fórmula DOCX: 5L × 32% = 1,6kg N ÷ 16% = 10L/ha de calda
  //    Ou seja: caldaL = nKgHa / 0,16  (concentração foliar = 160g N/L)
  const caldaLHaRaw = nKgHa / 0.16;
  const caldaLHa = roundAplicacaoInteira(caldaLHaRaw);

  // 3) Aplicações foliares iguais (1 a 3, configurável) com LEG
  const numAplic = Math.max(1, Math.min(3, input.n32NumAplicacoes ?? 3));
  const por = caldaLHa / numAplic;
  const ests: EstagioId[] = (["v1_v2", "v4_v5", "v8"] as EstagioId[]).slice(0, numAplic);
  const legPor1000 = LEG_POR_1000L[intensidade];
  const legPctVol = legPor1000 / 1000;

  const aplicacoes: AplicacaoEstagio[] = ests.map((id, idx) => {
    const ord = idx + 1;
    const nome = `${ord}ª aplicação (vegetativo ou reprodutivo)`;
    const vazaoLHa = por;
    const caldaTotalEst = vazaoLHa * input.areaHa;
    const ureiaKgHa = vazaoLHa * ureiaPctVol;
    const complexanteL = caldaTotalEst * legPctVol;
    // Receita N32 foliar por 1.000L — DOCX: 400kg Ureia + 75L LEG + água
    // (ureia = 40% do volume = 400kg; LEG = 7,5% = 75L — intensidade "forte")
    const batchL = 1000;
    const ureiaKgBatch = round(batchL * ureiaPctVol, 0); // 400 kg
    const aguaInicialL = round(batchL * 0.40, 0);         // 400 L (40%)
    const receita: ReceitaItem[] = [
      { ordem: 1, ingrediente: "Água", quantidade: aguaInicialL, unidade: "L", instrucao: "Adicionar 40% do volume em água limpa" },
      { ordem: 2, ingrediente: "LEG", quantidade: legPor1000, unidade: "L", instrucao: `Adicionar LEG (${legPor1000}L por 1.000L — complexação ${intensidade})` },
      { ordem: 3, ingrediente: "Ureia", quantidade: ureiaKgBatch, unidade: "kg", instrucao: "Adicionar a Ureia lentamente e agitar bem" },
      { ordem: 4, ingrediente: "Água (até o volume)", quantidade: 0, unidade: "L", instrucao: `Completar com água até ${batchL.toLocaleString("pt-BR")} L e misturar por 1 hora` },
    ];
    return {
      id, nome,
      vazaoLHa: round(vazaoLHa, 1),
      caldaTotalL: round(caldaTotalEst, 0),
      complexante: "leg" as Complexante,
      ureiaKg: round(ureiaKgHa * input.areaHa, 0),
      ureiaKgHa: round(ureiaKgHa, 1),
      complexanteL: round(complexanteL, 1),
      receita,
    };
  });

  const custos: CustoItem[] = [];
  const ureiaTotal = round(aplicacoes.reduce((s, a) => s + a.ureiaKg, 0), 0);
  if (ureiaTotal > 0) custos.push({ item: "Ureia", quantidade: ureiaTotal, unidade: "kg", precoUnitario: precos.ureia_kg, total: round(ureiaTotal * precos.ureia_kg, 2) });
  const legTotal = round(aplicacoes.reduce((s, a) => s + a.complexanteL, 0), 1);
  if (legTotal > 0) custos.push({ item: "LEG", quantidade: legTotal, unidade: "L", precoUnitario: precos.leg_l, total: round(legTotal * precos.leg_l, 2) });
  const custoTotal = round(custos.reduce((s, c) => s + c.total, 0), 2);
  const custoPorHa = input.areaHa > 0 ? round(custoTotal / input.areaHa, 2) : 0;

  // Comparativo: produto N32 do cliente × NUTRIR foliar
  const refCustoHa = round(lProdutoHa * precos.n32_cliente_l, 2);
  const economiaHa = round(refCustoHa - custoPorHa, 2);
  const economiaPct = refCustoHa > 0 ? round((economiaHa / refCustoHa) * 100, 1) : 0;
  const economiaTotal = round(economiaHa * input.areaHa, 2);

  return {
    modo: "n32_foliar",
    nOriginalKgHa: round(nKgHa, 2),
    nResidualKgHa: round(nKgHa, 2),
    ureiaKgHa: round(aplicacoes.reduce((s, a) => s + a.ureiaKgHa, 0), 1),
    sulfatoLancoKgHa: 0,
    caldaTotalLHa: caldaLHa,
    caldaTotalL: round(caldaLHa * input.areaHa, 0),
    possuiMicron: false,
    vazaoMicronLHa: 0,
    vazaoEfetivaSulcoLHa: 0,
    aplicacoes,
    custos,
    custoTotal,
    custoPorHa,
    comparativo: {
      referenciaNome: "N32 (produto do cliente)",
      referenciaCustoHa: refCustoHa,
      referenciaDescricao: `${lProdutoHa} L/ha × R$ ${precos.n32_cliente_l.toFixed(2)}/L · ${nKgHa.toFixed(2)} kg.N/ha`,
      nutrirCustoHa: custoPorHa,
      nutrirDescricao: `NUTRIR Foliar — ${caldaLHa} L/ha (${intensidade}) · ${aplicacoes.length} aplicações`,
      economiaPorHa: economiaHa,
      economiaPercentual: economiaPct,
      economiaTotal,
    },
    resumo: `N32 ${lProdutoHa} L/ha (${garantiaGL} g/L) → ${nKgHa.toFixed(2)} kg.N/ha → ${caldaLHa} L/ha de calda NUTRIR (${intensidade}) em ${aplicacoes.length} aplicações`,
  };
}

// ============================================================
// HELPERS UI
// ============================================================
export const ADUBOS: { value: AduboBase; label: string; nPct: number }[] = [
  { value: "ureia_branca", label: "Ureia Branca (45% N)", nPct: 45 },
  { value: "ureia_protegida", label: "Ureia Protegida (45% N)", nPct: 45 },
  { value: "sulfato_amonio", label: "Sulfato de Amônio (21% N)", nPct: 21 },
  { value: "nitrato_amonio", label: "Nitrato de Amônio (33% N)", nPct: 33 },
];

export const COMPLEXANTES: { value: Complexante; label: string; pct: number }[] = [
  { value: "tsh", label: "TSH (6%)", pct: 6 },
  { value: "life_grow", label: "LIFE GROW (7,5%)", pct: 7.5 },
  { value: "leg", label: "LEG (2,5%)", pct: 2.5 },
];

export const MODOS: { value: FormulationMode; label: string; descricao: string }[] = [
  { value: "n180", label: "Ureia Complexada N180", descricao: "Substituição de adubação nitrogenada de base" },
  { value: "n180_b", label: "Ureia Complexada N180 + Boro", descricao: "Substituição N + complemento de Boro" },
  { value: "n180_micros", label: "N180 + Micros (NitroPlus)", descricao: "Ureia complexada + pacote de micronutrientes foliares" },
  { value: "n32_foliar", label: "Adubação Foliar Nitrogenada (N32)", descricao: "Comparativo de foliares N32" },
];

/** N entregue (kg/ha) por uma dose de adubo. */
export function calcularNKgHa(adubo: AduboBase, doseKgHa: number): number {
  return round(N_CONC[adubo] * doseKgHa, 1);
}
