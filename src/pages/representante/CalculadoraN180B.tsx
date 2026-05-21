import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable, useOrgTable } from "@/lib/nutrir/useNutrirData";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { FlaskConical, ShoppingCart, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── tipos ─────────────────────────────────────────────────────────────────
interface Cultura  { id: string; nome: string; }
interface MP       { id: string; codigo: string | null; nome: string; preco_atual: number | null; unidade_preco: string; ativo: boolean; }
interface Complexador { id: string; nome: string; preco_litro: number; ativo: boolean; }

type AduboKey      = "ureia_branca" | "ureia_protegida" | "sulfato_amonio" | "nitrato_amonio";
type FormaAplicacao = "drench" | "nonino" | "fertirrigacao" | "pulverizador" | "drone" | "aviao";
type Complexante   = "tsh" | "lifegrow" | "leg";

// ─── constantes ────────────────────────────────────────────────────────────
const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];

const ADUBOS: Record<AduboKey, { label: string; nPct: number }> = {
  ureia_branca:    { label: "Ureia Branca",     nPct: 0.45 },
  ureia_protegida: { label: "Ureia Protegida",   nPct: 0.45 },
  sulfato_amonio:  { label: "Sulfato de Amônio", nPct: 0.21 },
  nitrato_amonio:  { label: "Nitrato de Amônio", nPct: 0.327 },
};

const FORMAS: Record<FormaAplicacao, string> = {
  drench: "Drench", nonino: "Nonino", fertirrigacao: "Fertirrigação",
  pulverizador: "Pulverizador", drone: "Drone", aviao: "Avião",
};

const CX_L_1000: Record<Complexante, number> = { tsh: 60, lifegrow: 75, leg: 25 };
const CX_LABEL:  Record<Complexante, string>  = { tsh: "TSH", lifegrow: "Life Grow", leg: "LEG" };

// Boro: Ácido Bórico tem 17% de B; Complex Bor = 65% em litros sobre kg de AB
const AB_PCT  = 0.17;  // % B no Ácido Bórico
const BOR_PCT = 0.65;  // L Complex Bor por kg Ácido Bórico

const COB_STAGES = [
  { stage: "V2", max: 120, min: 50 },
  { stage: "V4", max: 100, min: 50 },
  { stage: "V6", max: 80,  min: 30 },
  { stage: "V8", max: 60,  min: 0  },
  { stage: "R1", max: 40,  min: 0  },
];

// ─── helpers ───────────────────────────────────────────────────────────────
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num   = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

function calcUreiaReduzida(adubo: AduboKey, dose: number): number {
  switch (adubo) {
    case "ureia_branca":    return dose * 0.40;
    case "ureia_protegida": return dose * 0.45;
    case "sulfato_amonio":
      if (dose > 400) return (dose - 200) * 0.21 * 0.50 / 0.45;
      if (dose > 300) return (dose - 150) * 0.21 * 0.50 / 0.45;
      return dose * 0.21 * 0.50 / 0.45;
    case "nitrato_amonio":  return dose * 0.327 * 0.55 / 0.45;
  }
}

function calcSAUsado(adubo: AduboKey, dose: number): number {
  if (adubo !== "sulfato_amonio") return 0;
  if (dose > 400) return 200;
  if (dose > 300) return 150;
  return dose;
}

function isLiquidoForma(f: FormaAplicacao) {
  return ["drench", "nonino", "fertirrigacao"].includes(f);
}

function distribuirCobertura(total: number, n: number) {
  const count = Math.max(1, Math.min(n, COB_STAGES.length));
  const vol   = total / count;
  return COB_STAGES.slice(0, count).map(s => ({ ...s, vol }));
}

// ─── sub-componentes ───────────────────────────────────────────────────────
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{t}</label>
      {children}
    </div>
  );
}

