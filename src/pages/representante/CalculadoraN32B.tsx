import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import logo1 from "@/assets/1.png";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { Leaf, ShoppingCart, FileText } from "lucide-react";

// ─── N32+B — Foliar Nitrogenado + Boro ────────────────────────────────────
// Formula N:  n32 × 32% = kg.N → +15% eficiência → /45% = kg Ureia
//             ureia × 18,75% = L LEG
// Formula B:  boro_gr/1000 / 17% = kg Ácido Bórico
//             AB × 65% = L Complex Bor
// Volume:     ureia × 2,5 + AB × 2,8
// Por 1.000 L: componentes escalados ao volume total/ha

interface Cultura { id: string; nome: string; }

const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];
const FORMAS = ["Pulverizador", "Drone", "Avião"];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num   = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

// Arredonda para múltiplos de 25
function roundTo25(v: number) { return Math.round(v / 25) * 25; }

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{t}</label>
      {children}
    </div>
  );
}

export default function CalculadoraN32B() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [n32Lha, setN32Lha]     = useState(5);
  const [boroGrHa, setBoroGrHa] = useState(300);
  const [formaAplicacao, setFormaAplicacao] = useState("Pulverizador");
  const [volBatelada, setVolBatelada] = useState(6000);

  // Preços
  const [precoN32, setPrecoN32]       = useState(8.0);
  const [precoUreia, setPrecoUreia]   = useState(4000);
  const [precoLeg, setPrecoLeg]       = useState(22.0);
  const [precoAB, setPrecoAB]         = useState(6.5);    // R$/kg Ácido Bórico
  const [precoBor, setPrecoBor]       = useState(32.0);   // R$/L Complex Bor

  const calc = useMemo(() => {
    // Nitrogênio (N32 → N → Ureia → LEG)
    const nKgHa      = n32Lha * 0.32;                          // kg N/ha vindo do N32
    const nAjustado  = nKgHa * 1.15;                           // +15% eficiência
    const ureiaKgHa  = nAjustado / 0.45;                       // kg Ureia/ha (45% N)
    const legLHa     = ureiaKgHa * 0.1875;                     // 18,75% LEG sobre Ureia

    // Boro
    const abKgHa     = (boroGrHa / 1000) / 0.17;              // kg Ácido Bórico/ha
    const borLHa     = abKgHa * 0.65;                          // L Complex Bor/ha

    // Volumes de diluição
    const volUreia   = ureiaKgHa * 2.5;                        // L para diluir ureia
    const volBorico  = abKgHa    * 2.8;                        // L para diluir AB
    const volTotalHa = volUreia + volBorico;                    // L/ha total de aplicação

    // Fórmula por 1.000 L (escala proporcional, arredondado para múltiplos de 25)
    const fator      = volTotalHa > 0 ? 1000 / volTotalHa : 0;
    const urei1000   = roundTo25(ureiaKgHa * fator);           // kg Ureia por 1.000 L
    const ab1000     = roundTo25(abKgHa    * fator);           // kg AB por 1.000 L
    const bor1000    = Math.round(borLHa   * fator);           // L Bor por 1.000 L
    const leg1000    = Math.round(legLHa   * fator);           // L LEG por 1.000 L

    // Custos
    const custoUreiaHa = ureiaKgHa * precoUreia / 1000;
    const custoLegHa   = legLHa    * precoLeg;
    const custoABHa    = abKgHa    * precoAB;
    const custoBorHa   = borLHa    * precoBor;
    const custoTpdHa   = custoUreiaHa + custoLegHa + custoABHa + custoBorHa;
    // Custo comparativo: N32 convencional + boro convencional
    const custoN32Ha   = n32Lha  * precoN32;
    const custoBoroConv = abKgHa * precoAB; // AB sozinho sem complexação (referência)
    const custoConvHa  = custoN32Ha + custoBoroConv;
    const economiaHa   = custoConvHa - custoTpdHa;
    const economiaPct  = custoConvHa > 0 ? (economiaHa / custoConvHa) * 100 : 0;

    const area       = meta.areaHa || 0;
    const volTotal   = volTotalHa  * area;
    const ureiaTotal = ureiaKgHa   * area;
    const legTotal   = legLHa      * area;
    const abTotal    = abKgHa      * area;
    const borTotal   = borLHa      * area;
    const custoTotal = custoTpdHa  * area;

    return {
      nKgHa, ureiaKgHa, legLHa, abKgHa, borLHa, volTotalHa, volUreia, volBorico,
      urei1000, ab1000, bor1000, leg1000,
      custoTpdHa, custoConvHa, economiaHa, economiaPct,
      volTotal, ureiaTotal, legTotal, abTotal, borTotal, custoTotal,
    };
  }, [n32Lha, boroGrHa, precoN32, precoUreia, precoLeg, precoAB, precoBor, meta.areaHa]);

  const vBat       = Math.max(volBatelada, 100);
  const batCheias  = Math.floor(calc.volTotal / vBat);
  const batParcial = Math.round(calc.volTotal % vBat);
  // Insumos por batelada (proporção × vBat/1000)
  const urei_bat   = roundTo25(calc.urei1000 * vBat / 1000);
  const ab_bat     = roundTo25(calc.ab1000   * vBat / 1000);
  const bor_bat    = Math.round(calc.bor1000 * vBat / 1000);
  const leg_bat    = Math.round(calc.leg1000 * vBat / 1000);

  const listaCulturas = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;

  const irParaRecomendacao = () => {
    const area = meta.areaHa || 1;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const n2 = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    const moedaP = (v: number) => "R$&nbsp;" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const logoUrl   = window.location.origin + logo1;
    const diffRha   = calc.custoConvHa - calc.custoTpdHa;
    const diffTotal = diffRha * area;
    const diffPct   = calc.custoConvHa > 0 ? (diffRha / calc.custoConvHa) * 100 : 0;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recomendação N32+B TPD</title>
<style>
@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
.hdr{background:linear-gradient(135deg,#059669,#065f46);color:#fff;padding:18px 22px;border-radius:8px;margin-bottom:14px}
.hdr h1{font-size:20px;font-weight:700}.hdr .sub{font-size:11px;opacity:.88;margin-top:4px}
.hdr .badge{display:inline-block;background:rgba(255,255,255,.25);border-radius:99px;padding:3px 10px;font-size:10px;font-weight:600;margin-top:8px}
.sec{margin-bottom:14px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#065f46;border-bottom:2px solid #34d399;padding-bottom:4px;margin-bottom:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #d1d5db;border-radius:6px;overflow:hidden}
.g3c{padding:10px 12px;text-align:center}.g3c+.g3c{border-left:1px solid #d1d5db}
.g3l{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.g3v{font-size:16px;font-weight:700}.g3s{font-size:9px;color:#6b7280;margin-top:2px}
.red{color:#ef4444}.em{color:#059669}.green{color:#16a34a}
table{width:100%;border-collapse:collapse}
th{background:#ecfdf5;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#065f46;padding:6px 8px;border-bottom:1px solid #6ee7b7;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:10.5px;vertical-align:top}
tr:last-child td{border-bottom:none}
.step{display:flex;gap:10px;align-items:flex-start;margin-bottom:7px}
.snum{width:22px;height:22px;border-radius:50%;background:#059669;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sprod{font-weight:600}.sqty{color:#059669;font-weight:700;font-size:12px}.sinst{font-size:10px;color:#6b7280;margin-top:1px}
.footer{margin-top:18px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;color:#9ca3af;font-size:9px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>

<div class="hdr">
  <img src="${logoUrl}" style="height:48px;margin-bottom:10px;display:block" alt="NUTRIR" />
  <h1>N32+B TPD &mdash; Foliar Nitrogenado + Boro</h1>
  <div class="sub">${[meta.produtor && `Produtor: ${meta.produtor}`, meta.fazenda && `Fazenda: ${meta.fazenda}`, `Cultura: ${meta.cultura}`, `&Aacute;rea: ${n2(area, 0)} ha`].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>
  <div class="badge">N32+B TPD &nbsp;&middot;&nbsp; ${formaAplicacao} &nbsp;&middot;&nbsp; ${n2(boroGrHa, 0)} g B/ha &nbsp;&middot;&nbsp; ${n2(calc.volTotalHa, 0)} L/ha</div>
</div>

<div class="sec">
  <div class="sec-title">Comparativo de Custos</div>
  <div class="grid3">
    <div class="g3c">
      <div class="g3l">Convencional (N32 + B)</div>
      <div class="g3v red">${moedaP(calc.custoConvHa)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">N32 ${n2(n32Lha, 1)} L + &Aacute;c. B&oacute;rico</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(calc.custoConvHa * area)}</div>
    </div>
    <div class="g3c" style="background:#ecfdf5">
      <div class="g3l">N32+B TPD NUTRIR</div>
      <div class="g3v em">${moedaP(calc.custoTpdHa)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(calc.volTotalHa, 0)} L/ha (N + B)</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(calc.custoTpdHa * area)}</div>
    </div>
    <div class="g3c">
      <div class="g3l">Diferen&ccedil;a</div>
      <div class="g3v ${diffRha > 0 ? "green" : "red"}">${diffRha > 0 ? "&#9660; " : "&#9650; "}${moedaP(Math.abs(diffRha))}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(Math.abs(diffPct), 1)}% ${diffRha > 0 ? "economia" : "adicional"}</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(Math.abs(diffTotal))}</div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="sec-title">Volume Total de Aplica&ccedil;&atilde;o</div>
  <table><thead><tr><th>Vol. Nitrog&ecirc;nio/ha</th><th>Vol. Boro/ha</th><th>Total/ha</th><th>Total na &Aacute;rea</th><th>N&deg; Bateladas</th></tr></thead>
  <tbody><tr>
    <td>${n2(calc.volUreia, 0)} L (ureia)</td>
    <td>${n2(calc.volBorico, 0)} L (&aacute;c. b&oacute;rico)</td>
    <td>${n2(calc.volTotalHa, 0)} L/ha</td>
    <td>${n2(calc.volTotal, 0)} L</td>
    <td>${batCheias} bat.${batParcial > 0 ? ` + 1 parcial` : ""} (${n2(volBatelada, 0)} L)</td>
  </tr></tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Aplica&ccedil;&otilde;es por Est&aacute;gio Fenol&oacute;gico</div>
  <table><thead><tr><th>#</th><th>Est&aacute;gio / Fase</th><th>Tipo de Aplica&ccedil;&atilde;o</th><th>Volume</th></tr></thead>
  <tbody><tr>
    <td>1</td>
    <td>Foliar &mdash; ${meta.cultura}</td>
    <td>N32+B TPD (Ureia + Boro + LEG) &mdash; ${formaAplicacao}</td>
    <td>${n2(calc.volTotalHa, 0)} L/ha &nbsp;&middot;&nbsp; Total: ${n2(calc.volTotal, 0)} L</td>
  </tr></tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Lista de Compras</div>
  <table><thead><tr><th>Produto</th><th>Necess&aacute;rio</th><th>R$/un</th><th>Total</th></tr></thead>
  <tbody>
    <tr>
      <td><strong>Ureia Branca</strong></td>
      <td>${n2(calc.ureiaTotal, 1)} kg</td>
      <td>${moedaP(precoUreia / 1000)}/kg</td>
      <td>${moedaP(calc.ureiaTotal * precoUreia / 1000)}</td>
    </tr>
    <tr>
      <td><strong>LEG (complexante)</strong></td>
      <td>${n2(calc.legTotal, 1)} L</td>
      <td>${moedaP(precoLeg)}/L</td>
      <td>${moedaP(calc.legTotal * precoLeg)}</td>
    </tr>
    <tr>
      <td><strong>&Aacute;cido B&oacute;rico</strong></td>
      <td>${n2(calc.abTotal, 2)} kg</td>
      <td>${moedaP(precoAB)}/kg</td>
      <td>${moedaP(calc.abTotal * precoAB)}</td>
    </tr>
    <tr>
      <td><strong>Complex Bor</strong></td>
      <td>${n2(calc.borTotal, 1)} L</td>
      <td>${moedaP(precoBor)}/L</td>
      <td>${moedaP(calc.borTotal * precoBor)}</td>
    </tr>
    <tr style="background:#ecfdf5;font-weight:700">
      <td colspan="3" style="text-align:right;padding-right:12px">Total Geral</td>
      <td>${moedaP(calc.custoTotal)}</td>
    </tr>
  </tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Receita de Preparo da Calda (por 1.000 L)</div>
  <div style="padding:4px 0">
    <div class="step"><div class="snum">1</div><div><div class="sprod">Iniciar com &Aacute;gua</div><div class="sqty">~300 L</div><div class="sinst">Encher o incorporador/tanque com &aacute;gua limpa</div></div></div>
    <div class="step"><div class="snum">2</div><div><div class="sprod">Complex Bor</div><div class="sqty">${calc.bor1000} L</div><div class="sinst">Adicionar e agitar 3 minutos</div></div></div>
    <div class="step"><div class="snum">3</div><div><div class="sprod">&Aacute;cido B&oacute;rico</div><div class="sqty">${calc.ab1000} kg</div><div class="sinst">Adicionar aos poucos e agitar 10 minutos at&eacute; dissolver</div></div></div>
    <div class="step"><div class="snum">4</div><div><div class="sprod">LEG (complexante)</div><div class="sqty">${calc.leg1000} L</div><div class="sinst">Adicionar e agitar 5 minutos</div></div></div>
    <div class="step"><div class="snum">5</div><div><div class="sprod">Ureia Branca</div><div class="sqty">${calc.urei1000} kg</div><div class="sinst">Adicionar aos poucos com agita&ccedil;&atilde;o constante</div></div></div>
    <div class="step"><div class="snum">6</div><div><div class="sprod">Completar com &Aacute;gua</div><div class="sqty">at&eacute; 1.000 L</div><div class="sinst">Misturar por 30 minutos antes de aplicar</div></div></div>
  </div>
</div>

${diffRha > 0 ? `
<div style="margin:16px 0 14px;border:2px solid #059669;border-radius:10px;overflow:hidden">
  <div style="background:#059669;color:#fff;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">
    &#9733; Destaque de Economia &mdash; N32+B TPD vs Convencional
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#fff;align-items:center">
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Convencional / ha</div>
      <div style="font-size:22px;font-weight:700;color:#ef4444">${moedaP(calc.custoConvHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moedaP(calc.custoConvHa * area)}</div>
    </div>
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">N32+B TPD NUTRIR / ha</div>
      <div style="font-size:22px;font-weight:700;color:#059669">${moedaP(calc.custoTpdHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moedaP(calc.custoTpdHa * area)}</div>
    </div>
    <div style="text-align:center;padding:14px 12px;background:#ecfdf5">
      <div style="font-size:9px;color:#065f46;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;font-weight:600">Economia com NUTRIR</div>
      <div style="font-size:15px;font-weight:700;color:#16a34a;margin-bottom:2px">&#9660; ${moedaP(Math.abs(diffRha))}/ha &nbsp;(${n2(Math.abs(diffPct),1)}%)</div>
      <div style="font-size:26px;font-weight:800;color:#065f46;line-height:1.1">${moedaP(Math.abs(diffTotal))}</div>
      <div style="font-size:10px;color:#059669;margin-top:3px">em ${n2(area,0)} ha</div>
    </div>
  </div>
</div>` : ""}
<div class="footer">
  <span>NUTRIR &mdash; Programa de Aduba&ccedil;&atilde;o Foliar &middot; Gerado em ${hoje}</span>
  <span>N32+B TPD Fertagro &middot; ${meta.cultura} &middot; ${n2(area, 0)} ha</span>
</div>
<script>window.print();</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const irParaPedido = () => {
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_n32b",
      titulo: `N32+B TPD — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || null,
      area_ha: meta.areaHa,
      observacoes: `N32+Boro Foliar TPD · ${meta.cultura} · ${meta.areaHa} ha`,
      itens: [
        { produto_nome: "Ureia",       quantidade: Math.ceil(calc.ureiaTotal), unidade: "kg", preco_unitario: precoUreia / 1000 },
        { produto_nome: "LEG",         quantidade: Math.ceil(calc.legTotal),   unidade: "L",  preco_unitario: precoLeg },
        { produto_nome: "Complex Bor", quantidade: Math.ceil(calc.borTotal),   unidade: "L",  preco_unitario: precoBor },
        { produto_nome: "Ácido Bórico",quantidade: Math.ceil(calc.abTotal),    unidade: "kg", preco_unitario: precoAB },
      ],
    }));
    navigate("/app/rep/pedidos");
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><Leaf className="w-5 h-5 text-emerald-600" />N32+B — Foliar N + Boro</span> as any}
        description="Substituição foliar de N32 + complemento de Boro · pulverizador, drone ou avião"
        actions={
          <div className="flex gap-2">
            <Button onClick={irParaRecomendacao} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><FileText className="w-4 h-4" />Recomendação</Button>
            <Button onClick={irParaPedido} variant="outline" className="gap-1.5"><ShoppingCart className="w-4 h-4" />Pedido</Button>
          </div>
        }
      />

      <div className="px-4 space-y-4">

        {/* Identificação */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Identificação</p>
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

        {/* Entradas */}
        <Card className="border-emerald-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">Entradas — N32 + Boro</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Lbl t="Dose N32 (L/ha)">
              <Input type="number" step="0.5" value={n32Lha || ""} onFocus={e => e.target.select()} onChange={e => setN32Lha(parseFloat(e.target.value) || 0)} />
            </Lbl>
            <Lbl t="Boro (gr/ha)">
              <Input type="number" step="50" value={boroGrHa || ""} onFocus={e => e.target.select()} onChange={e => setBoroGrHa(parseFloat(e.target.value) || 0)} />
            </Lbl>
            <Lbl t="Forma de Aplicação">
              <Select value={formaAplicacao} onValueChange={setFormaAplicacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Vol. de aplicação (auto)">
              <div className="h-10 flex items-center px-3 bg-emerald-50 border border-emerald-200 rounded-md">
                <span className="font-bold text-emerald-700 text-sm">{num(calc.volTotalHa, 1)} L/ha</span>
              </div>
            </Lbl>
          </div>

          {/* Resultado calculado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-emerald-50 rounded-lg text-xs mb-3">
            <div><p className="text-muted-foreground">Ureia/ha</p><p className="font-bold">{num(calc.ureiaKgHa, 2)} kg</p></div>
            <div><p className="text-muted-foreground">LEG/ha</p><p className="font-bold">{num(calc.legLHa, 2)} L</p></div>
            <div><p className="text-muted-foreground">Ácido Bórico/ha</p><p className="font-bold">{num(calc.abKgHa, 2)} kg</p></div>
            <div><p className="text-muted-foreground">Complex Bor/ha</p><p className="font-bold">{num(calc.borLHa, 2)} L</p></div>
          </div>

          {/* Fórmula por 1000 L */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs">
            <p className="font-semibold mb-1">Fórmula por 1.000 L de N32+B TPD <span className="text-muted-foreground font-normal">(aplicar {num(calc.volTotalHa, 1)} L/ha)</span>:</p>
            <div className="space-y-0.5">
              <p>• Água para dissolução inicial</p>
              <p>• {calc.ab1000} kg Ácido Bórico <span className="text-muted-foreground">(arredondado múltiplo de 25)</span></p>
              <p>• {calc.bor1000} L Complex Bor</p>
              <p>• Agitar 10 minutos</p>
              <p>• {calc.urei1000} kg Ureia <span className="text-muted-foreground">(arredondado múltiplo de 25)</span></p>
              <p>• {calc.leg1000} L LEG</p>
              <p>• Completar com água até 1.000 L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Preços */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Preços</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "N32 cliente (R$/L)",      val: precoN32,   set: setPrecoN32,   step: "0.5" },
              { label: "Ureia (R$/t)",             val: precoUreia, set: setPrecoUreia, step: "100" },
              { label: "LEG (R$/L)",               val: precoLeg,   set: setPrecoLeg,   step: "0.5" },
              { label: "Ácido Bórico (R$/kg)",     val: precoAB,    set: setPrecoAB,    step: "0.5" },
              { label: "Complex Bor (R$/L)",       val: precoBor,   set: setPrecoBor,   step: "1"   },
            ].map(({ label, val, set, step }) => (
              <Lbl key={label} t={label}>
                <div className="flex items-center">
                  <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
                  <Input type="number" step={step} value={val || ""} onFocus={e => e.target.select()} onChange={e => set(parseFloat(e.target.value) || 0)} className="rounded-l-none" />
                </div>
              </Lbl>
            ))}
          </div>
        </CardContent></Card>

        {/* Comparativo */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Comparativo de Custo</p>
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Convencional (N32 + B)</p>
              <p className="text-lg font-bold text-red-500">{moeda(calc.custoConvHa)}<span className="text-xs font-normal">/ha</span></p>
            </div>
            <div className="text-center border-x">
              <p className="text-xs text-muted-foreground mb-1">N32+B TPD (Fertagro)</p>
              <p className="text-lg font-bold text-emerald-600">{moeda(calc.custoTpdHa)}<span className="text-xs font-normal">/ha</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Economia/ha</p>
              <p className={`text-lg font-bold ${calc.economiaHa > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                {calc.economiaHa > 0 ? "▼ " : ""}{moeda(Math.abs(calc.economiaHa))}
              </p>
              <p className="text-xs text-muted-foreground">{num(Math.abs(calc.economiaPct), 1)}%</p>
            </div>
          </div>
          {calc.economiaHa > 0 && meta.areaHa > 0 && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-xs text-green-700 mb-0.5">Economia total para <strong>{num(meta.areaHa, 0)} ha</strong></p>
              <p className="text-xl font-bold text-green-700">{moeda(calc.economiaHa * meta.areaHa)}</p>
            </div>
          )}
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)"><Input type="number" value={volBatelada || ""} onFocus={e => e.target.select()} onChange={e => setVolBatelada(parseFloat(e.target.value) || 1000)} /></Lbl>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs font-bold text-emerald-700 mb-2">N32+B — {num(calc.volTotal, 0)} L totais ({num(meta.areaHa, 0)} ha)</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcial > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcial, 0)} L</span>}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {ab_bat} kg Ácido Bórico + {bor_bat} L Complex Bor + {urei_bat} kg Ureia + {leg_bat} L LEG</p>
              <p>Completar com água até {num(vBat, 0)} L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Insumos e Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-xs text-muted-foreground">Ureia total</p><p className="font-bold">{num(calc.ureiaTotal / 1000, 3)} t</p></div>
            <div><p className="text-xs text-muted-foreground">LEG total</p><p className="font-bold">{num(calc.legTotal, 0)} L</p></div>
            <div><p className="text-xs text-muted-foreground">Ácido Bórico total</p><p className="font-bold">{num(calc.abTotal, 1)} kg</p></div>
            <div><p className="text-xs text-muted-foreground">Complex Bor total</p><p className="font-bold">{num(calc.borTotal, 1)} L</p></div>
            <div><p className="text-xs text-muted-foreground">Custo TPD/ha</p><p className="font-bold text-emerald-700">{moeda(calc.custoTpdHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p><p className="font-bold text-primary">{moeda(calc.custoTotal)}</p></div>
          </div>
          <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={irParaRecomendacao}>
            <FileText className="h-4 w-4" />Gerar Recomendação PDF
          </Button>
          <Button variant="outline" className="w-full gap-2 mt-2" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido Fertagro
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
