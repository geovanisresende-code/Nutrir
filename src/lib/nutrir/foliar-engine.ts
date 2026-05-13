/**
 * MOTOR — ADUBAÇÃO FOLIAR (NUTRIR)
 *
 * Replica a lógica da planilha TPD (aba CONTAS.FORM, seção FOLIAR — linhas 1 a 18).
 * Cobre: micronutrientes + nutrientes benéficos + extras (Carbo Alga / Life Grow).
 * NÃO cobre Ureia ainda (módulo Ureia Complexada faz isso); a fusão será posterior.
 *
 * Caso-teste de referência: Cristiano / Milho / 3.000 ha / batida 6.000 L / Complex LEG / PADRÃO
 *   — total foliar ≈ 48 L/ha; LEG ≈ 155 L/bat; BOR ≈ 130 L/bat; Estimull 18; Amino+ 36
 */

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

export type NivelComplexacao = "forte" | "padrao" | "fraca";
export type ComplexadorPrincipal = "leg" | "tsh" | "ion";

export interface SalCatalogo {
  id: string;
  nome: string;
  precoKg: number;
  nutrienteSimbolo: string; // ex: "Mn"
  garantiaPercent: number;  // 0..100
}

export interface NutrienteEntrada {
  /** símbolo (Mn, Mg, Zn, Cu, P, K, B, S, Ca, N, Co, Mo, Ni, Se, Si, Fe) */
  simbolo: string;
  /** rótulo amigável */
  nome: string;
  /** dose alvo em gr/ha (foliar) */
  doseGrHa: number;
  /** classificação para UI */
  grupo: "essencial" | "beneficio";
}

export interface FatorComplexacao {
  /** chave: complexador em minúsculo (leg, tsh, ion, bor, estimull, amino) */
  complexador: string;
  /** símbolo do nutriente */
  simbolo: string;
  fatorLPorKgSal: number;
}

export type AplicacaoMicroSolo = "nao" | "junto_adubo" | "pulverizador";

export interface EstagioSelecionado {
  id?: string;
  nome: string;
  ordem?: number;
}

export interface FoliarInput {
  produtor: string;
  fazenda: string;
  cultura: string;
  areaHa: number;

  /** vazão do pulverizador L/ha (ex.: 55) */
  vazaoPulverizadorLHa: number;
  /** número de entradas (aplicações foliares) na lavoura */
  numeroEntradas: number;
  /** estágios fenológicos selecionados para aplicação */
  estagios: EstagioSelecionado[];
  /** aplicação de micros no solo */
  microNoSolo: AplicacaoMicroSolo;
  /** aplicação diária ha/dia (ex.: 1000) */
  aplicacaoDiariaHa: number;

  /** volume da batida (tanque) — padrão 1000L (planilha usa 6000) */
  volumeBatidaL: number;

  /** complexação */
  nivel: NivelComplexacao;
  complexador: ComplexadorPrincipal;

  /** preços dos complexantes em R$/L */
  precos: {
    legPorL: number;
    tshPorL: number;
    ionPorL: number;
    borPorL: number;
    estimullPorL: number;
    aminoPorL: number;
    carboAlgaPorL: number;
    lifeGrowPorL: number;
  };

  /** entradas de nutrientes (micros + benéficos) */
  nutrientes: NutrienteEntrada[];

  /** extras em mL/ha (Carbo Alga = extrato algas, Life Grow = condicionador) */
  extratoAlgasMlHa: number;
  condicionadorSoloMlHa: number;

  /** custo por ha do programa convencional (foliares) — usado no comparativo */
  custoFoliarConvencionalRsHa: number;

  /** sais cadastrados (com nutrientes) */
  sais: SalCatalogo[];

  /** fatores de complexação cadastrados */
  fatores: FatorComplexacao[];
}

export interface SalCalculado {
  simbolo: string;
  nutrienteNome: string;
  salNome: string;
  precoKg: number;
  garantiaPercent: number;
  doseGrHa: number;
  /** sais gr/ha = dose ÷ (garantia/100) */
  saisGrHa: number;
  /** sais kg na área total */
  saisAreaKg: number;
  /** kg por batida */
  kgPorBatida: number;
  /** diluição L (sais kg × 2,5) */
  diluicaoL: number;
  custoTotalRs: number;
}

