import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo1 from "@/assets/1.png";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable, useOrgTable } from "@/lib/nutrir/useNutrirData";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { FlaskConical, ShoppingCart, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Cultura { id: string; nome: string; }
interface MP { id: string; codigo: string | null; nome: string; preco_atual: number | null; unidade_preco: string; ativo: boolean; }
interface Complexador { id: string; nome: string; preco_litro: number; ativo: boolean; }

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];

type AduboKey = "ureia_branca" | "ureia_protegida" | "sulfato_amonio" | "nitrato_amonio";
type FormaAplicacao = "drench" | "nonino" | "fertirrigacao" | "pulverizador" | "drone" | "aviao";
type Complexante = "tsh" | "lifegrow" | "leg";

const ADUBOS: Record<AduboKey, { label: string; nPct: number }> = {
  ureia_branca:    { label: "Ureia Branca",     nPct: 0.45 },
  ureia_protegida: { label: "Ureia Protegida",   nPct: 0.45 },
  sulfato_amonio:  { label: "Sulfato de Amônio", nPct: 0.21 },
  nitrato_amonio:  { label: "Nitrato de Amônio", nPct: 0.327 },
};

const FORMAS: Record<FormaAplicacao, string> = {
  drench:        "Drench",
  nonino:        "Nonino",
  fertirrigacao: "Fertirrigação",
  pulverizador:  "Pulverizador",
  drone:         "Drone",
  aviao:         "Avião",
};

// Litros de complexante por 1.000 L de N180
const CX_L_1000: Record<Complexante, number> = { tsh: 60, lifegrow: 75, leg: 25 };
const CX_LABEL:  Record<Complexante, string>  = { tsh: "TSH", lifegrow: "Life Grow", leg: "LEG" };

// Ureia reduzida (kg/ha) após aplicar as regras de redução por tipo de adubo
function calcUreiaReduzida(adubo: AduboKey, dose: number): number {
  switch (adubo) {
    case "ureia_branca":    return dose * 0.40;                                           // reduz 60%
    case "ureia_protegida": return dose * 0.45;                                           // reduz 55%
    case "sulfato_amonio":
      if (dose > 400) return (dose - 200) * 0.21 * 0.50 / 0.45;                         // max 200 kg SA
      if (dose > 300) return (dose - 150) * 0.21 * 0.50 / 0.45;                         // max 150 kg SA
      return dose * 0.21 * 0.50 / 0.45;                                                  // substituição completa
    case "nitrato_amonio":  return dose * 0.327 * 0.55 / 0.45;                           // reduz 45%
  }
}

// Quantidade de SA a ser aplicado (kg/ha), se aplicável
function calcSAUsado(adubo: AduboKey, dose: number): number {
  if (adubo !== "sulfato_amonio") return 0;
  if (dose > 400) return 200;
  if (dose > 300) return 150;
  return dose;
}

// Estágios de cobertura e limites de referência (L/ha)
const COB_STAGES = [
  { stage: "V2", max: 120, min: 50  },
  { stage: "V4", max: 100, min: 50  },
  { stage: "V6", max: 80,  min: 30  },
  { stage: "V8", max: 60,  min: 0   },
  { stage: "R1", max: 40,  min: 0   },
];

// Divide cobertura igualmente pelo número de aplicações escolhido
function distribuirCobertura(totalHa: number, nCoberturas: number): { stage: string; vol: number; max: number; min: number }[] {
  const n = Math.max(1, Math.min(nCoberturas, COB_STAGES.length));
  const volPorApp = totalHa / n;
  return COB_STAGES.slice(0, n).map(s => ({ stage: s.stage, vol: volPorApp, max: s.max, min: s.min }));
}

function isLiquidoForma(forma: FormaAplicacao) {
  return ["drench", "nonino", "fertirrigacao"].includes(forma);
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{t}</label>
      {children}
    </div>
  );
}

function PrecoInput({ value, onChange, label, step = "1" }: {
  value: number; onChange: (v: number) => void; label: string; step?: string;
}) {
  return (
    <Lbl t={label}>
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
        <Input type="number" step={step} value={value || ""} onFocus={e => e.target.select()}
          onChange={e => onChange(parseFloat(e.target.value) || 0)} className="rounded-l-none" />
      </div>
    </Lbl>
  );
}

