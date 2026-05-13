/**
 * MOTOR — PROGRAMA NUTRIR — ADUBAÇÃO NPK
 *
 * Aplicação NUNCA é foliar / pulverizada — sempre via DRENCH, FERTIRRIGAÇÃO,
 * NONINO ou APLICAÇÃO LOCALIZADA (sulco, faixa).
 *
 * REGRA FUNDAMENTAL — SEMPRE MÁXIMA CONCENTRAÇÃO (receita base 1.000 L):
 *   - UREIA branca       → 300 kg / 1.000 L  (+ 12,5% TSH = 37,5 L)
 *   - KCl branco         → 200 kg / 1.000 L  (+ 10%   TSH = 20 L)
 *   - MAP purificado     → 200 kg / 1.000 L  (+ 10%   TSH = 20 L)
 *   - Limite global de sólidos: 50% (500 kg / 1.000 L)
 *
 * EXEMPLO PRODUTO FORMULADO (item 4):
 *   Cliente usa 200 Ureia + 100 MAP + 200 KCl  →  N=90, P=60, K=120 (kg/ha)
 *   Substituição NUTRIR (–60% N, –50% P, –40% K):
 *     N: 90 × 0,4 / 0,45 = 80 kg Ureia
 *     P: 60 × 0,5 / 0,60 = 50 kg MAP
 *     K: 120 × 0,6 / 0,60 = 120 kg KCl
 *   Calda total para 1 ha = max(80×3,33; 100/0,5) = 266 → arredonda 500 L
 *   Para 1.000 L (escalado): 160 kg Ureia + 100 kg MAP + 240 kg KCl + 54 L TSH
 *   Aplicação: 500 L/ha
 *
 * FÓRMULAS INDIVIDUAIS (1.000 L cada, máx concentração):
 *   N180 = 400 kg Ureia + 60 L TSH (ou 75 L Life Grow / 25 L LEG) + água
 *   K180 = 300 kg KCl  + 30 L TSH
 *   P180 = 300 kg MAP  + 30 L TSH
 *
 * APLICAÇÃO FRACIONADA (qualquer cultura):
 *   Usuário define quantas entradas para N, P e K. Onde houver coincidência
 *   (ex: 4N + 2P + 2K) → 2 batidas NPK completas + 2 batidas só N.
 *
 * CONVERSÕES ÓXIDO ↔ ELEMENTAR:
 *   P (elementar) = P₂O₅ × 0,4364
 *   K (elementar) = K₂O  × 0,8301
 */

// ============================================================
// TIPOS
// ============================================================
export type ModoEntradaNPK = "nutrientes" | "formula" | "cultura";
export type ModoProducao = "completa" | "individuais" | "fracionada";
export type ModoAplicacao = "drench" | "fertirrigacao" | "nonino" | "localizada";

export interface SalDisponivel {
  id: string;
  nome: string;
  precoKg: number;
  garantias: Record<string, number>;
}

export interface NPKDemanda {
  nKgHa: number;
  p2o5KgHa: number;
  k2oKgHa: number;
}

export interface NPKFormulaCliente {
  formula: string;
  doseKgHa: number;
  precoKg: number;
}

export interface SeleçãoMP {
  fonteNId: string;
  fontePId: string;
  fonteKId: string;
}

export interface NPKInput {
  modoEntrada: ModoEntradaNPK;
  modoProducao: ModoProducao;
  modoAplicacao: ModoAplicacao;
  /** Vazão do equipamento (L/ha) — se omitido, usa volume mínimo da calda */
  vazaoEquipamentoLHa?: number;
  /** Para Adubação Completa e Fracionada (produto único): nº de entradas */
  entradasLavoura?: number;
  /** Em fracionada com produtos separados, # de aplicações por nutriente */
  aplicacoesN?: number;
  aplicacoesP?: number;
  aplicacoesK?: number;
  /** Em fracionada — true = produto NPK único; false = N/P/K separados */
  produtoUnico?: boolean;

  demanda: NPKDemanda;
  areaHa: number;

  sais: SalDisponivel[];
  selecao: SeleçãoMP;

  precoTshL?: number;
  precoLifeGrowL?: number;
  precoLegL?: number;

  formulaCliente?: NPKFormulaCliente;
}

