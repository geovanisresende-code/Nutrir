import { describe, it, expect } from "vitest";
import {
  parseLaudoTexto, extrairNutrientes, detectarAplicacao, detectarComplexador,
} from "@/lib/nutrir/laudo-parser";

describe("laudo-parser", () => {
  it("extrai micros em gr/ha", () => {
    const txt = `
      Mn 600 gr/ha
      Zinco 200 g/ha
      Boro: 300 g ha
      Cobre 200gr/ha
    `;
    const ns = extrairNutrientes(txt);
    const syms = ns.map((n) => n.simbolo).sort();
    expect(syms).toEqual(["B", "Cu", "Mn", "Zn"]);
    expect(ns.find((n) => n.simbolo === "Mn")?.valor).toBe(600);
    expect(ns.every((n) => n.unidade === "gr/ha")).toBe(true);
  });

  it("extrai macros em kg/ha", () => {
    const txt = `Nitrogênio 90 kg/ha\nP2O5 60 kg/ha\nK2O 120 kg/ha`;
    const ns = extrairNutrientes(txt);
    expect(ns.find((n) => n.simbolo === "N")?.valor).toBe(90);
    expect(ns.find((n) => n.simbolo === "P")?.valor).toBe(60);
    expect(ns.find((n) => n.simbolo === "K")?.valor).toBe(120);
    expect(ns.every((n) => n.unidade === "kg/ha")).toBe(true);
  });

  it("detecta aplicação foliar e drench", () => {
    expect(detectarAplicacao("Aplicação foliar via pulverizador")).toBe("foliar");
    expect(detectarAplicacao("via drench no pé")).toBe("drench");
    expect(detectarAplicacao("Fertirrigação localizada")).toBe("fertirrigacao");
  });

  it("detecta complexador LEG/TSH/ION", () => {
    expect(detectarComplexador("Usar Complex LEG nível padrão")).toBe("leg");
    expect(detectarComplexador("Complex TSH 12,5%")).toBe("tsh");
    expect(detectarComplexador("Aplicar Complex ÍON")).toBe("ion");
  });

  it("retorna laudo completo (foliar)", () => {
    const txt = `
      Cliente: Cristiano - Fazenda Boa Vista
      Cultura: Milho
      Área: 100 ha
      Aplicação: foliar via pulverizador
      Complex LEG padrão
      Mn 600 gr/ha · Zn 200 gr/ha · B 300 gr/ha · Mg 600 gr/ha
    `;
    const r = parseLaudoTexto(txt);
    expect(r.tipo).toBe("foliar");
    expect(r.aplicacao_sugerida).toBe("foliar");
    expect(r.complexador_sugerido).toBe("leg");
    expect(r.nivel_complexacao_sugerido).toBe("padrao");
    expect(r.cultura).toContain("Milho");
    expect(r.area_ha).toBe(100);
    expect(r.nutrientes.length).toBeGreaterThanOrEqual(4);
  });

  it("retorna laudo completo (NPK fertirrigação)", () => {
    const txt = `
      Drench / Fertirrigação
      N 90 kg/ha · P2O5 60 kg/ha · K2O 120 kg/ha
      Complex TSH
    `;
    const r = parseLaudoTexto(txt);
    expect(r.tipo).toBe("fertirrigacao");
    expect(r.aplicacao_sugerida).toBe("fertirrigacao");
    expect(r.complexador_sugerido).toBe("tsh");
    expect(r.demanda_npk).toEqual({ N: 90, P2O5: 60, K2O: 120 });
  });
});