export interface ComplexanteCalculado {
  produto: string;
  /** L por batida */
  lPorBatida: number;
  /** L total na área */
  lTotal: number;
  precoLitro: number;
  custoTotalRs: number;
  custoPorHa: number;
}

export interface ReceitaItem {
  ordem: number;
  ingrediente: string;
  quantidade: number;
  unidade: string; // "L" | "kg" | "—"
  instrucao: string;
  isInstrucao?: boolean;
}

export interface ListaCompraItem {
  produto: string;
  unidade: string;
  quantidadeArea: number;
  arredondado: number;
  precoUnit: number;
  custoTotal: number;
  embalagem?: string;
}

export interface AplicacaoEstagio {
  ordem: number;
  nome: string;
  tipo: "drench" | "foliar";
  itens: { produto: string; quantidade: number; unidade: string }[];
  observacao?: string;
}

export interface FoliarResultado {
  sais: SalCalculado[];
  complexantes: ComplexanteCalculado[];
  receita: ReceitaItem[];

  totalDiluicaoL: number;
  aplicacaoFoliarLHa: number;
  numeroBatidas: number;
  numeroAplicacoes: number;
  diasParaCobrir: number;

  aplicacoesPorEstagio: AplicacaoEstagio[];

  custoFoliarTotalRs: number;
  custoFoliarRsHa: number;

  comparativo: {
    convencionalRsHa: number;
    nutrirRsHa: number;
    economiaRsHa: number;
    economiaPercent: number;
    economiaTotalRs: number;
  };

  listaCompras: ListaCompraItem[];

  alertas: string[];
}

// ────────────────────────────────────────────────────────────
// CONSTANTES (planilha)
// ────────────────────────────────────────────────────────────

/** Fator de diluição padrão dos sais foliares (planilha CONTAS.FORM coluna G) */
const FATOR_DILUICAO = 2.5;

/** Fatores ESTIMULL e AMINO+ por nível (do motor antigo, alinhados à planilha) */
const FATOR_ESTIMULL: Record<NivelComplexacao, number> = {
  forte: 0.007,
  padrao: 0.06,
  fraca: 0.003,
};
const FATOR_AMINO: Record<NivelComplexacao, number> = {
  forte: 0.015,
  padrao: 0.12,
  fraca: 0.005,
};

/** Mapeamento símbolo → matéria-prima preferida (planilha C.M.P) */
const SAL_PREFERIDO: Record<string, string> = {
  mn: "sulfato de manganes",
  mg: "sulfato de magnesio",
  zn: "sulfato de zinco",
  cu: "sulfato de cobre",
  b: "acido borico",
  mo: "molibdato de sodio",
  co: "sulfato de cobalto",
  ni: "sulfato de niquel",
  p: "map purificado",
  se: "selenito de sodio",
  k: "kcl branco",
  ca: "nitrato de calcio",
  si: "silicato de potassio",
  fe: "sulfato ferrico",
  s: "sulfato de magnesio", // S geralmente vem como subproduto do Mg
  n: "ureia", // foliar (mas Ureia fica no módulo dedicado por ora)
};

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

const stripAcc = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function mround(value: number, mult: number): number {
  if (mult <= 0) return Math.round(value);
  return Math.round(value / mult) * mult;
}
function round1(v: number) { return Math.round(v * 10) / 10; }
function round2(v: number) { return Math.round(v * 100) / 100; }
function roundAplicacaoInteira(v: number) {
  if (!isFinite(v) || v <= 0) return 0;
  const base = Math.trunc(v);
  const frac = v - base;
  if (Math.abs(frac) < 1e-9) return base;
  if (Math.abs(frac - 0.5) < 1e-9) return base;
  return Math.ceil(v);
}