export interface ReceitaItem {
  ordem: number;
  ingrediente: string;
  quantidade: number;
  unidade: string;
  instrucao: string;
}

export interface BatidaCalda {
  nome: string;
  /** volume total da calda preparada (L) — múltiplo de 100 */
  volumeCaldaL: number;
  /** vazão de aplicação L/ha */
  vazaoLHa: number;
  /** kg/ha aplicados nesta entrada */
  ureiaKg: number;
  mapKg: number;
  kclKg: number;
  tshL: number;
  aguaL: number;
  /** receita base por 1.000 L (máx concentração) */
  receita1000L: ReceitaItem[];
  modo: ModoAplicacao;
}

export interface CustoItem {
  item: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  total: number;
}

export interface ComparativoNPK {
  nutrirCustoHa: number;
  mpEquivalentesCustoHa: number;
  mpEquivalentesDescricao: string;
  /** Volumes (kg/ha) de cada MP simples para atender N/P/K originais SEM complexação */
  mpEquivalentesUreiaKgHa: number;
  mpEquivalentesMapKgHa: number;
  mpEquivalentesKclKgHa: number;
  formuladoClienteCustoHa?: number;
  formuladoClienteDescricao?: string;
  /** kg/ha do adubo formulado que o cliente usaria */
  formuladoClienteDoseKgHa?: number;
  economiaVsMPHa: number;
  economiaVsMPPct: number;
  economiaVsMPTotal: number;
  economiaVsFormuladoHa?: number;
  economiaVsFormuladoPct?: number;
  economiaVsFormuladoTotal?: number;
}

export interface NPKResult {
  demanda: NPKDemanda;
  modoProducao: ModoProducao;
  modoAplicacao: ModoAplicacao;
  massas: {
    ureiaKgHa: number;
    mapKgHa: number;
    kclKgHa: number;
    nReduzidoKgHa: number;
    pReduzidoKgHa: number;
    kReduzidoKgHa: number;
  };
  batidas: BatidaCalda[];
  custos: CustoItem[];
  custoTotal: number;
  custoPorHa: number;
  comparativo: ComparativoNPK;
  resumo: string;
  alertas: string[];
}

// ============================================================
// CONSTANTES
// ============================================================
const MAX_KG_POR_1000L = { ureia: 300, kcl: 200, map: 200 } as const;
const TSH_PCT = { ureia: 0.125, kcl: 0.10, map: 0.10 } as const;

const REDUCAO = { N: 0.6, P: 0.5, K: 0.4 } as const;
const TEOR_NUTRIR = { ureia: 0.45, map_P: 0.60, kcl_K: 0.60 } as const;

export const P2O5_TO_P = 0.4364;
export const P_TO_P2O5 = 1 / P2O5_TO_P;
export const K2O_TO_K = 0.8301;
export const K_TO_K2O = 1 / K2O_TO_K;

// ============================================================
// HELPERS
// ============================================================
function round(v: number, d = 2): number { const f = Math.pow(10, d); return Math.round(v * f) / f; }
function round5(v: number): number { if (v <= 0) return 0; return Math.round(v / 5) * 5; }

export function formatarFormulaNPK(input: string): string {
  const limpo = input.replace(/\s/g, "");
  if (/[-/]/.test(limpo)) {
    const partes = limpo.split(/[-/]/).map((p) => p.padStart(2, "0").slice(0, 2));
    return partes.join("-");
  }
  const digits = limpo.replace(/\D/g, "");
  if (digits.length === 4) return `${digits.slice(0, 2)}-${digits.slice(2, 3)}-${digits.slice(3)}`;
  if (digits.length === 5) return `${digits.slice(0, 2)}-${digits.slice(2, 3)}-${digits.slice(3)}`;
  if (digits.length === 6) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  return limpo;
}

export function parseFormulaNPK(formula: string): { nPct: number; p2o5Pct: number; k2oPct: number } | null {
  const f = formatarFormulaNPK(formula);
  const partes = f.split(/[-/]/);
  if (partes.length < 3) return null;
  const [n, p, k] = partes.map((v) => Number(v));
  if (!isFinite(n) || !isFinite(p) || !isFinite(k)) return null;
  return { nPct: n, p2o5Pct: p, k2oPct: k };
}

