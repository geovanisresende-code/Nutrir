import { describe, it, expect } from "vitest";
import {
  fmtInt, fmtNum, fmtBRL, fmtQty, parseNumberBR, arredondaAplicacao,
} from "@/lib/nutrir/format";

describe("format", () => {
  it("fmtInt aplica separador de milhar", () => {
    expect(fmtInt(1234)).toBe("1.234");
    expect(fmtInt(1500000)).toBe("1.500.000");
    expect(fmtInt(null)).toBe("0");
  });

  it("fmtNum 2 casas decimais com vírgula BR", () => {
    expect(fmtNum(1234.5)).toBe("1.234,50");
    expect(fmtNum(0.1 + 0.2)).toBe("0,30");
  });

  it("fmtBRL formata moeda BR", () => {
    expect(fmtBRL(1234.5)).toMatch(/R\$\s?1\.234,50/);
  });

  it("arredondaAplicacao usa Math.round", () => {
    expect(arredondaAplicacao(69.3)).toBe(69);
    expect(arredondaAplicacao(69.6)).toBe(70);
    expect(arredondaAplicacao(0)).toBe(0);
  });

  it("fmtQty L/ha sempre inteiro com símbolo", () => {
    expect(fmtQty(69.3, "L/ha")).toBe("69 L/ha");
    expect(fmtQty(125.7, "L/ha")).toBe("126 L/ha");
  });

  it("fmtQty kg/ha aceita decimais quando pequeno", () => {
    expect(fmtQty(0.6, "kg/ha")).toBe("0,60 kg/ha");
    expect(fmtQty(150, "kg/ha")).toBe("150 kg/ha");
  });

  it("parseNumberBR reconhece formatos BR e EN", () => {
    expect(parseNumberBR("1.234,56")).toBe(1234.56);
    expect(parseNumberBR("1,234.56")).toBe(1234.56);
    expect(parseNumberBR("1234,5")).toBe(1234.5);
    expect(parseNumberBR("R$ 2.500,00")).toBe(2500);
    expect(parseNumberBR(null)).toBe(0);
  });
});