function nomeComplexador(c: ComplexadorPrincipal): string {
  return ({ leg: "Complex LEG", tsh: "Complex TSH", ion: "Complex íON" } as const)[c];
}
function precoComplexador(c: ComplexadorPrincipal, p: FoliarInput["precos"]): number {
  return c === "leg" ? p.legPorL : c === "tsh" ? p.tshPorL : p.ionPorL;
}

/** Procura o melhor sal para um nutriente */
function escolherSal(simbolo: string, sais: SalCatalogo[]): SalCatalogo | undefined {
  const sym = simbolo.toLowerCase();
  const preferido = SAL_PREFERIDO[sym];

  // 1) por nome preferido
  if (preferido) {
    const norm = stripAcc(preferido);
    const found = sais.find(s => stripAcc(s.nome).includes(norm) && s.garantiaPercent > 0);
    if (found) return found;
  }
  // 2) por símbolo do nutriente
  const candidatos = sais.filter(s =>
    s.nutrienteSimbolo.toLowerCase() === sym && s.garantiaPercent > 0
  );
  if (candidatos.length === 0) return undefined;
  // prefere o de menor preço
  return candidatos.sort((a, b) => (a.precoKg || 0) - (b.precoKg || 0))[0];
}

/** Busca fator do complexador para um nutriente; usa fallback genérico se não houver */
function obterFator(
  fatores: FatorComplexacao[],
  complexador: string,
  simbolo: string,
  fallback: number
): number {
  const c = complexador.toLowerCase();
  const s = simbolo.toLowerCase();
  const f = fatores.find(
    x => x.complexador.toLowerCase() === c && x.simbolo.toLowerCase() === s
  );
  return f ? f.fatorLPorKgSal : fallback;
}

// ────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL
// ────────────────────────────────────────────────────────────

