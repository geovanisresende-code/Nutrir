import { describe, it, expect } from "vitest";
import {
  calcularFoliar, TEMPLATE_NUTRIENTES_BASE,
  type FoliarInput, type SalCatalogo,
} from "@/lib/nutrir/foliar-engine";

const SAIS: SalCatalogo[] = [
  { id: "1", nome: "Sulfato de Manganês", precoKg: 8.5, nutrienteSimbolo: "Mn", garantiaPercent: 32 },
  { id: "2", nome: "Sulfato de Magnésio", precoKg: 3.2, nutrienteSimbolo: "Mg", garantiaPercent: 9 },
  { id: "3", nome: "Sulfato de Zinco",    precoKg: 12,  nutrienteSimbolo: "Zn", garantiaPercent: 22 },
  { id: "4", nome: "Sulfato de Cobre",    precoKg: 25,  nutrienteSimbolo: "Cu", garantiaPercent: 25 },
  { id: "5", nome: "MAP Purificado",      precoKg: 7.5, nutrienteSimbolo: "P",  garantiaPercent: 60 },
  { id: "6", nome: "KCl Branco",          precoKg: 4.8, nutrienteSimbolo: "K",  garantiaPercent: 60 },
  { id: "7", nome: "Ácido Bórico",        precoKg: 11,  nutrienteSimbolo: "B",  garantiaPercent: 17 },
  { id: "8", nome: "Molibdato de Sódio",  precoKg: 90,  nutrienteSimbolo: "Mo", garantiaPercent: 39 },
  { id: "9", nome: "Sulfato de Cobalto",  precoKg: 110, nutrienteSimbolo: "Co", garantiaPercent: 21 },
  { id: "10",nome: "Sulfato de Níquel",   precoKg: 65,  nutrienteSimbolo: "Ni", garantiaPercent: 22 },
  { id: "11",nome: "Selenito de Sódio",   precoKg: 200, nutrienteSimbolo: "Se", garantiaPercent: 45 },
];

function inputBase(): FoliarInput {
  return {
    produtor: "Teste",
    fazenda: "F1",
    cultura: "Milho",
    areaHa: 3000,
    vazaoPulverizadorLHa: 55,
    numeroEntradas: 4,
    estagios: [],
    microNoSolo: "nao",
    aplicacaoDiariaHa: 1000,
    volumeBatidaL: 6000,
    nivel: "padrao",
    complexador: "leg",
    precos: {
      legPorL: 22, tshPorL: 28, ionPorL: 25, borPorL: 18,
      estimullPorL: 32, aminoPorL: 38, carboAlgaPorL: 24, lifeGrowPorL: 19,
    },
    nutrientes: TEMPLATE_NUTRIENTES_BASE,
    extratoAlgasMlHa: 0,
    condicionadorSoloMlHa: 0,
    custoFoliarConvencionalRsHa: 350,
    sais: SAIS,
    fatores: [],
  };
}

describe("foliar-engine", () => {
  it("calcula sem erro com template base", () => {
    const r = calcularFoliar(inputBase());
    expect(r.sais.length).toBeGreaterThan(0);
    expect(r.aplicacaoFoliarLHa).toBeGreaterThan(0);
    expect(r.numeroBatidas).toBeGreaterThan(0);
  });

  it("aplicação L/ha é número inteiro (arredondamento)", () => {
    const r = calcularFoliar(inputBase());
    expect(Number.isInteger(r.aplicacaoFoliarLHa)).toBe(true);
  });

  it("complexador principal aparece quando há micros", () => {
    const r = calcularFoliar(inputBase());
    const leg = r.complexantes.find((c) => c.produto.toLowerCase().includes("leg"));
    expect(leg).toBeTruthy();
    expect(leg!.lTotal).toBeGreaterThan(0);
  });

  it("Complex BOR ativa quando há ácido bórico e complexador != ion", () => {
    const r = calcularFoliar(inputBase());
    expect(r.complexantes.some((c) => c.produto === "Complex BOR")).toBe(true);
  });

  it("Complex BOR NÃO entra quando o complexador é ion", () => {
    const inp = inputBase();
    inp.complexador = "ion";
    const r = calcularFoliar(inp);
    expect(r.complexantes.some((c) => c.produto === "Complex BOR")).toBe(false);
  });

  it("sem nutrientes => sem sais nem complexantes", () => {
    const inp = inputBase();
    inp.nutrientes = inp.nutrientes.map((n) => ({ ...n, doseGrHa: 0 }));
    const r = calcularFoliar(inp);
    expect(r.sais.length).toBe(0);
    expect(r.aplicacaoFoliarLHa).toBe(0);
  });

  it("custo NUTRIR > 0 quando há sais", () => {
    const r = calcularFoliar(inputBase());
    expect(r.custoFoliarRsHa).toBeGreaterThan(0);
  });
});
