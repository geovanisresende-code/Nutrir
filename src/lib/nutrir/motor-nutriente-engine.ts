/**
 * MOTOR POR NUTRIENTE — engine de cálculo idêntica à planilha original
 * (CONTAS.FORM blocos FOLIAR e UREIA+MICROS — NITROPLUS).
 *
 * Cada linha (matéria-prima) gera as colunas:
 *   C  — % garantia do nutriente principal no sal (do cadastro)
 *   D  — gr/ha do nutriente alvo (input do usuário, vindo da TPD)
 *   E  — kg de sal/ha = ROUND(D / C, 0)               (C tratado como número de %)
 *   F  — kg de sal área total = MROUND((E * area) / 1000, step)
 *   G  — entrega real gr/ha    = (F / area) * C * 1000   (recálculo de F→gr/ha)
 *   H  — diluição (volume contribuído na batida) = F * fator_diluicao_global
 *   I  — quantidade na fórmula (kg) = MROUND(F / SOMA(H) * VOLUME_BATIDA, step)
 *
 * Complexadores (cols J..O da planilha — LEG/BOR/ESTIMULL/AMINO+/TSH/ION):
 *   • cada nutriente tem um fator L_complex / kg_sal (vindo de complexador_nutriente_fator_nivel)
 *   • cada coluna depende do complexador escolhido na fórmula
 *
 * ENXOFRE AUTOMÁTICO: somatório do enxofre contido em cada sal que tenha S
 *   na sua tabela de garantias. Ex: Sulfato de Mn (16%S sobre o sal),
 *   Sulfato de Mg (11%S), Sulfato de Zn (~9%S sobre o sal), etc.
 *   gr_S/ha = sum_sais( (gr_nutriente_principal/ha) / (garantia_principal%/100) * (S%/100) * 10 )
 *   — em escala compatível com a planilha (que usa %/0.31 etc).
 *
 * LIMITE 40% DE SAIS: somatório dos kg de sal na batida (col I) NÃO pode passar
 *   de `limite_sais_pct` % do volume da batida (em L). Se passar, o sistema
 *   escala todos os sais proporcionalmente para baixo (mantendo a relação) e
 *   marca cada linha como `escalada=true`. O usuário também pode forçar um
 *   ajuste manual via override individual.
 */

// ============================================================
// TIPOS
// ============================================================

export interface SalGarantia {
  /** id do nutriente */
  nutriente_id: string;
  simbolo: string;
  /** % do nutriente no sal (ex: 0.31 para 31%) */
  pct: number;
}

export interface MateriaPrimaSal {
  id: string;
  nome: string;
  preco_kg: number;
  /** Lista completa de garantias (todos os nutrientes que o sal contém) */
  garantias: SalGarantia[];
}

export interface NutrienteAlvo {
  /** id do nutriente */
  nutriente_id: string;
  simbolo: string;
  nome: string;
  /** dose alvo gr/ha (input usuário) */
  dose_gr_ha: number;
  /** matéria-prima escolhida para fornecer este nutriente */
  materia_prima_id: string;
  /** override manual da garantia% (opcional). Se nulo, usa garantia da MP */
  garantia_pct_override?: number | null;
  /** step de arredondamento dos kg/área (planilha usa MROUND 25/5/1/0.5) */
  step_arredondamento?: number;
  /** override manual de kg na fórmula (col I). Se setado, sobrepõe o cálculo */
  qtd_formula_override_kg?: number | null;
}

export type Nivel = "forte" | "padrao" | "fraca";

export interface FatorComplexador {
  nutriente_id: string;
  /** L de complexador por kg de sal */
  fator_l_kg_sal: number;
}

export interface ComplexadorInfo {
  id: string;
  nome: string;
  preco_litro: number;
  /** Fatores por nutriente para o nível escolhido */
  fatores: FatorComplexador[];
}

export interface MotorInput {
  area_ha: number;
  /** L da batida (ex: 1000, 6000, 15000) */
  volume_batida_l: number;
  /** fator de diluição global aplicado em todas as linhas (col H = F*fator). Ex: 4.5 (FOLIAR), 2.5 (NITROPLUS). Range 2.0–19.99 */
  fator_diluicao_global: number;
  /** % máximo de sais (peso/volume da batida). Padrão 40 */
  limite_sais_pct: number;
  /** Se true, escala automaticamente para caber no limite. Se false, apenas avisa */
  auto_ajuste_limite: boolean;
  /** Adiciona enxofre automático (somatório do S nos sais que contêm enxofre) */
  enxofre_automatico: boolean;
  /** id do nutriente "Enxofre" (para somar no relatório) */
  enxofre_nutriente_id?: string | null;
  alvos: NutrienteAlvo[];
  materias_primas: Record<string, MateriaPrimaSal>;
  complexador?: ComplexadorInfo | null;
}