function PrecoInput({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
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

// ─── componente principal ──────────────────────────────────────────────────
export default function CalculadoraN180B() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: mps, loading: mpsLoading } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: complexadores, loading: cmpLoading } = useGlobalTable<Complexador>("nutrir_complexadores", "nome");
  const { params, loading: cfgLoading } = useMotorConfig();
  const [precoInit, setPrecoInit] = useState(false);

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [adubo, setAdubo] = useState<AduboKey>("ureia_branca");
  const [doseHa, setDoseHa] = useState(200);
  const [boroGrHa, setBoroGrHa] = useState(400);          // gr/ha de Boro
  const [formaAplicacao, setFormaAplicacao] = useState<FormaAplicacao>("pulverizador");
  const [possuiMicron, setPossuiMicron] = useState(false);
  const [vazaoMicron, setVazaoMicron] = useState(50);
  const [nCoberturas, setNCoberturas] = useState(2);
  const [complexanteSulco, setComplexanteSulco] = useState<"tsh" | "lifegrow">("tsh");
  const [complexanteV2, setComplexanteV2] = useState<Complexante>("tsh");
  const [volBatelada, setVolBatelada] = useState(6000);
  const [precos, setPrecos] = useState({ ureia: 4000, tsh: 18.0, lifeGrow: 25.0, leg: 22.0, acidoBorico: 6.5, complexBor: 32.0 });

  // Carrega preços do motor
  useEffect(() => {
    if (precoInit || cfgLoading || mpsLoading || cmpLoading) return;
    const cfg    = paramMap(params);
    const byCode = (cod: string) => mps.find(m => m.codigo?.toUpperCase() === cod && m.ativo && m.preco_atual != null);
    const byCmp  = (nome: string) => complexadores.find(c => c.nome.toLowerCase().includes(nome.toLowerCase()) && c.ativo);
    const urb    = byCode("URB");
    const tshCmp = byCmp("TSH");
    const lgCmp  = byCmp("Life Grow") ?? byCmp("lifegrow");
    const legCmp = byCmp("LEG") ?? byCmp("Leg");
    setPrecos(p => ({
      ...p,
      ureia:    urb?.preco_atual != null ? urb.preco_atual * 1000 : cfg.preco_ureia_kg ? cfg.preco_ureia_kg * 1000 : p.ureia,
      tsh:      tshCmp?.preco_litro ?? cfg.preco_tsh_l    ?? p.tsh,
      lifeGrow: lgCmp?.preco_litro  ?? cfg.preco_lifegrow_l ?? p.lifeGrow,
      leg:      legCmp?.preco_litro ?? cfg.preco_leg_l    ?? p.leg,
    }));
    setPrecoInit(true);
  }, [cfgLoading, mpsLoading, cmpLoading, precoInit, params, mps, complexadores]);

  const allowLeg = !isLiquidoForma(formaAplicacao);
  useEffect(() => {
    if (isLiquidoForma(formaAplicacao) && complexanteV2 === "leg") setComplexanteV2("tsh");
  }, [formaAplicacao]);

  // ─── Boro ────────────────────────────────────────────────────────────────
  const boro = useMemo(() => {
    const acidoBoricoKgHa = (boroGrHa / 1000) / AB_PCT;   // kg AB/ha
    const complexBorLHa   = acidoBoricoKgHa * BOR_PCT;     // L Bor/ha
    return { acidoBoricoKgHa, complexBorLHa };
  }, [boroGrHa]);

  // ─── Cálculo principal ───────────────────────────────────────────────────
  const calc = useMemo(() => {
    const pontosN    = doseHa * ADUBOS[adubo].nPct;
    const ureiaKgHa  = calcUreiaReduzida(adubo, doseHa);
    const saKgHa     = calcSAUsado(adubo, doseHa);
    const volCaldaHa = ureiaKgHa * 2.5;

    const sulcoVolHa     = possuiMicron ? Math.max(0, Math.min(vazaoMicron - 10, volCaldaHa)) : 0;
    const coberturaVolHa = volCaldaHa - sulcoVolHa;
    const coberturaApps  = distribuirCobertura(coberturaVolHa, nCoberturas);

    const cxPorL = (cx: Complexante) => CX_L_1000[cx] / 1000;
    const totalCx: Partial<Record<Complexante, number>> = {};
    const addCx = (cx: Complexante, vol: number) => { totalCx[cx] = (totalCx[cx] ?? 0) + vol * cxPorL(cx); };

    if (possuiMicron && sulcoVolHa > 0) addCx(complexanteSulco as Complexante, sulcoVolHa);
    coberturaApps.forEach((app, i) => {
      const liquido = isLiquidoForma(formaAplicacao);
      addCx((i === 0 || liquido) ? complexanteV2 : "leg", app.vol);
    });

    // Custos N180
    const custoUreia = ureiaKgHa * precos.ureia / 1000;
    const custoCx    = (totalCx.tsh ?? 0) * precos.tsh + (totalCx.lifegrow ?? 0) * precos.lifeGrow + (totalCx.leg ?? 0) * precos.leg;
    // Custos Boro
    const custoBoro  = boro.acidoBoricoKgHa * precos.acidoBorico + boro.complexBorLHa * precos.complexBor;
    const custoPorHa = custoUreia + custoCx + custoBoro;

    const area       = meta.areaHa || 0;
    const volTotalL  = volCaldaHa * area;
    const ureiaTotal = ureiaKgHa  * area;
    const saTotal    = saKgHa     * area;
    const cxTotal: Partial<Record<Complexante, number>> = {};
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      if (totalCx[k]) cxTotal[k] = totalCx[k]! * area;
    });
    const abTotal    = boro.acidoBoricoKgHa * area;
    const borTotal   = boro.complexBorLHa   * area;
    const custoTotal = custoPorHa * area;

    return {
      pontosN, ureiaKgHa, saKgHa, volCaldaHa,
      sulcoVolHa, coberturaVolHa, coberturaApps,
      totalCx, custoPorHa,
      volTotalL, ureiaTotal, saTotal, cxTotal, abTotal, borTotal, custoTotal,
    };
  }, [adubo, doseHa, possuiMicron, vazaoMicron, nCoberturas, complexanteSulco, complexanteV2, formaAplicacao, meta.areaHa, precos, boro]);

  const vBat          = Math.max(volBatelada, 100);
  const batCheias     = Math.floor(calc.volTotalL / vBat);
  const batParcialVol = Math.round(calc.volTotalL % vBat);

  // Por 1000L — proporções do Boro são escaladas pelo volume da calda
  const abPor1000  = calc.volCaldaHa > 0 ? (boro.acidoBoricoKgHa / calc.volCaldaHa) * 1000 : 0;
  const borPor1000 = calc.volCaldaHa > 0 ? (boro.complexBorLHa   / calc.volCaldaHa) * 1000 : 0;

  const irParaRecomendacao = () => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const area = meta.areaHa || 0;
    const emSacos = (kg: number, s = 50) => { const n = Math.ceil(kg/s); return `${(n*s).toLocaleString("pt-BR")} kg (${n} saco${n!==1?"s":""} × ${s} kg)`; };
    const emTam   = (l:  number, t = 200) => { const n = Math.ceil(l/t);  return `${(n*t).toLocaleString("pt-BR")} L (${n} tambor${n!==1?"es":""} × ${t} L)`; };
    const m = (v: number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    const n = (v: number, d=1) => v.toLocaleString("pt-BR",{maximumFractionDigits:d,minimumFractionDigits:d});

    const precoKg   = precos.ureia / 1000;
    const convHa    = doseHa * precoKg;
    const difHa     = calc.custoPorHa - convHa;
    const difPct    = convHa > 0 ? (difHa/convHa)*100 : 0;

    // Aplicações
    const apps: {idx:number;etapa:string;tipo:string;desc:string}[] = [];
    let idx = 1;
    if (possuiMicron && calc.sulcoVolHa > 0)
      apps.push({idx:idx++,etapa:"Sulco de Plantio",tipo:"Solo/Micron",desc:`${n(calc.sulcoVolHa,0)} L/ha — N180+B com ${CX_LABEL[complexanteSulco]}`});
    calc.coberturaApps.forEach((app,i) => {
      const cx:Complexante = (i===0||isLiquidoForma(formaAplicacao))?complexanteV2:"leg";
      apps.push({idx:idx++,etapa:app.stage,tipo:FORMAS[formaAplicacao],desc:`${n(app.vol,0)} L/ha — N180+B com ${CX_LABEL[cx]}`});
    });

    // Lista de compras
    type CI = {produto:string;necessario:string;comprar:string;prUn:string;total:string};
    const compras:CI[] = [];
    const add = (prod:string,necessario:string,comprar:string,prUn:string,val:number) =>
      compras.push({produto:prod,necessario,comprar,prUn,total:m(val)});
    add("Ureia",`${n(calc.ureiaTotal,0)} kg`,emSacos(calc.ureiaTotal),`R$ ${n(precoKg,2)}/kg`,calc.ureiaTotal*precoKg);
    if(calc.saTotal>0) add("Sulfato de Amônio",`${n(calc.saTotal,0)} kg`,emSacos(calc.saTotal,50),`R$ 1,20/kg`,calc.saTotal*1.2);
    add("Ácido Bórico",`${n(calc.abTotal,1)} kg`,emSacos(calc.abTotal,25),`R$ ${n(precos.acidoBorico,2)}/kg`,calc.abTotal*precos.acidoBorico);
    add("Complex Bor",`${n(calc.borTotal,1)} L`,emTam(calc.borTotal),`R$ ${n(precos.complexBor,2)}/L`,calc.borTotal*precos.complexBor);
    (["tsh","lifegrow","leg"] as Complexante[]).forEach(k=>{
      const v=calc.cxTotal[k]; if(!v||v<0.01) return;
      const pr=k==="tsh"?precos.tsh:k==="lifegrow"?precos.lifeGrow:precos.leg;
      add(CX_LABEL[k],`${n(v,0)} L`,emTam(v),`R$ ${n(pr,2)}/L`,v*pr);
    });
    const totalCompras = compras.reduce((s,c)=>{const v=parseFloat(c.total.replace(/[R$\s.]/g,"").replace(",","."));return s+(isNaN(v)?0:v);},0);

    // Receita por 1.000L (usando 1ª cobertura como referência)
    const cxRec = complexanteV2;
    const cxL   = CX_L_1000[cxRec];

    const css=`*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px 32px;max-width:960px;margin:0 auto}.btn{background:#0891b2;color:#fff;padding:9px 22px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;margin-bottom:20px}.hdr{border-bottom:3px solid #0891b2;padding-bottom:12px;margin-bottom:6px}.hdr-top{display:flex;justify-content:space-between;align-items:flex-start}.hdr h1{color:#0891b2;font-size:18px;font-weight:bold;margin-bottom:2px}.hdr .sub{color:#555;font-size:11px}.badge{background:#0891b2;color:#fff;padding:3px 13px;border-radius:20px;font-size:11px;font-weight:bold}h2{color:#0e7490;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.07em;margin:16px 0 6px;border-bottom:1px solid #a5f3fc;padding-bottom:3px}table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}th,td{padding:6px 8px;text-align:left;border:1px solid #e5e7eb}thead th{background:#0891b2;color:#fff;font-weight:bold}.comp{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#e5e7eb;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:12px}.comp-cell{background:#fff;padding:10px 12px;text-align:center}.comp-cell.header{background:#ecfeff;font-size:10px;font-weight:bold;color:#0e7490;text-transform:uppercase}.comp-cell .val{font-size:15px;font-weight:bold;margin:3px 0}.comp-cell .lbl{font-size:10px;color:#666}.comp-cell.nutrir .val{color:#0891b2}.comp-cell.dif .val{color:${difHa>0?"#dc2626":"#15803d"}}.rec-title{font-size:11px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 5px;padding:5px 8px;background:#f1f5f9;border-radius:4px}.total-box{background:#ecfeff;border:2px solid #a5f3fc;border-radius:8px;padding:14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center}.total-box .big{font-size:20px;font-weight:bold;color:#0891b2}.total-box .sm{font-size:12px;color:#0e7490}.footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;display:flex;justify-content:space-between;font-size:10px;color:#888}tbody tr:nth-child(even) td{background:#f8fffe}.b{font-weight:bold}.g{color:#0891b2;font-weight:bold}.num{text-align:right}@media print{.btn{display:none}body{padding:16px}@page{margin:15mm}}`;

    const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recomendação N180+B</title><style>${css}</style></head><body>
<button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
<div class="hdr"><div class="hdr-top"><div><h1>Recomendação N180+B — Nitrogênio + Boro</h1><div class="sub">${[meta.produtor,meta.fazenda,meta.cultura,`${n(area,0)} ha`,hoje].filter(Boolean).join(" · ")}</div></div><span class="badge">N180+B</span></div></div>
<h2>Comparativo de Custos: Convencional × NUTRIR N180+B</h2>
<div class="comp">
  <div class="comp-cell header">Convencional</div><div class="comp-cell header nutrir">NUTRIR N180+B</div><div class="comp-cell header dif">Diferença</div>
  <div class="comp-cell"><div class="lbl">R$/ha</div><div class="val">${m(convHa)}</div></div>
  <div class="comp-cell nutrir"><div class="lbl">R$/ha</div><div class="val">${m(calc.custoPorHa)}</div></div>
  <div class="comp-cell dif"><div class="lbl">R$/ha</div><div class="val">${difHa>=0?"+":""}${m(difHa)}</div></div>
  <div class="comp-cell"><div class="lbl">Total na área</div><div class="val">${m(convHa*area)}</div></div>
  <div class="comp-cell nutrir"><div class="lbl">Total na área</div><div class="val">${m(calc.custoTotal)}</div></div>
  <div class="comp-cell dif"><div class="lbl">${difHa>=0?"Investimento":"Economia"}</div><div class="val">${m(Math.abs(difHa*area))}</div></div>
  <div class="comp-cell"></div><div class="comp-cell nutrir"></div>
  <div class="comp-cell dif"><div class="lbl">%</div><div class="val">${difPct>=0?"+":""}${n(difPct,1)}%</div></div>
</div>
<h2>Volume Total de Aplicação</h2>
<table><thead><tr><th>Volume N180+B/ha</th><th>Volume total</th><th>Nº bateladas</th><th>Nº aplicações</th><th>Boro/ha</th></tr></thead>
<tbody><tr><td class="b">${n(calc.volCaldaHa,0)} L/ha</td><td class="b">${n(calc.volTotalL,0)} L</td><td>${batCheias}${batParcialVol>0?" + 1 parcial":""}</td><td>${apps.length}</td><td>${n(boro.acidoBoricoKgHa,2)} kg AB + ${n(boro.complexBorLHa,1)} L Bor</td></tr></tbody></table>
<h2>Aplicações por Estágio Fenológico</h2>
<table><thead><tr><th>#</th><th>Estágio</th><th>Tipo Aplicação</th><th>Descrição</th></tr></thead>
<tbody>${apps.map(a=>`<tr><td class="b">${a.idx}</td><td class="b">${a.etapa}</td><td>${a.tipo}</td><td>${a.desc}</td></tr>`).join("")}</tbody></table>
<h2>Lista de Compras (Matérias-primas)</h2>
<table><thead><tr><th>Produto</th><th>Necessário</th><th>Comprar</th><th>R$/un</th><th class="num">Total</th></tr></thead>
<tbody>${compras.map(c=>`<tr><td class="b">${c.produto}</td><td>${c.necessario}</td><td>${c.comprar}</td><td>${c.prUn}</td><td class="num g">${c.total}</td></tr>`).join("")}
<tr style="background:#ecfeff"><td colspan="4" style="font-weight:bold;text-align:right">TOTAL</td><td class="num g" style="font-weight:bold;font-size:13px">${m(totalCompras)}</td></tr></tbody></table>
<h2>Receita de Preparo da Calda (por 1.000 L)</h2>
<div class="rec-title">${possuiMicron?"Coberturas — ":""}1ª Cobertura — ${CX_LABEL[cxRec]} + Boro</div>
<table><thead><tr><th style="width:40px">#</th><th>Ingrediente</th><th>Quantidade</th><th>Instrução</th></tr></thead>
<tbody>
<tr><td class="b">1</td><td>Água</td><td class="b">400 L</td><td>Adicionar água limpa ao tanque misturador</td></tr>
<tr><td class="b">2</td><td>Complex Bor</td><td class="b">${n(borPor1000,1)} L</td><td>Adicionar o complexador de Boro</td></tr>
<tr><td class="b">3</td><td>Ácido Bórico</td><td class="b">${n(abPor1000,1)} kg</td><td>Adicionar e agitar por 5 minutos</td></tr>
<tr><td class="b">4</td><td>${CX_LABEL[cxRec]}</td><td class="b">${cxL} L</td><td>Adicionar o complexador de Nitrogênio</td></tr>
<tr><td class="b">5</td><td>Ureia</td><td class="b">400 kg</td><td>Adicionar ureia e agitar por 10 minutos</td></tr>
<tr><td class="b">6</td><td>Completar com água</td><td class="b">até 1.000 L</td><td>Após dissolução completa</td></tr>
<tr style="background:#ecfeff"><td colspan="2" class="b">Volume da batelada</td><td class="b">${n(vBat,0)} L</td><td>Produção para ${n(area,0)} ha</td></tr>
<tr style="background:#ecfeff"><td colspan="2" class="b">Aplicação</td><td class="b">${n(calc.volCaldaHa/nCoberturas,0)} L/ha</td><td>${FORMAS[formaAplicacao]}</td></tr>
</tbody></table>
<div class="total-box">
  <div><div class="big">${m(calc.custoTotal)}</div><div class="sm">Custo total N180+B · ${n(area,0)} ha</div></div>
  <div style="text-align:right"><div class="big">${m(calc.custoPorHa)}</div><div class="sm">por hectare</div></div>
</div>
<div class="footer"><span>NUTRIR — Programa de Adubação N180+B</span><span>Gerado em ${hoje}</span></div>
</body></html>`;
    const w=window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
  };

  const irParaPedidoFertagro = () => {
    const itens: any[] = [];
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      const v = calc.cxTotal[k];
      if (v && v > 0.01) itens.push({ produto_nome: CX_LABEL[k], quantidade: Math.ceil(v), unidade: "L",
        preco_unitario: k === "tsh" ? precos.tsh : k === "lifegrow" ? precos.lifeGrow : precos.leg });
    });
    if (calc.borTotal > 0) itens.push({ produto_nome: "Complex Bor", quantidade: Math.ceil(calc.borTotal), unidade: "L", preco_unitario: precos.complexBor });
    if (itens.length === 0) { toast({ title: "Nenhum produto Fertagro nesta configuração", variant: "destructive" }); return; }
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_n180b_fertagro",
      titulo: `Fertagro N180+B — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || null, area_ha: meta.areaHa,
      observacoes: `N180+B Fertagro · ${meta.cultura} · ${meta.areaHa} ha`, itens,
    }));
    navigate("/app/rep/pedidos");
  };

  const listaCulturas  = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;
  const fontePrecosMsg = mps.length > 0
    ? `✓ Preços do banco (${mps.length} MPs · ${complexadores.length} complexantes)`
    : "⚠ Cadastre matérias-primas para preços automáticos";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-cyan-600" />N180+B — Nitrogênio + Boro</span> as any}
        description="Ureia complexada + Ácido Bórico · substitui adubação N + complemento de Boro"
        actions={<Button onClick={irParaRecomendacao} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700"><FileText className="w-4 h-4" />Gerar Recomendação</Button>}
      />

      <div className="px-4 space-y-4">

        {/* Identificação */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Identificação</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${mps.length > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{fontePrecosMsg}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Lbl t="Produtor"><Input value={meta.produtor} onChange={e => setMeta({...meta, produtor: e.target.value})} placeholder="Nome do produtor" /></Lbl>
            <Lbl t="Fazenda"><Input value={meta.fazenda} onChange={e => setMeta({...meta, fazenda: e.target.value})} placeholder="Nome da fazenda" /></Lbl>
            <Lbl t="Cultura">
              <Select value={meta.cultura} onValueChange={v => setMeta({...meta, cultura: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{listaCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Área (ha)"><Input type="number" value={meta.areaHa || ""} onFocus={e => e.target.select()} onChange={e => setMeta({...meta, areaHa: parseFloat(e.target.value) || 0})} /></Lbl>
          </div>
        </CardContent></Card>

        {/* Configuração N180 */}
        <Card className="border-cyan-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-cyan-600" />
            <p className="text-sm font-semibold text-cyan-700">Configuração N180+B</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Lbl t="Adubo">
              <Select value={adubo} onValueChange={v => setAdubo(v as AduboKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.entries(ADUBOS) as [AduboKey, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Dose (kg/ha)"><Input type="number" step="10" value={doseHa || ""} onFocus={e => e.target.select()} onChange={e => setDoseHa(parseFloat(e.target.value) || 0)} /></Lbl>
            <Lbl t="Pontos de N (auto)">
              <div className="h-10 flex items-center px-3 bg-cyan-50 border border-cyan-200 rounded-md">
                <span className="font-bold text-cyan-700 text-sm">{num(calc.pontosN, 1)} kg N/ha</span>
              </div>
            </Lbl>
            <Lbl t="Forma de Aplicação">
              <Select value={formaAplicacao} onValueChange={v => setFormaAplicacao(v as FormaAplicacao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.entries(FORMAS) as [FormaAplicacao, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
          </div>

          {/* Boro */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
            <p className="text-xs font-semibold text-blue-700 mb-2">Boro (B)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Lbl t="Boro (gr/ha)">
                <div className="flex items-center">
                  <Input type="number" step="50" value={boroGrHa || ""} onFocus={e => e.target.select()} onChange={e => setBoroGrHa(parseFloat(e.target.value) || 0)} />
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">gr/ha</span>
                </div>
              </Lbl>
              <Lbl t="Ácido Bórico (auto)">
                <div className="h-10 flex items-center px-3 bg-white border border-blue-200 rounded-md">
                  <span className="font-bold text-blue-700 text-sm">{num(boro.acidoBoricoKgHa, 2)} kg/ha</span>
                </div>
              </Lbl>
              <Lbl t="Complex Bor (auto)">
                <div className="h-10 flex items-center px-3 bg-white border border-blue-200 rounded-md">
                  <span className="font-bold text-blue-700 text-sm">{num(boro.complexBorLHa, 2)} L/ha</span>
                </div>
              </Lbl>
            </div>
          </div>

          {/* N° coberturas + complexante */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Lbl t="N° de Coberturas">
              <Select value={String(nCoberturas)} onValueChange={v => setNCoberturas(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 cobertura (V2)</SelectItem>
                  <SelectItem value="2">2 coberturas (V2, V4)</SelectItem>
                  <SelectItem value="3">3 coberturas (V2, V4, V6)</SelectItem>
                  <SelectItem value="4">4 coberturas (V2–V8)</SelectItem>
                  <SelectItem value="5">5 coberturas (V2–R1)</SelectItem>
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
              <div className="h-10 flex items-center px-3 bg-cyan-50 border border-cyan-200 rounded-md">
                <span className="font-bold text-cyan-700 text-sm">{num(calc.coberturaVolHa / nCoberturas, 0)} L/ha</span>
              </div>
            </Lbl>
          </div>

          {/* Micron */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg mb-3 cursor-pointer" onClick={() => setPossuiMicron(p => !p)}>
            <input type="checkbox" readOnly checked={possuiMicron} className="w-4 h-4 accent-primary pointer-events-none" />
            <span className="text-sm font-medium">Possui Micron (aplicação adicional no sulco de plantio)</span>
          </div>
          {possuiMicron && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Lbl t="Vazão Micron (L/ha)"><Input type="number" step="5" value={vazaoMicron || ""} onFocus={e => e.target.select()} onChange={e => setVazaoMicron(parseFloat(e.target.value) || 0)} /></Lbl>
              <Lbl t="Dose no Sulco (auto)">
                <div className="h-10 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="font-bold text-blue-700 text-sm">{num(calc.sulcoVolHa, 0)} L/ha</span>
                </div>
              </Lbl>
              <Lbl t="Complexante — Sulco">
                <Select value={complexanteSulco} onValueChange={v => setComplexanteSulco(v as "tsh" | "lifegrow")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="tsh">TSH</SelectItem><SelectItem value="lifegrow">Life Grow</SelectItem></SelectContent>
                </Select>
              </Lbl>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2 leading-relaxed">
            <span className="font-semibold">Limites de referência: </span>
            V2 50–120 L/ha · V4 50–100 L/ha · V6 30–80 L/ha · V8 máx 60 L/ha · R1 máx 40 L/ha
            {!allowLeg && <span className="ml-2 text-amber-600 font-semibold">· Forma líquida: LEG não permitido</span>}
          </div>
        </CardContent></Card>

        {/* Resultado por hectare */}
        <Card className="border-cyan-200"><CardContent className="pt-4">
          <p className="text-sm font-semibold text-cyan-700 mb-3">Resultado por Hectare</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-cyan-50 rounded-lg text-xs mb-3">
            <div><p className="text-muted-foreground">Ureia N180/ha</p><p className="font-bold">{num(calc.ureiaKgHa, 1)} kg</p></div>
            <div><p className="text-muted-foreground">Ácido Bórico/ha</p><p className="font-bold">{num(boro.acidoBoricoKgHa, 2)} kg</p></div>
            <div><p className="text-muted-foreground">Complex Bor/ha</p><p className="font-bold">{num(boro.complexBorLHa, 2)} L</p></div>
            <div><p className="text-muted-foreground">Custo N180+B/ha</p><p className="font-bold text-cyan-700">{moeda(calc.custoPorHa)}</p></div>
          </div>

          <div className="text-xs space-y-0.5 px-1 mb-3">
            {(["tsh", "lifegrow", "leg"] as Complexante[]).map(k => {
              const v = calc.totalCx[k];
              if (!v || v < 0.01) return null;
              return <div key={k}>{CX_LABEL[k]}/ha: <span className="font-semibold">{num(v, 2)} L</span></div>;
            })}
          </div>

          {/* Fórmula por 1000L */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs">
            <p className="font-semibold mb-2">Fórmula por 1.000 L de N180+B:</p>
            <div className="space-y-2">
              {possuiMicron && (
                <div>
                  <p className="font-medium text-muted-foreground">Sulco — {CX_LABEL[complexanteSulco]}</p>
                  <p>400 L água + {num(borPor1000, 1)} L Complex Bor + {num(abPor1000, 1)} kg Ácido Bórico + 400 kg ureia + {CX_L_1000[complexanteSulco as Complexante]} L {CX_LABEL[complexanteSulco as Complexante]} + água até 1.000 L</p>
                </div>
              )}
              <div>
                <p className="font-medium text-muted-foreground">{possuiMicron ? "V2 — 1ª cobertura" : "1ª cobertura"} — {CX_LABEL[complexanteV2]}</p>
                <p>400 L água + {num(borPor1000, 1)} L Complex Bor + {num(abPor1000, 1)} kg Ácido Bórico + 400 kg ureia + {CX_L_1000[complexanteV2]} L {CX_LABEL[complexanteV2]} + água até 1.000 L</p>
              </div>
              {calc.coberturaApps.length > 1 && !isLiquidoForma(formaAplicacao) && (
                <div>
                  <p className="font-medium text-muted-foreground">V4 em diante — LEG (obrigatório)</p>
                  <p>400 L água + {num(borPor1000, 1)} L Complex Bor + {num(abPor1000, 1)} kg Ácido Bórico + 400 kg ureia + 25 L LEG + água até 1.000 L</p>
                </div>
              )}
            </div>
          </div>
        </CardContent></Card>

        {/* Distribuição */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Distribuição de Aplicações</p>
          <div className="space-y-1">
            {possuiMicron && (
              <div className="flex items-center justify-between py-2.5 border-b">
                <div>
                  <p className="text-sm font-medium">Sulco de Plantio</p>
                  <p className="text-xs text-muted-foreground">{CX_LABEL[complexanteSulco as Complexante]} · {num(calc.sulcoVolHa, 0)} L/ha</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold">{num(calc.sulcoVolHa * meta.areaHa, 0)} L total</p>
                  <p className="text-muted-foreground">{num(calc.sulcoVolHa * 0.4, 1)} kg ureia/ha</p>
                </div>
              </div>
            )}
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
                      <span className="ml-1 opacity-60">(lim: {app.min > 0 ? `${app.min}–` : "máx "}{app.max} L/ha)</span>
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold">{num(app.vol * meta.areaHa, 0)} L total</p>
                    <p className="text-muted-foreground">{num(boro.acidoBoricoKgHa * (app.vol / calc.volCaldaHa) * meta.areaHa, 1)} kg AB</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>

        {/* Preços */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Preços de Insumos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <PrecoInput label="Ureia (R$/t)"         value={precos.ureia}       step="100"  onChange={v => setPrecos({...precos, ureia: v})} />
            <PrecoInput label="TSH (R$/L)"            value={precos.tsh}         step="0.50" onChange={v => setPrecos({...precos, tsh: v})} />
            <PrecoInput label="Life Grow (R$/L)"      value={precos.lifeGrow}    step="0.50" onChange={v => setPrecos({...precos, lifeGrow: v})} />
            <PrecoInput label="LEG (R$/L)"            value={precos.leg}         step="0.50" onChange={v => setPrecos({...precos, leg: v})} />
            <PrecoInput label="Ácido Bórico (R$/kg)"  value={precos.acidoBorico} step="0.50" onChange={v => setPrecos({...precos, acidoBorico: v})} />
            <PrecoInput label="Complex Bor (R$/L)"    value={precos.complexBor}  step="1"    onChange={v => setPrecos({...precos, complexBor: v})} />
          </div>
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)"><Input type="number" value={volBatelada || ""} onFocus={e => e.target.select()} onChange={e => setVolBatelada(parseFloat(e.target.value) || 1000)} /></Lbl>
          </div>
          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
            <p className="text-xs font-bold text-cyan-700 mb-2">N180+B — {num(calc.volTotalL, 0)} L totais ({num(meta.areaHa, 0)} ha)</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcialVol > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcialVol, 0)} L</span>}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {num(vBat * 0.4, 0)} kg ureia + {num(borPor1000 * vBat / 1000, 1)} L Complex Bor + {num(abPor1000 * vBat / 1000, 1)} kg Ácido Bórico</p>
              <p>Completar com água até {num(vBat, 0)} L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Insumos e Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-xs text-muted-foreground">Ureia total</p><p className="font-bold">{num(calc.ureiaTotal / 1000, 3)} t</p></div>
            <div><p className="text-xs text-muted-foreground">Ácido Bórico total</p><p className="font-bold">{num(calc.abTotal, 1)} kg</p></div>
            <div><p className="text-xs text-muted-foreground">Complex Bor total</p><p className="font-bold">{num(calc.borTotal, 1)} L</p></div>
            {(["tsh", "lifegrow", "leg"] as Complexante[]).map(k => {
              const v = calc.cxTotal[k]; if (!v || v < 0.01) return null;
              return <div key={k}><p className="text-xs text-muted-foreground">{CX_LABEL[k]} total</p><p className="font-bold">{num(v, 0)} L</p></div>;
            })}
            <div><p className="text-xs text-muted-foreground">Custo N180+B/ha</p><p className="font-bold text-cyan-700">{moeda(calc.custoPorHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p><p className="font-bold text-primary">{moeda(calc.custoTotal)}</p></div>
          </div>
          <Button className="w-full mt-2 gap-2 bg-cyan-600 hover:bg-cyan-700" onClick={irParaRecomendacao}>
            <FileText className="h-4 w-4" />Gerar Recomendação
          </Button>
          <Button variant="outline" className="w-full mt-2 gap-2" onClick={irParaPedidoFertagro}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido Fertagro (TSH / Life Grow / LEG / Complex Bor)
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