export default function CalculadoraN180() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: mps, loading: mpsLoading } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: complexadores, loading: cmpLoading } = useGlobalTable<Complexador>("nutrir_complexadores", "nome");
  const { params, loading: cfgLoading } = useMotorConfig();
  const [precoInit, setPrecoInit] = useState(false);

  // Identificação
  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });

  // Configuração da calda
  const [adubo, setAdubo] = useState<AduboKey>("ureia_branca");
  const [doseHa, setDoseHa] = useState(200);           // kg/ha do adubo selecionado
  const [formaAplicacao, setFormaAplicacao] = useState<FormaAplicacao>("pulverizador");
  const [possuiMicron, setPossuiMicron] = useState(false);
  const [vazaoMicron, setVazaoMicron] = useState(50);   // L/ha antes do ajuste -10
  const [nCoberturas, setNCoberturas] = useState(2);    // número de aplicações de cobertura
  const [complexanteSulco, setComplexanteSulco] = useState<"tsh" | "lifegrow">("tsh");
  const [complexanteV2, setComplexanteV2] = useState<Complexante>("tsh");
  // complexanteV2 também é a 1ª aplicação quando não há micron
  const [volBatelada, setVolBatelada] = useState(6000);

  // Preços
  const [precos, setPrecos] = useState({ ureia: 4000, tsh: 18.0, lifeGrow: 25.0, leg: 22.0 });

  // Carrega preços do motor de cálculos / matérias-primas
  useEffect(() => {
    if (precoInit || cfgLoading || mpsLoading || cmpLoading) return;
    const cfg = paramMap(params);
    const byCode = (cod: string) => mps.find(m => m.codigo?.toUpperCase() === cod && m.ativo && m.preco_atual != null);
    const byCmp  = (nome: string) => complexadores.find(c => c.nome.toLowerCase().includes(nome.toLowerCase()) && c.ativo);
    const urb      = byCode("URB");
    const tshCmp   = byCmp("TSH");
    const lgCmp    = byCmp("Life Grow") ?? byCmp("lifegrow");
    const legCmp   = byCmp("LEG") ?? byCmp("Leg");
    setPrecos(p => ({
      ureia:    urb?.preco_atual != null ? urb.preco_atual * 1000 : cfg.preco_ureia_kg ? cfg.preco_ureia_kg * 1000 : p.ureia,
      tsh:      tshCmp?.preco_litro ?? cfg.preco_tsh_l    ?? p.tsh,
      lifeGrow: lgCmp?.preco_litro  ?? cfg.preco_lifegrow_l ?? p.lifeGrow,
      leg:      legCmp?.preco_litro ?? cfg.preco_leg_l    ?? p.leg,
    }));
    setPrecoInit(true);
  }, [cfgLoading, mpsLoading, cmpLoading, precoInit, params, mps, complexadores]);

  // Forma líquida (drench/nonino/fertirrigação) não permite LEG
  const allowLeg = !isLiquidoForma(formaAplicacao);
  useEffect(() => {
    if (isLiquidoForma(formaAplicacao) && complexanteV2 === "leg") {
      setComplexanteV2("tsh");
    }
  }, [formaAplicacao]);

  // ── Cálculos principais ───────────────────────────────────────────
  const calc = useMemo(() => {
    const pontosN   = doseHa * ADUBOS[adubo].nPct;
    const ureiaKgHa = calcUreiaReduzida(adubo, doseHa);
    const saKgHa    = calcSAUsado(adubo, doseHa);
    const volCaldaHa = ureiaKgHa * 2.5;                // L/ha de N180

    const sulcoVolHa     = possuiMicron ? Math.max(0, Math.min(vazaoMicron - 10, volCaldaHa)) : 0;
    const coberturaVolHa = volCaldaHa - sulcoVolHa;
    // coberturaApps calculado sempre (não só com micron)
    const coberturaApps  = distribuirCobertura(coberturaVolHa, nCoberturas);

    const cxPorL = (cx: Complexante) => CX_L_1000[cx] / 1000;

    const totalCx: Partial<Record<Complexante, number>> = {};
    const addCx = (cx: Complexante, vol: number) => {
      totalCx[cx] = (totalCx[cx] ?? 0) + vol * cxPorL(cx);
    };

    // Sulco — só com micron
    if (possuiMicron && sulcoVolHa > 0) addCx(complexanteSulco, sulcoVolHa);

    // Coberturas — sempre: 1ª usa complexanteV2, demais usam LEG (ou mesmo cx se forma líquida)
    coberturaApps.forEach((app, i) => {
      const liquido = isLiquidoForma(formaAplicacao);
      if (i === 0 || liquido) {
        addCx(complexanteV2, app.vol);   // 1ª aplicação ou forma líquida: escolha do usuário
      } else {
        addCx("leg", app.vol);           // V4 em diante: LEG obrigatório
      }
    });

    // Custos por ha
    const custoUreia = ureiaKgHa * precos.ureia / 1000;
    const custoCx    =
      (totalCx.tsh      ?? 0) * precos.tsh +
      (totalCx.lifegrow ?? 0) * precos.lifeGrow +
      (totalCx.leg      ?? 0) * precos.leg;
    const custoPorHa = custoUreia + custoCx;

    // Totais para a área
    const area       = meta.areaHa || 0;
    const volTotalL  = volCaldaHa * area;
    const ureiaTotal = ureiaKgHa  * area;
    const saTotal    = saKgHa     * area;
    const cxTotal: Partial<Record<Complexante, number>> = {};
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      if (totalCx[k]) cxTotal[k] = totalCx[k]! * area;
    });
    const custoTotal = custoPorHa * area;

    return {
      pontosN, ureiaKgHa, saKgHa, volCaldaHa,
      sulcoVolHa, coberturaVolHa, coberturaApps,
      totalCx, custoPorHa,
      volTotalL, ureiaTotal, saTotal, cxTotal, custoTotal,
    };
  }, [adubo, doseHa, possuiMicron, vazaoMicron, nCoberturas, complexanteSulco, complexanteV2, formaAplicacao, meta.areaHa, precos]);

  const vBat          = Math.max(volBatelada, 100);
  const batCheias     = Math.floor(calc.volTotalL / vBat);
  const batParcialVol = Math.round(calc.volTotalL % vBat);

  // ENTER → próximo input
  const onEnter = (nextId: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById(nextId)?.focus(); }
  };

  // Gerar Recomendação — PDF padronizado igual ao Foliar Completo
  const irParaRecomendacao = () => {
    const hoje    = new Date().toLocaleDateString("pt-BR");
    const area    = meta.areaHa || 0;
    const logoUrl = window.location.origin + logo1;

    // ── Custo convencional (dose original × preço ureia) ──────────
    const precoKg = precos.ureia / 1000;
    const convHa   = doseHa * precoKg;
    const convTotal = convHa * area;
    const difHa    = calc.custoPorHa - convHa;
    const difPct   = convHa > 0 ? (difHa / convHa) * 100 : 0;

    // ── Aplicações ─────────────────────────────────────────────────
    const apps: { idx: number; etapa: string; tipo: string; desc: string }[] = [];
    let idx = 1;
    if (possuiMicron && calc.sulcoVolHa > 0) {
      apps.push({ idx: idx++, etapa: "Sulco de Plantio", tipo: "Solo/Micron",
        desc: `${num(calc.sulcoVolHa, 0)} L/ha — N180 com ${CX_LABEL[complexanteSulco]}` });
    }
    calc.coberturaApps.forEach((app, i) => {
      const cx: Complexante = (i === 0 || isLiquidoForma(formaAplicacao)) ? complexanteV2 : "leg";
      apps.push({ idx: idx++, etapa: app.stage, tipo: FORMAS[formaAplicacao],
        desc: `${num(app.vol, 0)} L/ha — N180 com ${CX_LABEL[cx]}` });
    });

    // ── Lista de compras ───────────────────────────────────────────
    type CompraItem = { produto: string; necessario: string; prUn: string; total: string };
    const compras: CompraItem[] = [];
    const addSolido = (nome: string, kg: number, prKg: number) => {
      if (kg < 0.1) return;
      compras.push({ produto: nome, necessario: `${num(kg, 0)} kg`, prUn: `R$ ${num(prKg, 2)}/kg`, total: moeda(kg * prKg) });
    };
    const addLiquido = (nome: string, l: number, prL: number) => {
      if (l < 0.1) return;
      compras.push({ produto: nome, necessario: `${num(l, 0)} L`, prUn: `R$ ${num(prL, 2)}/L`, total: moeda(l * prL) });
    };

    addSolido("Ureia", calc.ureiaTotal, precoKg);
    if (calc.saTotal > 0) addSolido("Sulfato de Amônio", calc.saTotal, 1.20);
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      const v = calc.cxTotal[k];
      if (v && v > 0.01) {
        const pr = k === "tsh" ? precos.tsh : k === "lifegrow" ? precos.lifeGrow : precos.leg;
        addLiquido(CX_LABEL[k], v, pr);
      }
    });
    const totalCompras = compras.reduce((s, c) => s + parseFloat(c.total.replace(/[^\d,]/g, "").replace(",", ".") || "0"), 0);

    // ── Receita de preparo (por 1.000 L) ──────────────────────────
    type ReceitaStep = { n: number; item: string; qtd: string; obs: string };
    const buildReceita = (cx: Complexante): ReceitaStep[] => {
      const steps: ReceitaStep[] = [];
      let n = 1;
      steps.push({ n: n++, item: "Água", qtd: "400 L", obs: "Adicionar água limpa ao tanque misturador" });
      steps.push({ n: n++, item: CX_LABEL[cx], qtd: `${CX_L_1000[cx]} L`, obs: `Adicionar o complexador ${CX_LABEL[cx]} e agitar` });
      steps.push({ n: n++, item: "Ureia", qtd: "400 kg", obs: "Adicionar ureia e agitar por 10 minutos" });
      steps.push({ n: n++, item: "Completar com água", qtd: "até 1.000 L", obs: "Após dissolução completa da ureia" });
      return steps;
    };
    const receitaV2  = buildReceita(complexanteV2);
    const receitaLeg = buildReceita("leg");
    const hasLeg = calc.coberturaApps.length > 1 && !isLiquidoForma(formaAplicacao);

    // ── CSS ────────────────────────────────────────────────────────
    const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px 32px;max-width:960px;margin:0 auto}