export interface LinhaCalculada {
  nutriente_id: string;
  nutriente_simbolo: string;
  materia_prima_id: string;
  materia_prima_nome: string;
  /** Coluna C: % garantia (ex: 31) */
  garantia_pct: number;
  /** Coluna D: gr/ha alvo */
  dose_gr_ha: number;
  /** Coluna E: kg sal/ha */
  kg_sal_ha: number;
  /** Coluna F: kg sal área total (com MROUND) */
  kg_sal_area_total: number;
  /** Coluna G: entrega real gr/ha (recálculo) */
  entrega_real_gr_ha: number;
  /** Coluna H: volume na batida (F * fator_diluicao) */
  volume_diluicao_l: number;
  /** Coluna I: kg na fórmula (proporcional ao volume da batida) */
  qtd_formula_kg: number;
  /** Coluna J/L/M/N/O: L de complexador para esta linha */
  complexador_l: number;
  /** Foi escalada por estouro do limite 40% */
  escalada: boolean;
  /** Custo do sal nesta linha (R$) — kg_formula × preço */
  custo_sal_rs: number;
}

export interface MotorResultado {
  linhas: LinhaCalculada[];
  /** Soma da coluna I (kg de sais na batida) */
  total_sais_formula_kg: number;
  /** Limite absoluto de kg permitido (volume_l × limite% / 100) */
  limite_sais_kg: number;
  /** % real ocupado pelos sais (peso / volume) */
  ocupacao_sais_pct: number;
  /** Enxofre extra (gr/ha) calculado automaticamente */
  enxofre_extra_gr_ha: number;
  /** Volume final da batida (L) */
  volume_batida_l: number;
  /** L do complexador na batida (somatório J20 da planilha) */
  complexador_total_l: number;
  /** Estouro? Mesmo após auto-ajuste o sistema avisa */
  estourou_limite: boolean;
  /** Fator de escala aplicado (1.0 = nenhum ajuste, 0.85 = reduziu 15%) */
  fator_escala_aplicado: number;
  /** Custo total dos sais (R$) na batida */
  custo_sais_total_rs: number;
  /** Custo total do complexador (R$) na batida */
  custo_complexador_rs: number;
  /** Custo total da batida (R$) */
  custo_total_batida_rs: number;
  /** Aplicação por hectare (L/ha) — H/area_ha */
  aplicacao_l_ha: number;
}