export function calcularFoliar(input: FoliarInput): FoliarResultado {
  const alertas: string[] = [];
  const area = Math.max(1, input.areaHa);
  const volBatida = Math.max(100, input.volumeBatidaL);

  // 1) Calcular sais necessários (somente nutrientes com dose > 0)
  const sais: SalCalculado[] = [];
  for (const n of input.nutrientes) {
    if (!n.doseGrHa || n.doseGrHa <= 0) continue;
    const sal = escolherSal(n.simbolo, input.sais);
    if (!sal) {
      alertas.push(`Sem sal cadastrado para ${n.nome} (${n.simbolo}).`);
      continue;
    }
    const garantia = sal.garantiaPercent / 100;
    if (garantia <= 0) continue;

    const saisGrHa = Math.round(n.doseGrHa / garantia);
    const saisAreaGr = saisGrHa * area;
    const saisAreaKg = Math.round(saisAreaGr / 1000);
    const diluicaoL = Math.round(saisAreaKg * FATOR_DILUICAO);

    sais.push({
      simbolo: n.simbolo,
      nutrienteNome: n.nome,
      salNome: sal.nome,
      precoKg: sal.precoKg ?? 0,
      garantiaPercent: sal.garantiaPercent,
      doseGrHa: n.doseGrHa,
      saisGrHa,
      saisAreaKg,
      kgPorBatida: 0,    // preenchido depois
      diluicaoL,
      custoTotalRs: 0,   // preenchido depois
    });
  }

  // 2) Volume foliar L/ha = soma diluições / área (planilha: H40 / area = lts/há)
  const totalDiluicaoL = sais.reduce((acc, s) => acc + s.diluicaoL, 0);
  const aplicacaoFoliarLHa = area > 0 ? roundAplicacaoInteira(totalDiluicaoL / area) : 0;
  const volumeTotalFoliar = aplicacaoFoliarLHa * area;
  const numeroBatidas = Math.max(1, Math.round(volumeTotalFoliar / volBatida));

  // Atualizar kg/batida e custo por sal
  for (const s of sais) {
    s.kgPorBatida = round2(s.saisAreaKg / numeroBatidas);
    s.custoTotalRs = round2(s.saisAreaKg * s.precoKg);
  }

  // 3) Complexantes
  const complexantes: ComplexanteCalculado[] = [];

  // 3.a — Complexador principal (LEG/TSH/ÍON)
  // Soma para cada sal: MROUND(kgPorBatida × fator_específico, 0,5)
  // Ácido Bórico fica de fora (tem Complex BOR próprio).
  const cKey = input.complexador; // 'leg' | 'tsh' | 'ion'
  let somaPrincipal = 0;
  for (const s of sais) {
    if (stripAcc(s.salNome).includes("borico")) continue;
    const fator = obterFator(input.fatores, cKey, s.simbolo, 0.14);
    somaPrincipal += mround(s.kgPorBatida * fator, 0.5);
  }
  const principalLPorBatida = mround(somaPrincipal, 5);
  if (principalLPorBatida > 0) {
    const preco = precoComplexador(cKey, input.precos);
    const lTotal = principalLPorBatida * numeroBatidas;
    complexantes.push({
      produto: nomeComplexador(cKey),
      lPorBatida: principalLPorBatida,
      lTotal,
      precoLitro: preco,
      custoTotalRs: round2(lTotal * preco),
      custoPorHa: round2((lTotal * preco) / area),
    });
  }

  // 3.b — Complex BOR (sempre que houver Ácido Bórico)
  const salBorico = sais.find(s => stripAcc(s.salNome).includes("borico"));
  const temBoro = !!(salBorico && salBorico.kgPorBatida > 0);
  const temMicrosAlemBoro = sais.some(
    (s) => s.kgPorBatida > 0 && !stripAcc(s.salNome).includes("borico"),
  );

  if (cKey !== "ion" && temBoro && salBorico) {
    const fatorBor = obterFator(input.fatores, "complex bor", "B", 0.6);
    const lPorBat = mround(salBorico.kgPorBatida * fatorBor, 1);
    const lTotal = lPorBat * numeroBatidas;
    complexantes.push({
      produto: "Complex BOR",
      lPorBatida: lPorBat,
      lTotal,
      precoLitro: input.precos.borPorL,
      custoTotalRs: round2(lTotal * input.precos.borPorL),
      custoPorHa: round2((lTotal * input.precos.borPorL) / area),
    });
  }

  // 3.c — ESTIMULL e AMINO+
  // Fórmula da planilha: MROUND(fator × somaSaisGrHa / appLha, mult) × volBatida/1000
  const totalSaisGrHa = sais.reduce((acc, s) => acc + s.saisGrHa, 0);
  const appLha = aplicacaoFoliarLHa || 1;

  if (cKey !== "ion" && temMicrosAlemBoro) {
    const estFator = FATOR_ESTIMULL[input.nivel];
    const estRaw = estFator * totalSaisGrHa / appLha;
    const estLPorBat = round1(mround(estRaw, 0.5) * volBatida / 1000);
    if (estLPorBat > 0) {
      const lTotal = estLPorBat * numeroBatidas;
      complexantes.push({
        produto: "Estimull",
        lPorBatida: estLPorBat,
        lTotal,
        precoLitro: input.precos.estimullPorL,
        custoTotalRs: round2(lTotal * input.precos.estimullPorL),
        custoPorHa: round2((lTotal * input.precos.estimullPorL) / area),
      });
    }

    const amFator = FATOR_AMINO[input.nivel];
    const amRaw = amFator * totalSaisGrHa / appLha;
    const amLPorBat = round1(mround(amRaw, 1) * volBatida / 1000);
    if (amLPorBat > 0) {
      const lTotal = amLPorBat * numeroBatidas;
      complexantes.push({
        produto: "Amino+",
        lPorBatida: amLPorBat,
        lTotal,
        precoLitro: input.precos.aminoPorL,
        custoTotalRs: round2(lTotal * input.precos.aminoPorL),
        custoPorHa: round2((lTotal * input.precos.aminoPorL) / area),
      });
    }
  }

  // 3.d — Carbo Alga (extrato de algas) — entrada em mL/ha
  if (input.extratoAlgasMlHa > 0) {
    const lTotal = round2((input.extratoAlgasMlHa * area) / 1000);
    const lPorBat = round2(lTotal / numeroBatidas);
    complexantes.push({
      produto: "Carbo Alga (Extrato de Algas)",
      lPorBatida: lPorBat,
      lTotal,
      precoLitro: input.precos.carboAlgaPorL,
      custoTotalRs: round2(lTotal * input.precos.carboAlgaPorL),
      custoPorHa: round2((lTotal * input.precos.carboAlgaPorL) / area),
    });
  }

  // 3.e — Life Grow (condicionador de solo) — entrada em mL/ha
  if (input.condicionadorSoloMlHa > 0) {
    const lTotal = round2((input.condicionadorSoloMlHa * area) / 1000);
    const lPorBat = round2(lTotal / numeroBatidas);
    complexantes.push({
      produto: "Life Grow (Condicionador de Solo)",
      lPorBatida: lPorBat,
      lTotal,
      precoLitro: input.precos.lifeGrowPorL,
      custoTotalRs: round2(lTotal * input.precos.lifeGrowPorL),
      custoPorHa: round2((lTotal * input.precos.lifeGrowPorL) / area),
    });
  }

  // 4) Receita por batida (ordem da aba FÓRMULAS)
  const receita: ReceitaItem[] = [];
  let ord = 1;
  receita.push({
    ordem: ord++, ingrediente: "Água", quantidade: Math.round(volBatida * 0.4),
    unidade: "L", instrucao: "Adicionar água limpa ao tanque misturador",
  });

  const cBor = complexantes.find(c => c.produto === "Complex BOR");
  if (cBor) {
    receita.push({ ordem: ord++, ingrediente: "Complex BOR", quantidade: cBor.lPorBatida, unidade: "L",
      instrucao: "Adicionar o complexador de Boro" });
  }
  if (salBorico && salBorico.kgPorBatida > 0) {
    receita.push({ ordem: ord++, ingrediente: salBorico.salNome, quantidade: salBorico.kgPorBatida,
      unidade: "kg", instrucao: "Adicionar e agitar" });
  }
  receita.push({ ordem: ord++, ingrediente: "—", quantidade: 0, unidade: "—",
    instrucao: "Agitar por 10 minutos", isInstrucao: true });
  receita.push({ ordem: ord++, ingrediente: "—", quantidade: 0, unidade: "—",
    instrucao: "Adicionar (incorporador):", isInstrucao: true });

  const cPrincipal = complexantes.find(c =>
    c.produto === nomeComplexador(cKey)
  );
  if (cPrincipal) {
    receita.push({ ordem: ord++, ingrediente: cPrincipal.produto, quantidade: cPrincipal.lPorBatida,
      unidade: "L", instrucao: `Complexador principal — ${input.nivel.toUpperCase()}` });
  }
  const cEst = complexantes.find(c => c.produto === "Estimull");
  if (cEst) receita.push({ ordem: ord++, ingrediente: "Estimull", quantidade: cEst.lPorBatida, unidade: "L", instrucao: "Bioestimulante" });
  const cAm = complexantes.find(c => c.produto === "Amino+");
  if (cAm) receita.push({ ordem: ord++, ingrediente: "Amino+", quantidade: cAm.lPorBatida, unidade: "L", instrucao: "Aminoácido" });
  const cAlga = complexantes.find(c => c.produto === "Carbo Alga (Extrato de Algas)");
  if (cAlga) receita.push({ ordem: ord++, ingrediente: "Carbo Alga", quantidade: cAlga.lPorBatida, unidade: "L", instrucao: "Extrato de algas" });
  const cLG = complexantes.find(c => c.produto === "Life Grow (Condicionador de Solo)");
  if (cLG) receita.push({ ordem: ord++, ingrediente: "Life Grow", quantidade: cLG.lPorBatida, unidade: "L", instrucao: "Condicionador de solo" });

  receita.push({ ordem: ord++, ingrediente: "—", quantidade: 0, unidade: "—",
    instrucao: "Injetar no sistema. Em seguida, adicionar os sais (micros e macros)", isInstrucao: true });

  // Sais — micros benéficos primeiro, depois principais
  const ordemSimbolos = ["Ni", "Si", "Mo", "Co", "Se", "Fe", "Mg", "S", "Mn", "Cu", "P", "Zn", "Ca", "K", "N"];
  const saisOrd = [...sais]
    .filter(s => !stripAcc(s.salNome).includes("borico"))
    .sort((a, b) => {
      const ia = ordemSimbolos.indexOf(a.simbolo); const ib = ordemSimbolos.indexOf(b.simbolo);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  for (const s of saisOrd) {
    if (s.kgPorBatida <= 0) continue;
    receita.push({ ordem: ord++, ingrediente: s.salNome, quantidade: s.kgPorBatida,
      unidade: "kg", instrucao: `Fonte de ${s.simbolo} — ${s.nutrienteNome}` });
  }

  receita.push({ ordem: ord++, ingrediente: "Volume da batida", quantidade: volBatida,
    unidade: "L", instrucao: "Total ao final" });
  receita.push({ ordem: ord++, ingrediente: "Volume total", quantidade: volumeTotalFoliar,
    unidade: "L", instrucao: "" });
  receita.push({ ordem: ord++, ingrediente: "Aplicação", quantidade: aplicacaoFoliarLHa,
    unidade: "L/ha", instrucao: "Após adição de TODOS os componentes acima" });

  // 5) Custos (somatório)
  const custoSais = sais.reduce((acc, s) => acc + s.custoTotalRs, 0);
  const custoComplex = complexantes.reduce((acc, c) => acc + c.custoTotalRs, 0);
  const custoFoliarTotalRs = round2(custoSais + custoComplex);
  const custoFoliarRsHa = round2(custoFoliarTotalRs / area);

  // 6) Comparativo
  const convencional = Math.max(0, input.custoFoliarConvencionalRsHa);
  const economiaRsHa = round2(convencional - custoFoliarRsHa);
  const economiaPercent = convencional > 0 ? round1((economiaRsHa / convencional) * 100) : 0;
  const economiaTotalRs = round2(economiaRsHa * area);

  // 7) Lista de compras (sais em sacos de 25 kg + complexantes em L)
  const listaCompras: ListaCompraItem[] = [];
  for (const s of sais) {
    const sacos = Math.ceil(s.saisAreaKg / 25);
    const arred = sacos * 25;
    listaCompras.push({
      produto: s.salNome,
      unidade: "kg",
      quantidadeArea: s.saisAreaKg,
      arredondado: arred,
      precoUnit: s.precoKg,
      custoTotal: round2(arred * s.precoKg),
      embalagem: `${sacos} sacos × 25 kg`,
    });
  }
  for (const c of complexantes) {
    const tambores = Math.ceil(c.lTotal / 200);
    listaCompras.push({
      produto: c.produto,
      unidade: "L",
      quantidadeArea: round2(c.lTotal),
      arredondado: tambores * 200,
      precoUnit: c.precoLitro,
      custoTotal: round2(tambores * 200 * c.precoLitro),
      embalagem: `${tambores} tambores × 200 L`,
    });
  }

  // 8) Aplicações / dias para cobrir
  const numeroAplicacoes = numeroBatidas; // 1 batida = 1 aplicação no caso clássico
  const diasParaCobrir = input.aplicacaoDiariaHa > 0
    ? Math.ceil(area / input.aplicacaoDiariaHa)
    : 0;

  // Alertas básicos
  if (aplicacaoFoliarLHa < 20) {
    alertas.push(`Volume foliar baixo (${aplicacaoFoliarLHa} L/ha). Conferir vazão do equipamento.`);
  }
  if (aplicacaoFoliarLHa > 250) {
    alertas.push(`Volume foliar alto (${aplicacaoFoliarLHa} L/ha). Avaliar split em mais aplicações.`);
  }

  // 9) Aplicações por estágio fenológico
  const aplicacoesPorEstagio: AplicacaoEstagio[] = [];
  let ordemApp = 1;

  // Sulco/drench se Life Grow estiver presente
  if (input.condicionadorSoloMlHa > 0) {
    const lHa = input.condicionadorSoloMlHa / 1000;
    aplicacoesPorEstagio.push({
      ordem: ordemApp++,
      nome: "Sulco de Plantio / Drench",
      tipo: "drench",
      itens: [{ produto: "Life Grow (Condicionador de Solo)", quantidade: round2(lHa), unidade: "L/ha" }],
      observacao: "Aplicação no sulco antes do plantio ou via drench",
    });
  }

  const estagiosAtivos = input.estagios.filter(e => e.nome).slice();
  const nApps = estagiosAtivos.length > 0 ? estagiosAtivos.length : Math.max(1, input.numeroEntradas || 1);
  // Volume foliar por aplicação (divide igualmente entre os estágios foliares)
  const volPorAppLHa = roundAplicacaoInteira(aplicacaoFoliarLHa / nApps);

  for (let i = 0; i < nApps; i++) {
    const nome = estagiosAtivos[i]?.nome || `Aplicação ${i + 1}`;
    aplicacoesPorEstagio.push({
      ordem: ordemApp++,
      nome,
      tipo: "foliar",
      itens: [{ produto: "Calda foliar NUTRIR", quantidade: volPorAppLHa, unidade: "L/ha" }],
      observacao: `Aplicação foliar — ${100 / nApps}% da dose total`,
    });
  }

  return {
    sais,
    complexantes,
    receita,
    totalDiluicaoL,
    aplicacaoFoliarLHa,
    numeroBatidas,
    numeroAplicacoes,
    diasParaCobrir,
    aplicacoesPorEstagio,
    custoFoliarTotalRs,
    custoFoliarRsHa,
    comparativo: {
      convencionalRsHa: round2(convencional),
      nutrirRsHa: custoFoliarRsHa,
      economiaRsHa,
      economiaPercent,
      economiaTotalRs,
    },
    listaCompras,
    alertas,
  };
}

// ────────────────────────────────────────────────────────────
// TEMPLATE DE NUTRIENTES (caso Cristiano/Milho da planilha)
// ────────────────────────────────────────────────────────────

export const TEMPLATE_NUTRIENTES_BASE: NutrienteEntrada[] = [
  // Essenciais
  { simbolo: "Mn", nome: "Manganês",  doseGrHa: 600, grupo: "essencial" },
  { simbolo: "Mg", nome: "Magnésio",  doseGrHa: 600, grupo: "essencial" },
  { simbolo: "Zn", nome: "Zinco",     doseGrHa: 200, grupo: "essencial" },
  { simbolo: "Cu", nome: "Cobre",     doseGrHa: 200, grupo: "essencial" },
  { simbolo: "P",  nome: "Fósforo",   doseGrHa: 500, grupo: "essencial" },
  { simbolo: "K",  nome: "Potássio",  doseGrHa: 400, grupo: "essencial" },
  { simbolo: "B",  nome: "Boro",      doseGrHa: 300, grupo: "essencial" },
  { simbolo: "N",  nome: "Nitrogênio (foliar)", doseGrHa: 0, grupo: "essencial" },
  { simbolo: "Ca", nome: "Cálcio",    doseGrHa: 0,   grupo: "essencial" },
  { simbolo: "S",  nome: "Enxofre",   doseGrHa: 1351, grupo: "essencial" },
  // Benéficos
  { simbolo: "Co", nome: "Cobalto",   doseGrHa: 15,  grupo: "beneficio" },
  { simbolo: "Mo", nome: "Molibdênio", doseGrHa: 100, grupo: "beneficio" },
  { simbolo: "Ni", nome: "Níquel",    doseGrHa: 30,  grupo: "beneficio" },
  { simbolo: "Se", nome: "Selênio",   doseGrHa: 10,  grupo: "beneficio" },
  { simbolo: "Si", nome: "Silício",   doseGrHa: 0,   grupo: "beneficio" },
  { simbolo: "Fe", nome: "Ferro",     doseGrHa: 0,   grupo: "beneficio" },
];