export function formulaParaDemanda(formula: string, doseKgHa: number): NPKDemanda | null {
  const parsed = parseFormulaNPK(formula);
  if (!parsed) return null;
  return {
    nKgHa: round((parsed.nPct / 100) * doseKgHa, 2),
    p2o5KgHa: round((parsed.p2o5Pct / 100) * doseKgHa, 2),
    k2oKgHa: round((parsed.k2oPct / 100) * doseKgHa, 2),
  };
}

export function demandaPorCultura(args: {
  produtividadeKgHa: number;
  extracoes: { simbolo: "N" | "P" | "K"; kgPorTon: number }[];
}): NPKDemanda {
  const tonHa = args.produtividadeKgHa / 1000;
  const get = (s: "N" | "P" | "K") => args.extracoes.find((e) => e.simbolo === s)?.kgPorTon ?? 0;
  return {
    nKgHa: round(get("N") * tonHa, 2),
    p2o5KgHa: round(get("P") * tonHa * P_TO_P2O5, 2),
    k2oKgHa: round(get("K") * tonHa * K_TO_K2O, 2),
  };
}

// ============================================================
// MASSAS NUTRIR (com redução)
// ============================================================
function calcularMassasNutrir(demanda: NPKDemanda) {
  const nReduzido = demanda.nKgHa * (1 - REDUCAO.N);
  const pElemAlvo = demanda.p2o5KgHa * P2O5_TO_P;
  const pReduzido = pElemAlvo * (1 - REDUCAO.P);
  const kElemAlvo = demanda.k2oKgHa * K2O_TO_K;
  const kReduzido = kElemAlvo * (1 - REDUCAO.K);

  return {
    ureiaKgHa: round5(nReduzido / TEOR_NUTRIR.ureia),
    mapKgHa: round5(pReduzido / TEOR_NUTRIR.map_P),
    kclKgHa: round5(kReduzido / TEOR_NUTRIR.kcl_K),
    nReduzidoKgHa: round(nReduzido, 1),
    pReduzidoKgHa: round(pReduzido, 1),
    kReduzidoKgHa: round(kReduzido, 1),
  };
}

// ============================================================
// MONTAGEM DE BATIDA — sempre máxima concentração
// ============================================================
/**
 * Recebe kg/ha de cada sólido. Sempre monta receita base por 1.000 L na
 * concentração máxima e dimensiona o volume da calda apenas pela quantidade
 * que cabe respeitando o gargalo do sal mais "carregado".
 *
 * Volume mínimo (L) por sal:
 *   ureia × 1000 / 300  (limite máx)
 *   kcl   × 1000 / 200
 *   map   × 1000 / 200
 *   somaSolidos × 1000 / 500   (limite global 50%)
 */