.btn{background:#15803d;color:#fff;padding:9px 22px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;margin-bottom:20px}
/* header */
.hdr{border-bottom:3px solid #15803d;padding-bottom:12px;margin-bottom:6px}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start}
.hdr h1{color:#15803d;font-size:18px;font-weight:bold;margin-bottom:2px}
.hdr .sub{color:#555;font-size:11px}
.badge{background:#15803d;color:#fff;padding:3px 13px;border-radius:20px;font-size:11px;font-weight:bold}
/* section */
h2{color:#166534;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.07em;margin:16px 0 6px;border-bottom:1px solid #bbf7d0;padding-bottom:3px}
/* tables */
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}
th,td{padding:6px 8px;text-align:left;border:1px solid #e5e7eb}
thead th{background:#15803d;color:#fff;font-weight:bold;text-align:left}
tbody tr:nth-child(even) td,tbody tr:nth-child(even) th{background:#f8fffe}
.th-label{background:#f0fdf4;font-weight:bold;color:#166534;width:28%}
.num{text-align:right}
.b{font-weight:bold}.g{color:#15803d;font-weight:bold}
/* comparativo */
.comp{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#e5e7eb;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:12px}
.comp-cell{background:#fff;padding:10px 12px;text-align:center}
.comp-cell.header{background:#f0fdf4;font-size:10px;font-weight:bold;color:#166534;text-transform:uppercase;letter-spacing:.05em}
.comp-cell .val{font-size:15px;font-weight:bold;margin:3px 0}
.comp-cell .lbl{font-size:10px;color:#666}
.comp-cell.nutrir .val{color:#15803d}
.comp-cell.dif .val{color:${difHa > 0 ? "#dc2626" : "#15803d"}}
/* receita */
.rec-title{font-size:11px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 5px;padding:5px 8px;background:#f1f5f9;border-radius:4px}
/* total box */
.total-box{background:#f0fdf4;border:2px solid #bbf7d0;border-radius:8px;padding:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center}
.total-box .big{font-size:20px;font-weight:bold;color:#15803d}
.total-box .sm{font-size:12px;color:#166534}
/* footer */
.footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#888}
@media print{.btn{display:none}body{padding:16px}@page{margin:15mm}}`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Recomendação N180 — ${meta.produtor || meta.fazenda || meta.cultura}</title>
<style>${css}</style></head><body>
<button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

<!-- HEADER -->
<div class="hdr">
  <img src="${logoUrl}" style="height:48px;margin-bottom:10px;display:block" alt="NUTRIR" />
  <div class="hdr-top">
    <div>
      <h1>Recomendação N180 — Nitrogênio Líquido</h1>
      <div class="sub">${[meta.produtor, meta.fazenda, meta.cultura, `${num(area,0)} ha`, hoje].filter(Boolean).join(" · ")}</div>
    </div>
    <span class="badge">N180</span>
  </div>
</div>

<!-- COMPARATIVO DE CUSTOS -->
<h2>Comparativo de Custos: Convencional × NUTRIR</h2>
<div class="comp">
  <div class="comp-cell header">Convencional</div>
  <div class="comp-cell header nutrir">NUTRIR N180</div>
  <div class="comp-cell header dif">Diferença</div>

  <div class="comp-cell"><div class="lbl">R$ / ha</div><div class="val">${moeda(convHa)}</div></div>
  <div class="comp-cell nutrir"><div class="lbl">R$ / ha</div><div class="val">${moeda(calc.custoPorHa)}</div></div>
  <div class="comp-cell dif"><div class="lbl">R$ / ha</div><div class="val">${difHa >= 0 ? "+" : ""}${moeda(difHa)}</div></div>

  <div class="comp-cell"><div class="lbl">Total na área</div><div class="val">${moeda(convTotal)}</div></div>
  <div class="comp-cell nutrir"><div class="lbl">Total na área</div><div class="val">${moeda(calc.custoTotal)}</div></div>
  <div class="comp-cell dif"><div class="lbl">${difHa >= 0 ? "Investimento" : "Economia"}</div><div class="val">${moeda(Math.abs(difHa * area))}</div></div>

  <div class="comp-cell"></div>
  <div class="comp-cell nutrir"></div>
  <div class="comp-cell dif"><div class="lbl">%</div><div class="val">${difPct >= 0 ? "+" : ""}${num(difPct, 1)}%</div></div>
</div>

<!-- VOLUME -->
<h2>Volume Total de Aplicação</h2>
<table>
  <thead><tr><th>Volume N180/ha</th><th>Volume total</th><th>Nº bateladas</th><th>Nº aplicações</th><th>Adubo substituído</th></tr></thead>
  <tbody><tr>
    <td class="b">${num(calc.volCaldaHa, 0)} L/ha</td>
    <td class="b">${num(calc.volTotalL, 0)} L</td>
    <td>${batCheias}${batParcialVol > 0 ? " + 1 parcial" : ""}</td>
    <td>${apps.length}</td>
    <td>${ADUBOS[adubo].label} ${num(doseHa, 0)} kg/ha → ${num(calc.ureiaKgHa, 1)} kg N180/ha</td>
  </tr></tbody>
</table>

<!-- APLICAÇÕES POR ESTÁGIO -->
<h2>Aplicações por Estágio Fenológico</h2>
<table>
  <thead><tr><th>#</th><th>Estágio</th><th>Tipo Aplicação</th><th>Descrição</th></tr></thead>
  <tbody>
    ${apps.map(a => `<tr><td class="b">${a.idx}</td><td class="b">${a.etapa}</td><td>${a.tipo}</td><td>${a.desc}</td></tr>`).join("")}
  </tbody>
</table>

<!-- LISTA DE COMPRAS -->
<h2>Lista de Compras (Matérias-primas)</h2>
<table>
  <thead><tr><th>Produto</th><th>Necessário</th><th>R$/un</th><th class="num">Total</th></tr></thead>
  <tbody>
    ${compras.map(c => `<tr><td class="b">${c.produto}</td><td>${c.necessario}</td><td>${c.prUn}</td><td class="num g">${c.total}</td></tr>`).join("")}
    <tr style="background:#f0fdf4"><td colspan="3" style="font-weight:bold;text-align:right">TOTAL</td><td class="num g" style="font-weight:bold;font-size:13px">${moeda(compras.reduce((s,c) => {
      const v = parseFloat(c.total.replace(/[R$\s.]/g,"").replace(",","."));
      return s + (isNaN(v) ? 0 : v);
    }, 0))}</td></tr>
  </tbody>
</table>

<!-- RECEITA DE PREPARO -->
<h2>Receita de Preparo da Calda (por 1.000 L)</h2>
${possuiMicron && calc.sulcoVolHa > 0 ? `
<div class="rec-title">Sulco de Plantio — ${CX_LABEL[complexanteSulco]}</div>
<table>
  <thead><tr><th style="width:40px">#</th><th>Ingrediente</th><th>Quantidade</th><th>Instrução</th></tr></thead>
  <tbody>
    ${buildReceita(complexanteSulco).map(s => `<tr><td class="b">${s.n}</td><td>${s.item}</td><td class="b">${s.qtd}</td><td>${s.obs}</td></tr>`).join("")}
  </tbody>
</table>` : ""}
<div class="rec-title">${possuiMicron ? "Coberturas — 1ª Aplicação" : "1ª Cobertura"} — ${CX_LABEL[complexanteV2]}</div>
<table>
  <thead><tr><th style="width:40px">#</th><th>Ingrediente</th><th>Quantidade</th><th>Instrução</th></tr></thead>
  <tbody>
    ${receitaV2.map(s => `<tr><td class="b">${s.n}</td><td>${s.item}</td><td class="b">${s.qtd}</td><td>${s.obs}</td></tr>`).join("")}
    <tr style="background:#f0fdf4"><td colspan="2" style="font-weight:bold">Volume da batelada</td><td class="b">${num(vBat,0)} L</td><td>Produção para ${num(area,0)} ha</td></tr>
    <tr style="background:#f0fdf4"><td colspan="2" style="font-weight:bold">Aplicação</td><td class="b">${num(calc.volCaldaHa / nCoberturas,0)} L/ha</td><td>${FORMAS[formaAplicacao]}</td></tr>
  </tbody>
</table>
${hasLeg ? `
<div class="rec-title">2ª Cobertura em diante — LEG</div>
<table>
  <thead><tr><th style="width:40px">#</th><th>Ingrediente</th><th>Quantidade</th><th>Instrução</th></tr></thead>
  <tbody>
    ${receitaLeg.map(s => `<tr><td class="b">${s.n}</td><td>${s.item}</td><td class="b">${s.qtd}</td><td>${s.obs}</td></tr>`).join("")}
  </tbody>
</table>` : ""}

<!-- TOTAIS FINAIS -->
<div class="total-box">
  <div><div class="big">${moeda(calc.custoTotal)}</div><div class="sm">Custo total N180 · ${num(area,0)} ha</div></div>
  <div style="text-align:right"><div class="big">${moeda(calc.custoPorHa)}</div><div class="sm">por hectare</div></div>
</div>

${difHa < 0 ? `
<div style="margin:16px 0 14px;border:2px solid #15803d;border-radius:10px;overflow:hidden">
  <div style="background:#15803d;color:#fff;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">
    &#9733; Destaque de Economia &mdash; N180 NUTRIR vs Aduba&ccedil;&atilde;o Convencional
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#fff;align-items:center">
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Convencional / ha</div>
      <div style="font-size:22px;font-weight:700;color:#ef4444">${moeda(convHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moeda(convTotal)}</div>
    </div>
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">N180 NUTRIR / ha</div>
      <div style="font-size:22px;font-weight:700;color:#15803d">${moeda(calc.custoPorHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moeda(calc.custoPorHa * area)}</div>
    </div>
    <div style="text-align:center;padding:14px 12px;background:#f0fdf4">
      <div style="font-size:9px;color:#166534;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;font-weight:600">Economia com NUTRIR</div>
      <div style="font-size:15px;font-weight:700;color:#16a34a;margin-bottom:2px">&#9660; ${moeda(Math.abs(difHa))}/ha &nbsp;(${num(Math.abs(difPct),1)}%)</div>
      <div style="font-size:26px;font-weight:800;color:#14532d;line-height:1.1">${moeda(Math.abs(difHa * area))}</div>
      <div style="font-size:10px;color:#15803d;margin-top:3px">em ${num(area,0)} ha</div>
    </div>
  </div>
</div>` : ""}
<div class="footer">
  <span>NUTRIR — Programa de Adubação N180</span>
  <span>Gerado em ${hoje}</span>
</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  // Gerar Pedido Fertagro — apenas complexantes (TSH, Life Grow, LEG), sem ureia/KCl/SA
  const irParaPedidoFertagro = () => {
    const itens: any[] = [];
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      const v = calc.cxTotal[k];
      if (v && v > 0.01)
        itens.push({
          produto_nome:   CX_LABEL[k],
          quantidade:     Math.ceil(v),
          unidade:        "L",
          preco_unitario: k === "tsh" ? precos.tsh : k === "lifegrow" ? precos.lifeGrow : precos.leg,
        });
    });
    if (itens.length === 0) {
      toast({ title: "Nenhum produto Fertagro nesta configuração", variant: "destructive" });
      return;
    }
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem:       "calc_n180_fertagro",
      titulo:       `Fertagro N180 — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha:      meta.areaHa,
      observacoes:  `Complexantes N180 Fertagro · ${meta.cultura} · ${meta.areaHa} ha`,
      itens,
    }));
    navigate("/app/rep/pedidos");
  };

  const listaCulturas = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;
  const fontePrecosMsg = mps.length > 0
    ? `✓ Preços do banco (${mps.length} MPs · ${complexadores.length} complexantes)`
    : "⚠ Cadastre matérias-primas para preços automáticos";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-primary" />N180 — Nitrogênio Líquido</span> as any}
        description="Ureia complexada · substituição de adubação de base · bateladas · lista de compras"
        actions={<Button onClick={irParaRecomendacao} className="gap-1.5"><FileText className="w-4 h-4" />Gerar Recomendação</Button>}
      />

      <div className="px-4 space-y-4">

        {/* Identificação */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Identificação</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${mps.length > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {fontePrecosMsg}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Lbl t="Produtor">
              <Input id="n180-produtor" value={meta.produtor} placeholder="Nome do produtor"
                onChange={e => setMeta({ ...meta, produtor: e.target.value })}
                onKeyDown={onEnter("n180-fazenda")} />
            </Lbl>
            <Lbl t="Fazenda">
              <Input id="n180-fazenda" value={meta.fazenda} placeholder="Nome da fazenda"
                onChange={e => setMeta({ ...meta, fazenda: e.target.value })}
                onKeyDown={onEnter("n180-area")} />
            </Lbl>
            <Lbl t="Cultura">
              <Select value={meta.cultura} onValueChange={v => setMeta({ ...meta, cultura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{listaCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Área (ha)">
              <Input id="n180-area" type="number" value={meta.areaHa || ""} onFocus={e => e.target.select()}
                onChange={e => setMeta({ ...meta, areaHa: parseFloat(e.target.value) || 0 })}
                onKeyDown={onEnter("n180-dose")} />
            </Lbl>
          </div>
        </CardContent></Card>

        {/* Configuração N180 */}
        <Card className="border-green-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-green-700" />
            <p className="text-sm font-semibold text-green-700">Configuração N180</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {/* Adubo */}
            <Lbl t="Adubo">
              <Select value={adubo} onValueChange={v => setAdubo(v as AduboKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ADUBOS) as [AduboKey, { label: string; nPct: number }][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Lbl>

            {/* Dose */}
            <Lbl t="Dose (kg/ha)">
              <Input id="n180-dose" type="number" step="10" value={doseHa || ""} onFocus={e => e.target.select()}
                onChange={e => setDoseHa(parseFloat(e.target.value) || 0)}
                onKeyDown={onEnter("n180-preco-ureia")} />
            </Lbl>

            {/* Pontos de N — auto */}
            <Lbl t="Pontos de N (kg N/ha)">
              <div className="h-10 flex items-center px-3 bg-green-50 border border-green-200 rounded-md">
                <span className="font-bold text-green-700 text-sm">{num(calc.pontosN, 1)} kg N/ha</span>
              </div>
            </Lbl>

            {/* Forma de aplicação */}
            <Lbl t="Forma de Aplicação">
              <Select value={formaAplicacao} onValueChange={v => setFormaAplicacao(v as FormaAplicacao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(FORMAS) as [FormaAplicacao, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Lbl>
          </div>

          {/* N° de coberturas + Complexante 1ª aplicação — sempre visíveis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Lbl t="N° de Coberturas">
              <Select value={String(nCoberturas)} onValueChange={v => setNCoberturas(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 cobertura (V2)</SelectItem>
                  <SelectItem value="2">2 coberturas (V2, V4)</SelectItem>
                  <SelectItem value="3">3 coberturas (V2, V4, V6)</SelectItem>
                  <SelectItem value="4">4 coberturas (V2, V4, V6, V8)</SelectItem>
                  <SelectItem value="5">5 coberturas (V2, V4, V6, V8, R1)</SelectItem>
                </SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Complexante — 1ª Aplicação">
              <Select value={complexanteV2} onValueChange={v => setComplexanteV2(v as Complexante)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tsh">TSH</SelectItem>
                  <SelectItem value="lifegrow">Life Grow</SelectItem>
                  {allowLeg && <SelectItem value="leg">LEG</SelectItem>}
                </SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Vol. por aplicação">
              <div className="h-10 flex items-center px-3 bg-green-50 border border-green-200 rounded-md">
                <span className="font-bold text-green-700 text-sm">{num(calc.coberturaVolHa / nCoberturas, 0)} L/ha</span>
              </div>
            </Lbl>
          </div>

          {/* Possui Micron — abre campos de sulco */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg mb-3 cursor-pointer" onClick={() => setPossuiMicron(p => !p)}>
            <input type="checkbox" readOnly checked={possuiMicron} className="w-4 h-4 accent-primary pointer-events-none" />
            <span className="text-sm font-medium">Possui Micron (aplicação adicional no sulco de plantio)</span>
          </div>

          {possuiMicron && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Lbl t="Vazão Micron (L/ha)">
                  <Input type="number" step="5" value={vazaoMicron || ""} onFocus={e => e.target.select()}
                    onChange={e => setVazaoMicron(parseFloat(e.target.value) || 0)} />
                </Lbl>
                <Lbl t="Dose no Sulco (L/ha)">
                  <div className="h-10 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="font-bold text-blue-700 text-sm">{num(calc.sulcoVolHa, 0)} L/ha</span>
                  </div>
                </Lbl>
                <Lbl t="Complexante — Sulco">
                  <Select value={complexanteSulco} onValueChange={v => setComplexanteSulco(v as "tsh" | "lifegrow")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tsh">TSH</SelectItem>
                      <SelectItem value="lifegrow">Life Grow</SelectItem>
                    </SelectContent>
                  </Select>
                </Lbl>
              </div>
            </div>
          )}

          {!allowLeg && (
            <div className="text-[10px] text-amber-600 font-semibold bg-amber-50 rounded-md px-3 py-2 mt-2">
              Forma líquida: LEG não permitido
            </div>
          )}
        </CardContent></Card>

        {/* Resultado por hectare */}
        <Card className="border-green-200"><CardContent className="pt-4">
          <p className="text-sm font-semibold text-green-700 mb-3">Resultado por Hectare</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-green-50 rounded-lg text-xs mb-3">
            <div>
              <p className="text-muted-foreground">Ureia N180/ha</p>
              <p className="font-bold">{num(calc.ureiaKgHa, 1)} kg</p>
            </div>
            {calc.saKgHa > 0 && (
              <div>
                <p className="text-muted-foreground">Sulfato Amônio/ha</p>
                <p className="font-bold">{num(calc.saKgHa, 0)} kg</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Volume N180/ha</p>
              <p className="font-bold">{num(calc.volCaldaHa, 0)} L</p>
            </div>
            <div>
              <p className="text-muted-foreground">Custo N180/ha</p>
              <p className="font-bold text-green-700">{moeda(calc.custoPorHa)}</p>
            </div>
          </div>

          {/* Complexantes por ha */}
          <div className="text-xs space-y-0.5 px-1 mb-3">
            {(["tsh", "lifegrow", "leg"] as Complexante[]).map(k => {
              const v = calc.totalCx[k];
              if (!v || v < 0.01) return null;
              return (
                <div key={k}>
                  {CX_LABEL[k]}/ha:{" "}
                  <span className="font-semibold text-foreground">{num(v, 2)} L</span>
                </div>
              );
            })}
          </div>

          {/* Receita por 1.000 L */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs">
            <p className="font-semibold mb-2">Fórmula por 1.000 L de N180:</p>
            <div className="space-y-2">
              {possuiMicron && (
                <div>
                  <p className="font-medium text-muted-foreground">Sulco — {CX_LABEL[complexanteSulco]}</p>
                  <p>400 L água + 400 kg ureia + {CX_L_1000[complexanteSulco]} L {CX_LABEL[complexanteSulco]} + água até 1.000 L</p>
                </div>
              )}
              <div>
                <p className="font-medium text-muted-foreground">
                  {possuiMicron ? "V2 — 1ª cobertura" : "1ª cobertura"} — {CX_LABEL[complexanteV2]}
                </p>
                <p>400 L água + 400 kg ureia + {CX_L_1000[complexanteV2]} L {CX_LABEL[complexanteV2]} + água até 1.000 L</p>
              </div>
              {calc.coberturaApps.length > 1 && !isLiquidoForma(formaAplicacao) && (
                <div>
                  <p className="font-medium text-muted-foreground">V4 em diante — LEG (obrigatório)</p>
                  <p>400 L água + 400 kg ureia + 25 L LEG + água até 1.000 L</p>
                </div>
              )}
            </div>
          </div>
        </CardContent></Card>

        {/* Distribuição de aplicações — sempre visível */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Distribuição de Aplicações</p>
          <div className="space-y-1">
            {/* Sulco — apenas quando possui Micron */}
            {possuiMicron && (
              <div className="flex items-center justify-between py-2.5 border-b">
                <div>
                  <p className="text-sm font-medium">Sulco de Plantio</p>
                  <p className="text-xs text-muted-foreground">{CX_LABEL[complexanteSulco]} · {num(calc.sulcoVolHa, 0)} L/ha</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold">{num(calc.sulcoVolHa * meta.areaHa, 0)} L total</p>
                </div>
              </div>
            )}
            {/* Coberturas — sempre */}
            {calc.coberturaApps.map((app, i) => {
              const liquido = isLiquidoForma(formaAplicacao);
              const cx: Complexante = (i === 0 || liquido) ? complexanteV2 : "leg";
              const fora = app.vol > app.max || (app.min > 0 && app.vol < app.min);
              return (
                <div key={app.stage} className={`flex items-center justify-between py-2.5 border-b last:border-0 ${fora ? "bg-amber-50 -mx-2 px-2 rounded" : ""}`}>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {app.stage}
                      {fora && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded">fora do limite</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CX_LABEL[cx]} · {num(app.vol, 0)} L/ha
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold">{num(app.vol * meta.areaHa, 0)} L total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>

        {/* Preços de insumos — só ureia editável; complexantes puxam do banco */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-1">Preço do Adubo</p>
          <p className="text-[11px] text-muted-foreground mb-3">Complexantes carregados automaticamente do banco de dados</p>
          <div className="max-w-[200px]">
            <Lbl t="Ureia (R$/t)">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
                <Input id="n180-preco-ureia" type="number" step="10" value={precos.ureia || ""} onFocus={e => e.target.select()}
                  onChange={e => setPrecos({ ...precos, ureia: parseFloat(e.target.value) || 0 })}
                  onKeyDown={onEnter("n180-vol-batelada")} className="rounded-l-none" />
              </div>
            </Lbl>
          </div>
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)">
              <Input id="n180-vol-batelada" type="number" value={volBatelada || ""} onFocus={e => e.target.select()}
                onChange={e => setVolBatelada(parseFloat(e.target.value) || 1000)} />
            </Lbl>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-bold text-green-700 mb-2">N180 — {num(calc.volTotalL, 0)} L totais ({num(meta.areaHa, 0)} ha)</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcialVol > 0 && (
                <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcialVol, 0)} L</span>
              )}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {num(vBat * 0.4, 0)} kg ureia</p>
              <p>+ {num(CX_L_1000[complexanteV2] * vBat / 1000, 1)} L {CX_LABEL[complexanteV2]} (1ª cobertura)</p>
              <p>Completar com água até {num(vBat, 0)} L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo final */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Insumos e Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Ureia total</p>
              <p className="font-bold">{num(calc.ureiaTotal / 1000, 3)} t</p>
            </div>
            {calc.saTotal > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Sulfato de Amônio</p>
                <p className="font-bold">{num(calc.saTotal, 0)} kg</p>
              </div>
            )}
            {(["tsh", "lifegrow", "leg"] as Complexante[]).map(k => {
              const v = calc.cxTotal[k];
              if (!v || v < 0.01) return null;
              return (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{CX_LABEL[k]} total</p>
                  <p className="font-bold">{num(v, 0)} L</p>
                </div>
              );
            })}
            <div>
              <p className="text-xs text-muted-foreground">Custo N180/ha</p>
              <p className="font-bold text-green-700">{moeda(calc.custoPorHa)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p>
              <p className="font-bold text-primary">{moeda(calc.custoTotal)}</p>
            </div>
          </div>
          <Button className="w-full mt-2 gap-2" onClick={irParaRecomendacao}>
            <FileText className="h-4 w-4" />Gerar Recomendação
          </Button>
          <Button variant="outline" className="w-full mt-2 gap-2" onClick={irParaPedidoFertagro}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido Fertagro (TSH / Life Grow / LEG)
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
