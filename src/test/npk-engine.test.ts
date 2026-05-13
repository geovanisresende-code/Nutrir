import { describe, it, expect } from "vitest";
import {
  calcularNPK, formulaParaDemanda, parseFormulaNPK,
  P2O5_TO_P, K2O_TO_K,
  type NPKInput, type SalDisponivel,
} from "@/lib/nutrir/npk-foliar-engine";

const SAIS: SalDisponivel[] = [
  { id: "ureia", nome: "Ureia Branca", precoKg: 4.2, garantias: { N: 45 } },
  { id: "map",   nome: "MAP Purificado", precoKg: 7.5, garantias: { P2O5: 60, N: 11 } },
  { id: "kcl",   nome: "KCl Branco", precoKg: 4.8, garantias: { K2O: 60 } },
];

function inputBase(): NPKInput {
  return {
    modoEntrada: "nutrientes",
    modoProducao: "completa",
    modoAplicacao: "drench",
    vazaoEquipamentoLHa: 500,
    entradasLavoura: 1,
    demanda: { nKgHa: 90, p2o5KgHa: 60, k2oKgHa: 120 },
    areaHa: 100,
    sais: SAIS,
    selecao: { fonteNId: "ureia", fontePId: "map", fonteKId: "kcl" },
    precoTshL: 28,
  };
}

describe("npk-engine", () => {
  it("constantes de conversão corretas", () => {
    expect(P2O5_TO_P).toBeCloseTo(0.4364, 4);
    expect(K2O_TO_K).toBeCloseTo(0.8301, 4);
  });

  it("parseFormulaNPK reconhece 10-15-15", () => {
    expect(parseFormulaNPK("10-15-15")).toEqual({ nPct: 10, p2o5Pct: 15, k2oPct: 15 });
  });

  it("formulaParaDemanda 10-15-15 × 600", () => {
    const d = formulaParaDemanda("10-15-15", 600);
    expect(d).toEqual({ nKgHa: 60, p2o5KgHa: 90, k2oKgHa: 90 });
  });

  it("calcula NPK completo sem erros", () => {
    const r = calcularNPK(inputBase());
    expect(r.batidas.length).toBeGreaterThan(0);
    expect(r.custoPorHa).toBeGreaterThan(0);
    expect(r.massas.ureiaKgHa).toBeGreaterThan(0);
    expect(r.massas.mapKgHa).toBeGreaterThan(0);
    expect(r.massas.kclKgHa).toBeGreaterThan(0);
  });

  it("redução NUTRIR aplicada (N -60%, P -50%, K -40%)", () => {
    const r = calcularNPK(inputBase());
    // N reduzido = 90 × 0,4 = 36 kg/ha de N elemento → 36/0,45 ≈ 80 kg ureia
    expect(r.massas.ureiaKgHa).toBeGreaterThanOrEqual(75);
    expect(r.massas.ureiaKgHa).toBeLessThanOrEqual(85);
  });

  it("modo individual gera 3 batidas (N, P, K)", () => {
    const inp = inputBase();
    inp.modoProducao = "individuais";
    const r = calcularNPK(inp);
    expect(r.batidas.length).toBe(3);
  });

  it("vazão é número inteiro (L/ha)", () => {
    const r = calcularNPK(inputBase());
    for (const b of r.batidas) {
      expect(Number.isInteger(b.vazaoLHa)).toBe(true);
    }
  });

  it("comparativo com MP simples gera economia positiva", () => {
    const r = calcularNPK(inputBase());
    expect(r.comparativo.mpEquivalentesCustoHa).toBeGreaterThan(0);
    expect(r.comparativo.economiaVsMPHa).toBeGreaterThan(0);
  });
});