function montarBatida(args: {
  nome: string;
  ureiaKg: number;
  mapKg: number;
  kclKg: number;
  modo: ModoAplicacao;
  vazaoEquipamentoLHa?: number;
}): BatidaCalda {
  const { nome, ureiaKg, mapKg, kclKg, modo } = args;
  const somaSolidos = ureiaKg + mapKg + kclKg;

  const volPorUreia = (ureiaKg * 1000) / MAX_KG_POR_1000L.ureia;
  const volPorKcl = (kclKg * 1000) / MAX_KG_POR_1000L.kcl;
  const volPorMap = (mapKg * 1000) / MAX_KG_POR_1000L.map;
  const volPorGlobal = (somaSolidos * 1000) / 500;

  let volumeCaldaL = Math.max(volPorUreia, volPorKcl, volPorMap, volPorGlobal);
  volumeCaldaL = Math.ceil(volumeCaldaL / 100) * 100;
  if (volumeCaldaL < 100 && somaSolidos > 0) volumeCaldaL = 100;

  // Vazão preferida = vazão do equipamento (mas não pode ser menor que o volume da calda;
  // se for menor, sobe o volume da calda para o múltiplo de 100 acima da vazão).
  let vazaoLHa = args.vazaoEquipamentoLHa ?? volumeCaldaL;
  if (vazaoLHa < volumeCaldaL) {
    // Equipamento aplica menos que o volume necessário — alinhar volume = vazão
    // mas isso violaria diluição mínima. Manter volume e avisar via vazão = volume.
    vazaoLHa = volumeCaldaL;
  } else if (vazaoLHa > volumeCaldaL) {
    // Aplica mais água — aumentar volume da calda ao múltiplo de 100 da vazão
    volumeCaldaL = Math.ceil(vazaoLHa / 100) * 100;
  }

  const tshL =
    ureiaKg * TSH_PCT.ureia +
    kclKg * TSH_PCT.kcl +
    mapKg * TSH_PCT.map;

  const aguaL = Math.max(0, volumeCaldaL - tshL);

  // RECEITA BASE 1.000 L na máxima concentração
  // Se houver mais de um sal, escalar proporcionalmente até que o sal "gargalo"
  // atinja o seu máximo.
  const ratios = [
    ureiaKg > 0 ? ureiaKg / MAX_KG_POR_1000L.ureia : 0,
    kclKg > 0 ? kclKg / MAX_KG_POR_1000L.kcl : 0,
    mapKg > 0 ? mapKg / MAX_KG_POR_1000L.map : 0,
  ];
  const maxR = Math.max(...ratios);
  const escala = maxR > 0 ? 1 / maxR : 1; // multiplica para 1.000 L
  const ureia1000 = round5(ureiaKg * escala);
  const kcl1000 = round5(kclKg * escala);
  const map1000 = round5(mapKg * escala);
  const tsh1000 = round(
    ureia1000 * TSH_PCT.ureia +
    kcl1000 * TSH_PCT.kcl +
    map1000 * TSH_PCT.map, 1,
  );

  const receita1000L: ReceitaItem[] = [];
  let ord = 1;
  receita1000L.push({ ordem: ord++, ingrediente: "Água", quantidade: 500, unidade: "L", instrucao: "Adicionar ~500 L de água limpa e iniciar agitação" });
  if (tsh1000 > 0) receita1000L.push({ ordem: ord++, ingrediente: "TSH", quantidade: tsh1000, unidade: "L", instrucao: "Adicionar TSH" });
  if (kcl1000 > 0) receita1000L.push({ ordem: ord++, ingrediente: "KCl Branco", quantidade: kcl1000, unidade: "kg", instrucao: "Adicionar KCl Branco e agitar até dissolução" });
  if (map1000 > 0) receita1000L.push({ ordem: ord++, ingrediente: "MAP Purificado", quantidade: map1000, unidade: "kg", instrucao: "Adicionar MAP Purificado e agitar" });
  if (ureia1000 > 0) receita1000L.push({ ordem: ord++, ingrediente: "Ureia Branca", quantidade: ureia1000, unidade: "kg", instrucao: "Adicionar Ureia lentamente e agitar" });
  receita1000L.push({ ordem: ord++, ingrediente: "Água (até completar)", quantidade: 0, unidade: "L", instrucao: "Completar com água até 1.000 L e agitar 30–60 min antes da aplicação" });

  return {
    nome,
    volumeCaldaL,
    vazaoLHa: round(vazaoLHa, 0),
    ureiaKg: round5(ureiaKg),
    mapKg: round5(mapKg),
    kclKg: round5(kclKg),
    tshL: round(tshL, 1),
    aguaL: round(aguaL, 0),
    receita1000L,
    modo,
  };
}

