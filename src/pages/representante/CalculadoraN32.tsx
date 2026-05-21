import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { Leaf, ShoppingCart, FileText } from "lucide-react";

// ─── N32 — Adubação Foliar Nitrogenada ────────────────────────────────────
// Formula: vol_ha = (n32_L × 0,32) / 0,16
// Por 1.000 L: 400 kg Ureia + 75 L LEG
// Aplicação: apenas pulverizador, drone ou avião

interface Cultura { id: string; nome: string; }

const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];
const FORMAS = ["Pulverizador", "Drone", "Avião"];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num   = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

// N32 → vol calda TPD
// 5 L N32 × 32% = 1,6 kg N / 16% = 10 L/ha
const N32_N_PCT   = 0.32;  // % N no N32
const CALDA_N_PCT = 0.16;  // concentração de N na calda TPD
// Por 1.000 L: ureia 400 kg (40%), LEG 75 L (7,5%)
const UREIA_POR1000 = 400;  // kg/1000L
const LEG_POR1000   = 75;   // L/1000L

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{t}</label>
      {children}
    </div>
  );
}

export default function CalculadoraN32() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [n32Lha, setN32Lha] = useState(5);
  const [formaAplicacao, setFormaAplicacao] = useState("Pulverizador");
  const [volBatelada, setVolBatelada] = useState(6000);

  // Preços
  const [precoN32, setPrecoN32] = useState(8.0);     // R$/L produto N32 do cliente
  const [precoUreia, setPrecoUreia] = useState(4000); // R$/t
  const [precoLeg, setPrecoLeg] = useState(22.0);    // R$/L

  const calc = useMemo(() => {
    const nKgHa       = n32Lha * N32_N_PCT;                       // kg N/ha
    const volHa       = nKgHa / CALDA_N_PCT;                      // L/ha de calda TPD
    const ureiaKgHa   = volHa * (UREIA_POR1000 / 1000);           // = 400 kg/1000L
    const legLHa      = volHa * (LEG_POR1000 / 1000);             // = 75 L/1000L

    const custoUreiaHa = ureiaKgHa * precoUreia / 1000;
    const custoLegHa   = legLHa    * precoLeg;
    const custoTpdHa   = custoUreiaHa + custoLegHa;
    const custoN32Ha   = n32Lha * precoN32;
    const economiaHa   = custoN32Ha - custoTpdHa;
    const economiaPct  = custoN32Ha > 0 ? (economiaHa / custoN32Ha) * 100 : 0;

    const area       = meta.areaHa || 0;
    const volTotal   = volHa * area;
    const ureiaTotal = ureiaKgHa * area;
    const legTotal   = legLHa   * area;
    const custoTotal = custoTpdHa * area;

    return { nKgHa, volHa, ureiaKgHa, legLHa, custoTpdHa, custoN32Ha, economiaHa, economiaPct, volTotal, ureiaTotal, legTotal, custoTotal };
  }, [n32Lha, precoN32, precoUreia, precoLeg, meta.areaHa]);

  const vBat      = Math.max(volBatelada, 100);
  const batCheias = Math.floor(calc.volTotal / vBat);
  const batParcial = Math.round(calc.volTotal % vBat);

  const listaCulturas = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;

  const irParaRecomendacao = () => {
    const area = meta.areaHa || 1;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const n2 = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    const moedaP = (v: number) => "R$&nbsp;" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const diffRha  = calc.custoN32Ha - calc.custoTpdHa;
    const diffTotal = diffRha * area;
    const diffPct   = calc.custoN32Ha > 0 ? (diffRha / calc.custoN32Ha) * 100 : 0;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recomendação N32 TPD</title>
<style>
@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
.hdr{background:linear-gradient(135deg,#65a30d,#4d7c0f);color:#fff;padding:18px 22px;border-radius:8px;margin-bottom:14px}
.hdr h1{font-size:20px;font-weight:700}.hdr .sub{font-size:11px;opacity:.88;margin-top:4px}
.hdr .badge{display:inline-block;background:rgba(255,255,255,.25);border-radius:99px;padding:3px 10px;font-size:10px;font-weight:600;margin-top:8px}
.sec{margin-bottom:14px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#4d7c0f;border-bottom:2px solid #84cc16;padding-bottom:4px;margin-bottom:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #d1d5db;border-radius:6px;overflow:hidden}
.g3c{padding:10px 12px;text-align:center}.g3c+.g3c{border-left:1px solid #d1d5db}
.g3l{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.g3v{font-size:16px;font-weight:700}.g3s{font-size:9px;color:#6b7280;margin-top:2px}
.red{color:#ef4444}.lime{color:#65a30d}.green{color:#16a34a}
table{width:100%;border-collapse:collapse}
th{background:#f0fdf4;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#4d7c0f;padding:6px 8px;border-bottom:1px solid #bbf7d0;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:10.5px;vertical-align:top}
tr:last-child td{border-bottom:none}
.step{display:flex;gap:10px;align-items:flex-start;margin-bottom:7px}
.snum{width:22px;height:22px;border-radius:50%;background:#65a30d;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sprod{font-weight:600}.sqty{color:#65a30d;font-weight:700;font-size:12px}.sinst{font-size:10px;color:#6b7280;margin-top:1px}
.footer{margin-top:18px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;color:#9ca3af;font-size:9px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>

<div class="hdr">
  <h1>N32 TPD &mdash; Aduba&ccedil;&atilde;o Foliar Nitrogenada</h1>
  <div class="sub">${[meta.produtor && `Produtor: ${meta.produtor}`, meta.fazenda && `Fazenda: ${meta.fazenda}`, `Cultura: ${meta.cultura}`, `&Aacute;rea: ${n2(area, 0)} ha`].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>
  <div class="badge">N32 TPD &nbsp;&middot;&nbsp; ${formaAplicacao} &nbsp;&middot;&nbsp; ${n2(calc.nKgHa, 2)} kg N/ha &nbsp;&middot;&nbsp; ${n2(calc.volHa, 0)} L/ha</div>
</div>

<div class="sec">
  <div class="sec-title">Comparativo de Custos</div>
  <div class="grid3">
    <div class="g3c">
      <div class="g3l">N32 Convencional</div>
      <div class="g3v red">${moedaP(calc.custoN32Ha)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(n32Lha, 1)} L &times; R$&nbsp;${n2(precoN32, 2)}/L</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(calc.custoN32Ha * area)}</div>
    </div>
    <div class="g3c" style="background:#f0fdf4">
      <div class="g3l">N32 TPD NUTRIR</div>
      <div class="g3v lime">${moedaP(calc.custoTpdHa)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(calc.volHa, 0)} L produzidos/ha</div>
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
  <table><thead><tr><th>Volume/ha</th><th>Total na &Aacute;rea</th><th>N&deg; Bateladas (${n2(volBatelada, 0)} L)</th><th>Forma de Aplica&ccedil;&atilde;o</th></tr></thead>
  <tbody><tr>
    <td>${n2(calc.volHa, 0)} L/ha</td>
    <td>${n2(calc.volTotal, 0)} L</td>
    <td>${batCheias} batelada${batCheias !== 1 ? "s" : ""}${batParcial > 0 ? ` + 1 parcial de ${n2(batParcial, 0)} L` : ""}</td>
    <td>${formaAplicacao}</td>
  </tr></tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Aplica&ccedil;&otilde;es por Est&aacute;gio Fenol&oacute;gico</div>
  <table><thead><tr><th>#</th><th>Est&aacute;gio / Fase</th><th>Tipo de Aplica&ccedil;&atilde;o</th><th>Volume</th></tr></thead>
  <tbody><tr>
    <td>1</td>
    <td>Foliar &mdash; ${meta.cultura}</td>
    <td>N32 TPD (Ureia + LEG) &mdash; ${formaAplicacao}</td>
    <td>${n2(calc.volHa, 0)} L/ha &nbsp;&middot;&nbsp; Total: ${n2(calc.volTotal, 0)} L</td>
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
    <tr style="background:#f0fdf4;font-weight:700">
      <td colspan="3" style="text-align:right;padding-right:12px">Total Geral</td>
      <td>${moedaP(calc.custoTotal)}</td>
    </tr>
  </tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Receita de Preparo da Calda (por 1.000 L)</div>
  <div style="padding:4px 0">
    <div class="step"><div class="snum">1</div><div><div class="sprod">Iniciar com &Aacute;gua</div><div class="sqty">~400 L</div><div class="sinst">Encher o incorporador/tanque com &aacute;gua limpa</div></div></div>
    <div class="step"><div class="snum">2</div><div><div class="sprod">LEG (complexante)</div><div class="sqty">${LEG_POR1000} L</div><div class="sinst">Adicionar e agitar por 5 minutos</div></div></div>
    <div class="step"><div class="snum">3</div><div><div class="sprod">Ureia Branca</div><div class="sqty">${UREIA_POR1000} kg</div><div class="sinst">Adicionar aos poucos com agita&ccedil;&atilde;o constante at&eacute; dissolver</div></div></div>
    <div class="step"><div class="snum">4</div><div><div class="sprod">Completar com &Aacute;gua</div><div class="sqty">at&eacute; 1.000 L</div><div class="sinst">Misturar por 20&ndash;30 minutos antes de aplicar</div></div></div>
  </div>
</div>

<div class="footer">
  <span>NUTRIR &mdash; Programa de Aduba&ccedil;&atilde;o Foliar &middot; Gerado em ${hoje}</span>
  <span>N32 TPD Fertagro &middot; ${meta.cultura} &middot; ${n2(area, 0)} ha</span>
</div>
<script>window.print();</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const irParaPedido = () => {
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_n32",
      titulo: `N32 TPD — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || null,
      area_ha: meta.areaHa,
      observacoes: `N32 Foliar TPD · ${meta.cultura} · ${meta.areaHa} ha`,
      itens: [
        { produto_nome: "Ureia", quantidade: Math.ceil(calc.ureiaTotal), unidade: "kg", preco_unitario: precoUreia / 1000 },
        { produto_nome: "LEG",   quantidade: Math.ceil(calc.legTotal),   unidade: "L",  preco_unitario: precoLeg },
      ],
    }));
    navigate("/app/rep/pedidos");
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><Leaf className="w-5 h-5 text-lime-600" />N32 — Foliar Nitrogenado</span> as any}
        description="Substituição de N32 · pulverizador, drone ou avião · 400 kg Ureia + 75 L LEG por 1.000 L"
        actions={
          <div className="flex gap-2">
            <Button onClick={irParaRecomendacao} className="gap-1.5 bg-lime-600 hover:bg-lime-700"><FileText className="w-4 h-4" />Recomendação</Button>
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

        {/* Configuração N32 */}
        <Card className="border-lime-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-lime-600" />
            <p className="text-sm font-semibold text-lime-700">N32 — Configuração</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Lbl t="Dose N32 (L/ha)">
              <Input type="number" step="0.5" value={n32Lha || ""} onFocus={e => e.target.select()} onChange={e => setN32Lha(parseFloat(e.target.value) || 0)} />
            </Lbl>
            <Lbl t="Forma de Aplicação">
              <Select value={formaAplicacao} onValueChange={setFormaAplicacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="N (kg N/ha) — auto">
              <div className="h-10 flex items-center px-3 bg-lime-50 border border-lime-200 rounded-md">
                <span className="font-bold text-lime-700 text-sm">{num(calc.nKgHa, 2)} kg N/ha</span>
              </div>
            </Lbl>
            <Lbl t="Volume calda (L/ha) — auto">
              <div className="h-10 flex items-center px-3 bg-lime-50 border border-lime-200 rounded-md">
                <span className="font-bold text-lime-700 text-sm">{num(calc.volHa, 0)} L/ha</span>
              </div>
            </Lbl>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-lime-50 rounded-lg text-xs mb-3">
            <div><p className="text-muted-foreground">Ureia/ha</p><p className="font-bold">{num(calc.ureiaKgHa, 1)} kg</p></div>
            <div><p className="text-muted-foreground">LEG/ha</p><p className="font-bold">{num(calc.legLHa, 1)} L</p></div>
            <div><p className="text-muted-foreground">Volume total</p><p className="font-bold">{num(calc.volTotal, 0)} L</p></div>
            <div><p className="text-muted-foreground">Custo TPD/ha</p><p className="font-bold text-lime-700">{moeda(calc.custoTpdHa)}</p></div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg text-xs">
            <p className="font-semibold mb-1">Fórmula por 1.000 L de N32 TPD:</p>
            <p>• 400 L de água</p>
            <p>• 400 kg de Ureia</p>
            <p>• 75 L de LEG</p>
            <p>• Completar com água até 1.000 L</p>
          </div>
        </CardContent></Card>

        {/* Preços e comparativo */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Preços e Comparativo de Custo</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Lbl t="Preço N32 cliente (R$/L)">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
                <Input type="number" step="0.5" value={precoN32 || ""} onFocus={e => e.target.select()} onChange={e => setPrecoN32(parseFloat(e.target.value) || 0)} className="rounded-l-none" />
              </div>
            </Lbl>
            <Lbl t="Ureia (R$/t)">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
                <Input type="number" step="100" value={precoUreia || ""} onFocus={e => e.target.select()} onChange={e => setPrecoUreia(parseFloat(e.target.value) || 0)} className="rounded-l-none" />
              </div>
            </Lbl>
            <Lbl t="LEG (R$/L)">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
                <Input type="number" step="0.5" value={precoLeg || ""} onFocus={e => e.target.select()} onChange={e => setPrecoLeg(parseFloat(e.target.value) || 0)} className="rounded-l-none" />
              </div>
            </Lbl>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">N32 Convencional</p>
              <p className="text-lg font-bold text-red-500">{moeda(calc.custoN32Ha)}<span className="text-xs font-normal">/ha</span></p>
              <p className="text-xs text-muted-foreground">{n32Lha} L × R$ {precoN32.toFixed(2)}</p>
            </div>
            <div className="text-center border-x">
              <p className="text-xs text-muted-foreground mb-1">N32 TPD (Fertagro)</p>
              <p className="text-lg font-bold text-lime-600">{moeda(calc.custoTpdHa)}<span className="text-xs font-normal">/ha</span></p>
              <p className="text-xs text-muted-foreground">{num(calc.volHa, 0)} L produzidos/ha</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Economia/ha</p>
              <p className={`text-lg font-bold ${calc.economiaHa > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                {calc.economiaHa > 0 ? "▼ " : ""}{moeda(Math.abs(calc.economiaHa))}
              </p>
              <p className="text-xs text-muted-foreground">{num(Math.abs(calc.economiaPct), 1)}% {calc.economiaHa > 0 ? "menor" : "maior"}</p>
            </div>
          </div>

          {calc.economiaHa > 0 && meta.areaHa > 0 && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-xs text-green-700 mb-0.5">Economia total para <strong>{num(meta.areaHa, 0)} ha</strong></p>
              <p className="text-xl font-bold text-green-700">{moeda(calc.economiaHa * meta.areaHa)}</p>
              <p className="text-xs text-green-600 mt-0.5">({num(calc.economiaPct, 1)}% de redução de custo)</p>
            </div>
          )}
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)"><Input type="number" value={volBatelada || ""} onFocus={e => e.target.select()} onChange={e => setVolBatelada(parseFloat(e.target.value) || 1000)} /></Lbl>
          </div>
          <div className="p-4 bg-lime-50 border border-lime-200 rounded-lg">
            <p className="text-xs font-bold text-lime-700 mb-2">N32 TPD — {num(calc.volTotal, 0)} L totais ({num(meta.areaHa, 0)} ha)</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcial > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcial, 0)} L</span>}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {num(vBat * 0.4, 0)} kg Ureia + {num(vBat * 0.075, 1)} L LEG</p>
              <p>Completar com água até {num(vBat, 0)} L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Insumos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
            <div><p className="text-xs text-muted-foreground">Ureia total</p><p className="font-bold">{num(calc.ureiaTotal / 1000, 3)} t</p></div>
            <div><p className="text-xs text-muted-foreground">LEG total</p><p className="font-bold">{num(calc.legTotal, 0)} L</p></div>
            <div><p className="text-xs text-muted-foreground">Custo TPD/ha</p><p className="font-bold text-lime-700">{moeda(calc.custoTpdHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p><p className="font-bold text-primary">{moeda(calc.custoTotal)}</p></div>
          </div>
          <Button className="w-full gap-2 bg-lime-600 hover:bg-lime-700" onClick={irParaRecomendacao}>
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
