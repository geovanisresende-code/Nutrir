import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { Leaf, ShoppingCart } from "lucide-react";

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
        actions={<Button onClick={irParaPedido} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><ShoppingCart className="w-4 h-4" />Gerar Pedido</Button>}
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
          <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido Fertagro
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