// ============================================================
// CÁLCULO PRINCIPAL
// ============================================================
export function calcularNPK(input: NPKInput): NPKResult {
  const { demanda, sais, areaHa, modoProducao, modoAplicacao } = input;
  const alertas: string[] = [];
  const massas = calcularMassasNutrir(demanda);

  const batidas: BatidaCalda[] = [];

  if (modoProducao === "completa") {
    const entradas = Math.max(1, input.entradasLavoura ?? 1);
    const ureiaB = massas.ureiaKgHa / entradas;
    const mapB = massas.mapKgHa / entradas;
    const kclB = massas.kclKgHa / entradas;
    for (let i = 1; i <= entradas; i++) {
      batidas.push(montarBatida({
        nome: entradas === 1 ? "Adubação NPK Completa" : `NPK Completo — Entrada ${i}/${entradas}`,
        ureiaKg: ureiaB, mapKg: mapB, kclKg: kclB,
        modo: modoAplicacao,
        vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
      }));
    }
  } else if (modoProducao === "individuais") {
    if (massas.ureiaKgHa > 0) batidas.push(montarBatida({
      nome: "N180 — Ureia Complexada",
      ureiaKg: massas.ureiaKgHa, mapKg: 0, kclKg: 0,
      modo: modoAplicacao, vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
    }));
    if (massas.mapKgHa > 0) batidas.push(montarBatida({
      nome: "P180 — MAP Purificado Complexado",
      ureiaKg: 0, mapKg: massas.mapKgHa, kclKg: 0,
      modo: modoAplicacao, vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
    }));
    if (massas.kclKgHa > 0) batidas.push(montarBatida({
      nome: "K180 — KCl Branco Complexado",
      ureiaKg: 0, mapKg: 0, kclKg: massas.kclKgHa,
      modo: modoAplicacao, vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
    }));
  } else {
    // FRACIONADA — disponível para qualquer cultura
    if (input.produtoUnico !== false) {
      const entradas = Math.max(1, input.entradasLavoura ?? 1);
      const ureiaB = massas.ureiaKgHa / entradas;
      const mapB = massas.mapKgHa / entradas;
      const kclB = massas.kclKgHa / entradas;
      for (let i = 1; i <= entradas; i++) {
        batidas.push(montarBatida({
          nome: `NPK Único — Entrada ${i}/${entradas}`,
          ureiaKg: ureiaB, mapKg: mapB, kclKg: kclB,
          modo: modoAplicacao, vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
        }));
      }
    } else {
      // Aplicações independentes por nutriente — agrupa quando houver coincidência.
      // Exemplo: 4N + 2P + 2K → 2 NPK completas + 2 só N.
      const nApls = Math.max(0, input.aplicacoesN ?? 0);
      const pApls = Math.max(0, input.aplicacoesP ?? 0);
      const kApls = Math.max(0, input.aplicacoesK ?? 0);

      const ureiaPorN = nApls > 0 ? massas.ureiaKgHa / nApls : 0;
      const mapPorP = pApls > 0 ? massas.mapKgHa / pApls : 0;
      const kclPorK = kApls > 0 ? massas.kclKgHa / kApls : 0;

      const total = Math.max(nApls, pApls, kApls);
      for (let i = 1; i <= total; i++) {
        const temN = i <= nApls;
        const temP = i <= pApls;
        const temK = i <= kApls;
        const partes: string[] = [];
        if (temN) partes.push("N");
        if (temP) partes.push("P");
        if (temK) partes.push("K");
        const titulo = partes.length === 3 ? "NPK" : partes.join("");
        batidas.push(montarBatida({
          nome: `${titulo} — Entrada ${i}/${total}`,
          ureiaKg: temN ? ureiaPorN : 0,
          mapKg: temP ? mapPorP : 0,
          kclKg: temK ? kclPorK : 0,
          modo: modoAplicacao,
          vazaoEquipamentoLHa: input.vazaoEquipamentoLHa,
        }));
      }
    }
  }

  // CUSTOS
  const fonteN = sais.find((s) => s.id === input.selecao.fonteNId);
  const fonteP = sais.find((s) => s.id === input.selecao.fontePId);
  const fonteK = sais.find((s) => s.id === input.selecao.fonteKId);
  const precoUreia = Number(fonteN?.precoKg ?? 0);
  const precoMap = Number(fonteP?.precoKg ?? 0);
  const precoKcl = Number(fonteK?.precoKg ?? 0);
  const precoTsh = input.precoTshL ?? 0;

  const tshTotalLHa = batidas.reduce((s, b) => s + b.tshL, 0);
  const custos: CustoItem[] = [
    { item: "Ureia Branca", quantidade: massas.ureiaKgHa, unidade: "kg/ha", precoUnitario: precoUreia, total: round(massas.ureiaKgHa * precoUreia, 2) },
    { item: "MAP Purificado", quantidade: massas.mapKgHa, unidade: "kg/ha", precoUnitario: precoMap, total: round(massas.mapKgHa * precoMap, 2) },
    { item: "KCl Branco", quantidade: massas.kclKgHa, unidade: "kg/ha", precoUnitario: precoKcl, total: round(massas.kclKgHa * precoKcl, 2) },
    { item: "TSH (Complexante)", quantidade: round(tshTotalLHa, 1), unidade: "L/ha", precoUnitario: precoTsh, total: round(tshTotalLHa * precoTsh, 2) },
  ];
  const custoPorHa = round(custos.reduce((s, c) => s + c.total, 0), 2);
  const custoTotal = round(custoPorHa * areaHa, 2);

  // COMPARATIVOS
  // (a) MPs equivalentes a preço de mercado — atender N/P/K originais SEM redução
  const ureiaEqKg = demanda.nKgHa / TEOR_NUTRIR.ureia;
  const mapEqKg = (demanda.p2o5KgHa * P2O5_TO_P) / TEOR_NUTRIR.map_P;
  const kclEqKg = (demanda.k2oKgHa * K2O_TO_K) / TEOR_NUTRIR.kcl_K;
  const mpEqCustoHa = round(ureiaEqKg * precoUreia + mapEqKg * precoMap + kclEqKg * precoKcl, 2);
  const mpEqDesc = `${round5(ureiaEqKg)}kg Ureia + ${round5(mapEqKg)}kg MAP + ${round5(kclEqKg)}kg KCl (sem complexação)`;

  let formCustoHa: number | undefined;
  let formDesc: string | undefined;
  let ecoFormHa: number | undefined;
  let ecoFormPct: number | undefined;
  let ecoFormTotal: number | undefined;
  if (input.formulaCliente && input.formulaCliente.precoKg > 0 && input.formulaCliente.doseKgHa > 0) {
    formCustoHa = round(input.formulaCliente.doseKgHa * input.formulaCliente.precoKg, 2);
    formDesc = `${input.formulaCliente.doseKgHa} kg/ha de ${formatarFormulaNPK(input.formulaCliente.formula)} a ${input.formulaCliente.precoKg.toFixed(2)} R$/kg`;
    ecoFormHa = round(formCustoHa - custoPorHa, 2);
    ecoFormPct = formCustoHa > 0 ? round((ecoFormHa / formCustoHa) * 100, 1) : 0;
    ecoFormTotal = round(ecoFormHa * areaHa, 2);
  }

  const ecoMPHa = round(mpEqCustoHa - custoPorHa, 2);
  const ecoMPPct = mpEqCustoHa > 0 ? round((ecoMPHa / mpEqCustoHa) * 100, 1) : 0;
  const ecoMPTotal = round(ecoMPHa * areaHa, 2);

  const resumo =
    `NPK NUTRIR: ${massas.ureiaKgHa}kg Ureia + ${massas.mapKgHa}kg MAP + ${massas.kclKgHa}kg KCl + ${round(tshTotalLHa, 1)}L TSH/ha · ` +
    `${batidas.length} entrada(s) · R$ ${custoPorHa.toFixed(2)}/ha`;

  if (massas.ureiaKgHa === 0 && demanda.nKgHa > 0) alertas.push("N requerido mas Ureia = 0 — verifique a fonte.");
  if (massas.mapKgHa === 0 && demanda.p2o5KgHa > 0) alertas.push("P requerido mas MAP = 0 — verifique a fonte.");
  if (massas.kclKgHa === 0 && demanda.k2oKgHa > 0) alertas.push("K requerido mas KCl = 0 — verifique a fonte.");

  return {
    demanda, modoProducao, modoAplicacao, massas, batidas, custos, custoTotal, custoPorHa,
    comparativo: {
      nutrirCustoHa: custoPorHa,
      mpEquivalentesCustoHa: mpEqCustoHa,
      mpEquivalentesDescricao: mpEqDesc,
      mpEquivalentesUreiaKgHa: round5(ureiaEqKg),
      mpEquivalentesMapKgHa: round5(mapEqKg),
      mpEquivalentesKclKgHa: round5(kclEqKg),
      formuladoClienteCustoHa: formCustoHa,
      formuladoClienteDescricao: formDesc,
      formuladoClienteDoseKgHa: input.formulaCliente?.doseKgHa,
      economiaVsMPHa: ecoMPHa,
      economiaVsMPPct: ecoMPPct,
      economiaVsMPTotal: ecoMPTotal,
      economiaVsFormuladoHa: ecoFormHa,
      economiaVsFormuladoPct: ecoFormPct,
      economiaVsFormuladoTotal: ecoFormTotal,
    },
    resumo, alertas,
  };
}

// Aliases retrocompatíveis
export const calcularNPKFoliar = calcularNPK;
export type NPKFoliarResult = NPKResult;
export type NPKFoliarInput = NPKInput;
