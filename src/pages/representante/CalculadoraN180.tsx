import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable, useOrgTable } from "@/lib/nutrir/useNutrirData";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { FlaskConical, ShoppingCart } from "lucide-react";

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

// Distribuição do volume de cobertura em aplicações (L/ha por estágio)
const COB_LIMITS = [
  { stage: "V2",  max: 120 },
  { stage: "V4",  max: 100 },
  { stage: "V6",  max: 80  },
  { stage: "V8",  max: 60  },
  { stage: "R1",  max: 40  },
];

function distribuirCobertura(totalHa: number): { stage: string; vol: number }[] {
  const apps: { stage: string; vol: number }[] = [];
  let remaining = totalHa;
  for (const lim of COB_LIMITS) {
    if (remaining < 0.5) break;
    const vol = Math.min(remaining, lim.max);
    apps.push({ stage: lim.stage, vol });
    remaining -= vol;
  }
  return apps;
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
  const [vazaoMicron, setVazaoMicron] = useState(50);  // L/ha antes do ajuste -10
  const [complexanteSulco, setComplexanteSulco] = useState<"tsh" | "lifegrow">("tsh");
  const [complexanteV2, setComplexanteV2] = useState<Complexante>("tsh");
  const [complexanteGeral, setComplexanteGeral] = useState<Complexante>("tsh");
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
    if (isLiquidoForma(formaAplicacao)) {
      if (complexanteGeral === "leg") setComplexanteGeral("tsh");
      if (complexanteV2   === "leg") setComplexanteV2("tsh");
    }
  }, [formaAplicacao]);

  // ── Cálculos principais ───────────────────────────────────────────
  const calc = useMemo(() => {
    const pontosN   = doseHa * ADUBOS[adubo].nPct;
    const ureiaKgHa = calcUreiaReduzida(adubo, doseHa);
    const saKgHa    = calcSAUsado(adubo, doseHa);
    const volCaldaHa = ureiaKgHa * 2.5;                // L/ha de N180

    const sulcoVolHa      = possuiMicron ? Math.max(0, Math.min(vazaoMicron - 10, volCaldaHa)) : 0;
    const coberturaVolHa  = volCaldaHa - sulcoVolHa;
    const coberturaApps   = possuiMicron ? distribuirCobertura(coberturaVolHa) : [];

    const cxPorL = (cx: Complexante) => CX_L_1000[cx] / 1000; // L cx por L de N180

    // Complexante total por ha (somado por tipo)
    const totalCx: Partial<Record<Complexante, number>> = {};
    const addCx = (cx: Complexante, vol: number) => {
      totalCx[cx] = (totalCx[cx] ?? 0) + vol * cxPorL(cx);
    };

    if (possuiMicron) {
      addCx(complexanteSulco, sulcoVolHa);
      if (coberturaApps.length > 0) {
        addCx(complexanteV2, coberturaApps[0].vol);          // V2 = 1ª cobertura
        for (let i = 1; i < coberturaApps.length; i++) {
          addCx("leg", coberturaApps[i].vol);                 // V4+ = LEG obrigatório
        }
      }
    } else {
      addCx(complexanteGeral, volCaldaHa);
    }

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
  }, [adubo, doseHa, possuiMicron, vazaoMicron, complexanteSulco, complexanteV2, complexanteGeral, meta.areaHa, precos]);

  const vBat          = Math.max(volBatelada, 100);
  const batCheias     = Math.floor(calc.volTotalL / vBat);
  const batParcialVol = Math.round(calc.volTotalL % vBat);

  const irParaPedido = () => {
    const itens: any[] = [
      { produto_nome: "Ureia Branca", quantidade: Math.ceil(calc.ureiaTotal), unidade: "kg", preco_unitario: precos.ureia / 1000 },
    ];
    if (calc.saTotal > 0)
      itens.push({ produto_nome: "Sulfato de Amônio", quantidade: Math.ceil(calc.saTotal), unidade: "kg", preco_unitario: 0 });
    (["tsh", "lifegrow", "leg"] as Complexante[]).forEach(k => {
      const v = calc.cxTotal[k];
      if (v && v > 0.01)
        itens.push({
          produto_nome:    CX_LABEL[k],
          quantidade:      Math.ceil(v),
          unidade:         "L",
          preco_unitario:  k === "tsh" ? precos.tsh : k === "lifegrow" ? precos.lifeGrow : precos.leg,
        });
    });
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem:       "calc_n180",
      titulo:       `N180 — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha:      meta.areaHa,
      observacoes:  `N180 · ${ADUBOS[adubo].label} · ${meta.cultura} · ${meta.areaHa} ha`,
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
        actions={<Button onClick={irParaPedido} className="gap-1.5"><ShoppingCart className="w-4 h-4" />Criar Pedido</Button>}
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
              <Input value={meta.produtor} onChange={e => setMeta({ ...meta, produtor: e.target.value })} placeholder="Nome do produtor" />
            </Lbl>
            <Lbl t="Fazenda">
              <Input value={meta.fazenda} onChange={e => setMeta({ ...meta, fazenda: e.target.value })} placeholder="Nome da fazenda" />
            </Lbl>
            <Lbl t="Cultura">
              <Select value={meta.cultura} onValueChange={v => setMeta({ ...meta, cultura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{listaCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Área (ha)">
              <Input type="number" value={meta.areaHa || ""} onFocus={e => e.target.select()}
                onChange={e => setMeta({ ...meta, areaHa: parseFloat(e.target.value) || 0 })} />
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
              <Input type="number" step="10" value={doseHa || ""} onFocus={e => e.target.select()}
                onChange={e => setDoseHa(parseFloat(e.target.value) || 0)} />
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

          {/* Possui Micron */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg mb-4 cursor-pointer" onClick={() => setPossuiMicron(p => !p)}>
            <input type="checkbox" readOnly checked={possuiMicron} className="w-4 h-4 accent-primary pointer-events-none" />
            <span className="text-sm font-medium">Possui Micron (aplicação em sulco de plantio)</span>
          </div>

          {possuiMicron && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
              <Lbl t="Complexante — V2 (1ª cobertura)">
                <Select value={complexanteV2} onValueChange={v => setComplexanteV2(v as Complexante)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tsh">TSH</SelectItem>
                    <SelectItem value="lifegrow">Life Grow</SelectItem>
                    {allowLeg && <SelectItem value="leg">LEG</SelectItem>}
                  </SelectContent>
                </Select>
              </Lbl>
            </div>
          )}

          {!possuiMicron && (
            <div className="max-w-xs">
              <Lbl t="Complexante">
                <Select value={complexanteGeral} onValueChange={v => setComplexanteGeral(v as Complexante)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tsh">TSH</SelectItem>
                    <SelectItem value="lifegrow">Life Grow</SelectItem>
                    {allowLeg && <SelectItem value="leg">LEG</SelectItem>}
                  </SelectContent>
                </Select>
              </Lbl>
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
            {possuiMicron ? (
              <div className="space-y-2">
                <div>
                  <p className="font-medium text-muted-foreground">Sulco — {CX_LABEL[complexanteSulco]}</p>
                  <p>400 L água + 400 kg ureia + {CX_L_1000[complexanteSulco]} L {CX_LABEL[complexanteSulco]} + água até 1.000 L</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">V2 — 1ª cobertura — {CX_LABEL[complexanteV2]}</p>
                  <p>400 L água + 400 kg ureia + {CX_L_1000[complexanteV2]} L {CX_LABEL[complexanteV2]} + água até 1.000 L</p>
                </div>
                {calc.coberturaApps.length > 1 && (
                  <div>
                    <p className="font-medium text-muted-foreground">V4 em diante — LEG (obrigatório)</p>
                    <p>400 L água + 400 kg ureia + 25 L LEG + água até 1.000 L</p>
                  </div>
                )}
              </div>
            ) : (
              <p>400 L água + 400 kg ureia + {CX_L_1000[complexanteGeral]} L {CX_LABEL[complexanteGeral]} + água até 1.000 L</p>
            )}
          </div>
        </CardContent></Card>

        {/* Distribuição de aplicações — apenas com micron */}
        {possuiMicron && (
          <Card><CardContent className="pt-4">
            <p className="text-sm font-semibold text-primary mb-3">Distribuição de Aplicações</p>
            <div className="space-y-1">
              {/* Sulco */}
              <div className="flex items-center justify-between py-2.5 border-b">
                <div>
                  <p className="text-sm font-medium">Sulco de Plantio</p>
                  <p className="text-xs text-muted-foreground">{CX_LABEL[complexanteSulco]} · {num(calc.sulcoVolHa, 0)} L/ha</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold">{num(calc.sulcoVolHa * meta.areaHa, 0)} L total</p>
                  <p className="text-muted-foreground">{num(calc.sulcoVolHa * 0.4, 1)} kg ureia/ha</p>
                </div>
              </div>
              {/* Coberturas */}
              {calc.coberturaApps.map((app, i) => {
                const cx: Complexante = i === 0 ? complexanteV2 : "leg";
                return (
                  <div key={app.stage} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{app.stage}</p>
                      <p className="text-xs text-muted-foreground">{CX_LABEL[cx]} · {num(app.vol, 0)} L/ha</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-semibold">{num(app.vol * meta.areaHa, 0)} L total</p>
                      <p className="text-muted-foreground">{num(app.vol * 0.4, 1)} kg ureia/ha</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>
        )}

        {/* Preços de insumos */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Preços de Insumos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PrecoInput label="Ureia (R$/t)"     value={precos.ureia}    step="100"  onChange={v => setPrecos({ ...precos, ureia: v })} />
            <PrecoInput label="TSH (R$/L)"        value={precos.tsh}      step="0.50" onChange={v => setPrecos({ ...precos, tsh: v })} />
            <PrecoInput label="Life Grow (R$/L)"  value={precos.lifeGrow} step="0.50" onChange={v => setPrecos({ ...precos, lifeGrow: v })} />
            <PrecoInput label="LEG (R$/L)"        value={precos.leg}      step="0.50" onChange={v => setPrecos({ ...precos, leg: v })} />
          </div>
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)">
              <Input type="number" value={volBatelada || ""} onFocus={e => e.target.select()}
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
              {!possuiMicron && (
                <p>+ {num(CX_L_1000[complexanteGeral] * vBat / 1000, 1)} L {CX_LABEL[complexanteGeral]}</p>
              )}
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
          <Button className="w-full mt-2 gap-2" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido com estes insumos
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