// ============================================================
// HELPERS
// ============================================================
function mround(value: number, step: number): number {
  if (!step || step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

function safeDiv(a: number, b: number): number {
  if (!b || b === 0) return 0;
  return a / b;
}

// ============================================================
// CÁLCULO PRINCIPAL
// ============================================================
export function calcularMotorNutriente(input: MotorInput): MotorResultado {
  const fator = Math.max(2.0, Math.min(19.99, input.fator_diluicao_global || 4.5));
  const volume = Math.max(1, input.volume_batida_l || 1000);
  const area = Math.max(0.01, input.area_ha || 1);
  const limitePctNum = Math.max(1, Math.min(100, input.limite_sais_pct || 40));
  const fatorComplexMap = new Map<string, number>(
    input.complexador?.fatores?.map((f) => [f.nutriente_id, f.fator_l_kg_sal]) ?? [],
  );

  // 1ª passagem: calcula por linha colunas C..H (sem coluna I, que depende do total H)
  type Pre = LinhaCalculada & { _pre_kg_formula_calc: number };
  const linhasPre: Pre[] = input.alvos
    .filter((a) => a.dose_gr_ha > 0 && a.materia_prima_id)
    .map((a) => {
      const mp = input.materias_primas[a.materia_prima_id];
      if (!mp) {
        return null;
      }
      const garPrincipal = mp.garantias.find((g) => g.nutriente_id === a.nutriente_id);
      const garPctRaw =
        a.garantia_pct_override != null && a.garantia_pct_override > 0
          ? a.garantia_pct_override
          : (garPrincipal?.pct ?? 0) * 100; // pct vem 0..1, planilha usa em % (0..100)
      const garPct = garPctRaw > 0 ? garPctRaw : 0;
      const step = a.step_arredondamento ?? 1;

      // E (planilha): ROUND(D/C, 0) com C em "% inteiro"
      const kg_sal_ha = garPct > 0 ? Math.round(a.dose_gr_ha / garPct) : 0;
      // F: MROUND((E*area)/1000, step)
      const kg_sal_area = mround((kg_sal_ha * area) / 1000, step);
      // G: entrega real gr/ha
      const entrega_real = area > 0 ? safeDiv(kg_sal_area, area) * garPct * 1000 : 0;
      // H: diluição (volume contribuído à batida)
      const vol_diluicao = kg_sal_area * fator;

      const fatorCx = fatorComplexMap.get(a.nutriente_id) ?? 0;

      return {
        nutriente_id: a.nutriente_id,
        nutriente_simbolo: a.simbolo,
        materia_prima_id: a.materia_prima_id,
        materia_prima_nome: mp.nome,
        garantia_pct: garPct,
        dose_gr_ha: a.dose_gr_ha,
        kg_sal_ha,
        kg_sal_area_total: kg_sal_area,
        entrega_real_gr_ha: Math.round(entrega_real),
        volume_diluicao_l: vol_diluicao,
        qtd_formula_kg: 0,
        complexador_l: 0,
        escalada: false,
        custo_sal_rs: 0,
        _pre_kg_formula_calc: 0,
        // _step para uso posterior
        _step: step,
        _override: a.qtd_formula_override_kg ?? null,
        _preco_kg: mp.preco_kg,
      } as unknown as Pre;
    })
    .filter((x): x is Pre => x !== null);

  // Soma da coluna H (volume diluição total) — base do rateio para coluna I
  const somaH = linhasPre.reduce((s, l) => s + l.volume_diluicao_l, 0);

  // 2ª passagem: calcula coluna I = MROUND(F/SOMA(H) * VOLUME_BATIDA, step)
  for (const l of linhasPre) {
    const stepI = (l as unknown as { _step: number })._step;
    const override = (l as unknown as { _override: number | null })._override;
    const calc = somaH > 0 ? mround((l.kg_sal_area_total / somaH) * volume, stepI) : 0;
    (l as unknown as { _pre_kg_formula_calc: number })._pre_kg_formula_calc = calc;
    l.qtd_formula_kg = override != null ? override : calc;
  }

  // 3) Verificar limite 40%
  let totalSaisFormula = linhasPre.reduce((s, l) => s + l.qtd_formula_kg, 0);
  const limiteKg = (volume * limitePctNum) / 100;
  let fatorEscala = 1.0;
  let estourou = false;
  if (totalSaisFormula > limiteKg && limiteKg > 0) {
    estourou = true;
    if (input.auto_ajuste_limite) {
      fatorEscala = limiteKg / totalSaisFormula;
      for (const l of linhasPre) {
        if ((l as unknown as { _override: number | null })._override == null) {
          const stepI = (l as unknown as { _step: number })._step;
          l.qtd_formula_kg = mround(l.qtd_formula_kg * fatorEscala, stepI);
          l.escalada = true;
        }
      }
      totalSaisFormula = linhasPre.reduce((s, l) => s + l.qtd_formula_kg, 0);
    }
  }

  // 4) Complexador por linha — a planilha usa col I (kg na fórmula) × fator
  let complexadorTotal = 0;
  for (const l of linhasPre) {
    const fatorCx = fatorComplexMap.get(l.nutriente_id) ?? 0;
    l.complexador_l = l.qtd_formula_kg * fatorCx;
    complexadorTotal += l.complexador_l;
  }

  // 5) Custos
  let custoSais = 0;
  for (const l of linhasPre) {
    const preco = (l as unknown as { _preco_kg: number })._preco_kg ?? 0;
    l.custo_sal_rs = l.qtd_formula_kg * preco;
    custoSais += l.custo_sal_rs;
  }
  const custoCx = (input.complexador?.preco_litro ?? 0) * complexadorTotal;

  // 6) Enxofre automático
  let enxofreExtra = 0;
  if (input.enxofre_automatico && input.enxofre_nutriente_id) {
    for (const l of linhasPre) {
      const mp = input.materias_primas[l.materia_prima_id];
      if (!mp) continue;
      const garS = mp.garantias.find((g) => g.nutriente_id === input.enxofre_nutriente_id);
      if (!garS || garS.pct <= 0) continue;
      // gr S/ha = (gr nutriente principal/ha) / (garantia_principal/100) * (S%/100) * 10
      // Equivalente à planilha: (D/garantia_principal) * (garantia_S * 1)
      const garPrincipalDec = l.garantia_pct / 100;
      if (garPrincipalDec <= 0) continue;
      enxofreExtra += (l.dose_gr_ha / garPrincipalDec) * garS.pct;
    }
  }

  // limpar campos privados
  const linhas = linhasPre.map((l) => {
    const obj = { ...l } as Partial<Pre>;
    delete (obj as Record<string, unknown>)._pre_kg_formula_calc;
    delete (obj as Record<string, unknown>)._step;
    delete (obj as Record<string, unknown>)._override;
    delete (obj as Record<string, unknown>)._preco_kg;
    return obj as LinhaCalculada;
  });

  const aplicacao_l_ha = area > 0 ? somaH / area : 0;

  return {
    linhas,
    total_sais_formula_kg: totalSaisFormula,
    limite_sais_kg: limiteKg,
    ocupacao_sais_pct: (totalSaisFormula / volume) * 100,
    enxofre_extra_gr_ha: Math.round(enxofreExtra),
    volume_batida_l: volume,
    complexador_total_l: complexadorTotal,
    estourou_limite: estourou,
    fator_escala_aplicado: fatorEscala,
    custo_sais_total_rs: custoSais,
    custo_complexador_rs: custoCx,
    custo_total_batida_rs: custoSais + custoCx,
    aplicacao_l_ha,
  };
}

export function formatBRL(v: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatNum(v: number, d = 2): string {
  return (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
