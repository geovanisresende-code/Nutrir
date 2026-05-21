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
import { Atom, ShoppingCart, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Cultura    { id: string; nome: string; }
interface MP         { id: string; codigo: string | null; nome: string; preco_atual: number | null; unidade_preco: string; ativo: boolean; }
interface Complexador { id: string; nome: string; preco_litro: number; ativo: boolean; }

type AduboKey     = "ureia_branca" | "ureia_protegida" | "sulfato_amonio" | "nitrato_amonio";
type ComplexLevel = "forte" | "padrao" | "fraca";
type CxSulco      = "tsh" | "lifegrow";

// ─── Constantes ────────────────────────────────────────────────────────────
const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];

const ADUBOS: Record<AduboKey, { label: string; nPct: number }> = {
  ureia_branca:    { label: "Ureia Branca",     nPct: 0.45 },
  ureia_protegida: { label: "Ureia Protegida",   nPct: 0.45 },
  sulfato_amonio:  { label: "Sulfato de Amônio", nPct: 0.21 },
  nitrato_amonio:  { label: "Nitrato de Amônio", nPct: 0.327 },
};

// LEG sobre sais gerais (micro, Ca, S...)
// LEG sobre Ureia, MAP, KCl (dose mais baixa)
const LEG_PCT: Record<ComplexLevel, { geral: number; npk: number }> = {
  forte:  { geral: 0.1875, npk: 0.08   },
  padrao: { geral: 0.14,   npk: 0.0625 },
  fraca:  { geral: 0.112,  npk: 0.049  },
};
// Complex BOR: % de LEG sobre kg de Ácido Bórico
const BOR_PCT: Record<ComplexLevel, number> = { forte: 0.76, padrao: 0.60, fraca: 0.53 };
// íON: % sobre total de sais micro (exceto Ureia/MAP/KCl/AB)
const ION_PCT: Record<ComplexLevel, number> = { forte: 0.25, padrao: 0.20, fraca: 0.15 };

// Tabela de micronutrientes → sais
const MICRO_SALTS = [
  { elem: "Mn", label: "Manganês (Mn)",      sal: "Sulfato de Manganês",  pct: 0.31, cat: "micro" as const },
  { elem: "Mg", label: "Magnésio (Mg)",       sal: "Sulfato de Magnésio",  pct: 0.16, cat: "micro" as const },
  { elem: "Zn", label: "Zinco (Zn)",          sal: "Sulfato de Zinco",     pct: 0.35, cat: "micro" as const },
  { elem: "Cu", label: "Cobre (Cu)",          sal: "Sulfato de Cobre",     pct: 0.35, cat: "micro" as const },
  { elem: "B",  label: "Boro (B)",            sal: "Ácido Bórico",         pct: 0.17, cat: "boro"  as const },
  { elem: "P",  label: "Fósforo (P)",         sal: "MAP Purificado",       pct: 0.60, cat: "npk"   as const },
  { elem: "K",  label: "Potássio (K)",        sal: "KCl Branco",           pct: 0.60, cat: "npk"   as const },
  { elem: "Ca", label: "Cálcio (Ca)",         sal: "Nitrato de Cálcio",    pct: 0.16, cat: "micro" as const },
  { elem: "Mo", label: "Molibdênio (Mo)",     sal: "Molibdato de Sódio",   pct: 0.39, cat: "micro" as const },
  { elem: "Co", label: "Cobalto (Co)",        sal: "Sulfato de Cobalto",   pct: 0.20, cat: "micro" as const },
  { elem: "Ni", label: "Níquel (Ni)",         sal: "Sulfato de Níquel",    pct: 0.22, cat: "micro" as const },
  { elem: "Se", label: "Selênio (Se)",        sal: "Selenito de Sódio",    pct: 0.44, cat: "micro" as const },
  { elem: "Fe", label: "Ferro (Fe)",          sal: "Sulfato Férrico",      pct: 0.23, cat: "micro" as const },
] as const;

// Estágios de distribuição de cobertura
const COB_STAGES = [
  { stage: "V2", max: 120, min: 50 },
  { stage: "V4", max: 100, min: 50 },
  { stage: "V6", max: 80,  min: 30 },
  { stage: "V8", max: 60,  min: 0  },
  { stage: "R1", max: 40,  min: 0  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
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

function distribuirCobertura(total: number, n: number) {
  const count  = Math.max(1, Math.min(n, COB_STAGES.length));
  const volBase = total / count;
  // Regra: 1ª e 2ª aplicação mínimo 50L/ha (exceto se total < 100)
  if (total < 100 || count === 1) {
    return COB_STAGES.slice(0, count).map(s => ({ ...s, vol: volBase }));
  }
  // 1ª e 2ª com mínimo 50, distribuir restante nas demais
  const apps = COB_STAGES.slice(0, count).map((s, i) => ({ ...s, vol: i < 2 ? Math.max(50, volBase) : volBase }));
  // Rebalancear para manter total correto
  const somaPrioritaria = apps.slice(0, 2).reduce((a, c) => a + c.vol, 0);
  const resto = total - somaPrioritaria;
  if (count > 2 && resto > 0) {
    const volResto = resto / (count - 2);
    apps.forEach((a, i) => { if (i >= 2) a.vol = volResto; });
  }
  return apps;
}

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

// ─── Componente principal ──────────────────────────────────────────────────
export default function CalculadoraNitroPlus() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: mps, loading: mpsLoading } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: complexadores, loading: cmpLoading } = useGlobalTable<Complexador>("nutrir_complexadores", "nome");
  const { params, loading: cfgLoading } = useMotorConfig();
  const [precoInit, setPrecoInit] = useState(false);
  const [showMicros, setShowMicros] = useState(true);

  // Meta
  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });

  // N source
  const [adubo, setAdubo]       = useState<AduboKey>("ureia_branca");
  const [doseHa, setDoseHa]     = useState(200);
  const [possuiMicron, setPossuiMicron] = useState(false);
  const [vazaoMicron, setVazaoMicron]   = useState(50);
  const [nCoberturas, setNCoberturas]   = useState(3);
  const [cxSulco, setCxSulco]           = useState<CxSulco>("lifegrow");
  const [volBatelada, setVolBatelada]   = useState(6000);

  // Complexação
  const [complexLevel, setComplexLevel] = useState<ComplexLevel>("padrao");
  const [possuiIon, setPossuiIon]       = useState(false);
  const [estimullLHa, setEstimullLHa]   = useState(0.3);
  const [aminoLHa, setAminoLHa]         = useState(1.0);

  // Micronutrientes (gr/ha de elemento)
  const [micros, setMicros] = useState<Record<string, number>>({
    Mn: 0, Mg: 0, Zn: 0, Cu: 0, B: 0, P: 0, K: 0, Ca: 0, Mo: 0, Co: 0, Ni: 0, Se: 0, Fe: 0,
  });

  // Preços
  const [precos, setPrecos] = useState({
    ureia: 4000, tsh: 18.0, lifeGrow: 25.0, leg: 22.0,
    acidoBorico: 6.5, complexBor: 32.0, estimull: 90.0, aminoplus: 45.0, ion: 65.0,
  });

  // Carrega preços
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

  const setMicro = (elem: string, val: number) => setMicros(m => ({ ...m, [elem]: val }));

  // ─── Cálculos ─────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    // N180 base
    const pontosN    = doseHa * ADUBOS[adubo].nPct;
    const ureiaKgHa  = calcUreiaReduzida(adubo, doseHa);
    const volN180Ha  = ureiaKgHa * 2.5;

    // Micros → sais
    const saisKgHa: Record<string, number> = {};
    MICRO_SALTS.forEach(s => {
      const grElem = micros[s.elem] || 0;
      saisKgHa[s.elem] = grElem > 0 ? (grElem / 1000) / s.pct : 0;
    });

    // Sais micro (excl. Ureia/MAP/KCl) e NPK
    const microElems = MICRO_SALTS.filter(s => s.cat === "micro");
    const npkElems   = MICRO_SALTS.filter(s => s.cat === "npk");
    const boroElem   = MICRO_SALTS.find(s => s.cat === "boro")!;

    const totalMicroKg = microElems.reduce((a, s) => a + saisKgHa[s.elem], 0);
    const totalNpkKg   = npkElems.reduce((a, s) => a + saisKgHa[s.elem], 0);
    const abKgHa       = saisKgHa[boroElem.elem]; // Ácido Bórico

    // LEG
    const lp = LEG_PCT[complexLevel];
    // LEG sobre micro salts
    const legMicroHa = microElems.reduce((a, s) => a + saisKgHa[s.elem] * lp.geral, 0);
    // LEG sobre NPK salts (MAP, KCl)
    const legNpkHa   = totalNpkKg * lp.npk;
    // LEG sobre Ureia
    const legUreiaHa = ureiaKgHa  * lp.npk;
    const legTotalHa = legMicroHa + legNpkHa + legUreiaHa;

    // Complex BOR
    const borLHa     = abKgHa > 0 ? abKgHa * BOR_PCT[complexLevel] : 0;

    // ION (opcional) — sobre total de sais micro
    const ionLHa     = possuiIon ? totalMicroKg * ION_PCT[complexLevel] : 0;

    // Volume total de calda/ha = vol N180 + complexantes líquidos
    const volComplexHa = legTotalHa + borLHa + estimullLHa + aminoLHa + ionLHa;
    const volTotalHa   = volN180Ha + volComplexHa;

    // Distribuição de aplicações
    const sulcoVolHa     = possuiMicron ? Math.max(0, Math.min(vazaoMicron - 10, volN180Ha)) : 0;
    const coberturaVolHa = volTotalHa - sulcoVolHa;
    const coberturaApps  = distribuirCobertura(coberturaVolHa, nCoberturas);

    // Fórmula por 1.000 L (proporcional)
    const f1000 = (v: number) => volTotalHa > 0 ? (v / volTotalHa) * 1000 : 0;
    const formula1000 = {
      ureia:    f1000(ureiaKgHa),
      leg:      f1000(legTotalHa),
      bor:      f1000(borLHa),
      ab:       f1000(abKgHa),
      estimull: f1000(estimullLHa),
      amino:    f1000(aminoLHa),
      ion:      f1000(ionLHa),
      salts:    MICRO_SALTS.map(s => ({ ...s, qty1000: f1000(saisKgHa[s.elem]) })),
    };

    // Custos
    const area       = meta.areaHa || 0;
    const custoUreia = ureiaKgHa  * precos.ureia / 1000;
    const custoLeg   = legTotalHa * precos.leg;
    const custoBor   = borLHa     * precos.complexBor;
    const custoAb    = abKgHa     * precos.acidoBorico;
    const custoEst   = estimullLHa * precos.estimull;
    const custoAmino = aminoLHa    * precos.aminoplus;
    const custoIon   = ionLHa      * precos.ion;
    const custoMicro = microElems.reduce((a, s) => a + saisKgHa[s.elem] * 5, 0); // placeholder ~R$5/kg sais micro
    const custoPorHa = custoUreia + custoLeg + custoBor + custoAb + custoEst + custoAmino + custoIon;

    const volTotalL  = volTotalHa * area;
    const ureiaTotal = ureiaKgHa  * area;
    const legTotal   = legTotalHa * area;
    const borTotal   = borLHa     * area;
    const abTotal    = abKgHa     * area;
    const custoTotal = custoPorHa * area;

    return {
      pontosN, ureiaKgHa, volN180Ha, saisKgHa, totalMicroKg, abKgHa,
      legTotalHa, legMicroHa, legNpkHa, legUreiaHa,
      borLHa, ionLHa, volTotalHa, sulcoVolHa, coberturaVolHa, coberturaApps,
      formula1000, custoUreia, custoPorHa,
      volTotalL, ureiaTotal, legTotal, borTotal, abTotal, custoTotal,
    };
  }, [adubo, doseHa, possuiMicron, vazaoMicron, nCoberturas, complexLevel, possuiIon, estimullLHa, aminoLHa, micros, meta.areaHa, precos]);

  const vBat       = Math.max(volBatelada, 100);
  const batCheias  = Math.floor(calc.volTotalL / vBat);
  const batParcial = Math.round(calc.volTotalL % vBat);

  const irParaPedido = () => {
    const itens: any[] = [
      { produto_nome: "LEG",         quantidade: Math.ceil(calc.legTotal),   unidade: "L",  preco_unitario: precos.leg },
    ];
    if (calc.borTotal > 0) itens.push({ produto_nome: "Complex Bor", quantidade: Math.ceil(calc.borTotal), unidade: "L", preco_unitario: precos.complexBor });
    if (calc.abTotal > 0)  itens.push({ produto_nome: "Ácido Bórico", quantidade: Math.ceil(calc.abTotal), unidade: "kg", preco_unitario: precos.acidoBorico });
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_nitroplus",
      titulo: `NitroPlus — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || null, area_ha: meta.areaHa,
      observacoes: `NitroPlus · ${meta.cultura} · ${meta.areaHa} ha · Complexação ${complexLevel}`,
      itens,
    }));
    navigate("/app/rep/pedidos");
  };

  const irParaRecomendacao = () => {
    const area = meta.areaHa || 1;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const n2 = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    const moedaP = (v: number) => "R$&nbsp;" + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const logoUrl = window.location.origin + logo1;
    // Custo convencional: dose completa do adubo base
    const nPct = ADUBOS[adubo].nPct;
    const precoPorKg = precos.ureia / 1000;
    const custoConvHa = doseHa * precoPorKg;
    const diffRha  = custoConvHa - calc.custoPorHa;
    const diffPct  = custoConvHa > 0 ? (diffRha / custoConvHa) * 100 : 0;

    // Salts with qty > 0
    const saltsAtivos = MICRO_SALTS.filter(s => (calc.saisKgHa[s.elem] || 0) > 0);

    // Compras: sacos para sólidos, tambores para líquidos
    const compras: {nome: string; necessario: string; unit: string; total: string}[] = [];
    compras.push({
      nome: "Ureia Branca",
      necessario: `${n2(calc.ureiaTotal, 1)} kg`,
      unit: `${moedaP(precoPorKg)}/kg`,
      total: moedaP(calc.ureiaTotal * precoPorKg),
    });
    if (calc.legTotal > 0) compras.push({
      nome: "LEG (complexante)",
      necessario: `${n2(calc.legTotal, 1)} L`,
      unit: `${moedaP(precos.leg)}/L`,
      total: moedaP(calc.legTotal * precos.leg),
    });
    if (calc.abTotal > 0) compras.push({
      nome: "&Aacute;cido B&oacute;rico",
      necessario: `${n2(calc.abTotal, 2)} kg`,
      unit: `${moedaP(precos.acidoBorico)}/kg`,
      total: moedaP(calc.abTotal * precos.acidoBorico),
    });
    if (calc.borTotal > 0) compras.push({
      nome: "Complex Bor",
      necessario: `${n2(calc.borTotal, 1)} L`,
      unit: `${moedaP(precos.complexBor)}/L`,
      total: moedaP(calc.borTotal * precos.complexBor),
    });
    saltsAtivos.filter(s => s.cat === "micro").forEach(s => {
      const totalKg = (calc.saisKgHa[s.elem] || 0) * area;
      compras.push({
        nome: s.sal,
        necessario: `${n2(totalKg, 3)} kg`,
        unit: "—",
        total: "—",
      });
    });
    const estimullTotal = estimullLHa * area;
    const aminoTotal    = aminoLHa    * area;
    if (estimullTotal > 0) compras.push({
      nome: "Estimull",
      necessario: `${n2(estimullTotal, 2)} L`,
      unit: `${moedaP(precos.estimull)}/L`,
      total: moedaP(estimullTotal * precos.estimull),
    });
    if (aminoTotal > 0) compras.push({
      nome: "Amino+",
      necessario: `${n2(aminoTotal, 2)} L`,
      unit: `${moedaP(precos.aminoplus)}/L`,
      total: moedaP(aminoTotal * precos.aminoplus),
    });
    if (possuiIon && calc.ionLHa > 0) {
      const ionTotal = calc.ionLHa * area;
      compras.push({
        nome: "&iacute;ON Complex",
        necessario: `${n2(ionTotal, 2)} L`,
        unit: `${moedaP(precos.ion)}/L`,
        total: moedaP(ionTotal * precos.ion),
      });
    }

    // Receita por 1000 L — ordem de incorporação
    const f = calc.formula1000;
    const receitaSteps: {prod: string; qty: string; inst: string}[] = [];
    receitaSteps.push({ prod: "Iniciar com &Aacute;gua", qty: "~300 L", inst: "Encher incorporador/tanque com &aacute;gua limpa" });
    if (possuiIon && f.ion > 0.01) receitaSteps.push({ prod: "&iacute;ON Complex", qty: `${n2(f.ion, 2)} L`, inst: "Adicionar e agitar 3 min" });
    if (f.bor > 0) receitaSteps.push({ prod: "Complex Bor", qty: `${n2(f.bor, 1)} L`, inst: "Adicionar e agitar 3 min" });
    if (f.ab > 0) receitaSteps.push({ prod: "&Aacute;cido B&oacute;rico", qty: `${n2(f.ab, 1)} kg`, inst: "Dissolver com agita&ccedil;&atilde;o por 10 min" });
    f.salts.filter(s => s.qty1000 > 0.001 && s.cat !== "boro").forEach(s => {
      receitaSteps.push({ prod: s.sal, qty: `${n2(s.qty1000, s.elem === "Se" || s.elem === "Co" ? 2 : 1)} kg`, inst: "Adicionar no incorporador e agitar 5 min" });
    });
    receitaSteps.push({ prod: "Ureia Branca", qty: `${n2(f.ureia, 0)} kg`, inst: "Adicionar aos poucos com agita&ccedil;&atilde;o constante" });
    receitaSteps.push({ prod: "LEG (complexante)", qty: `${n2(f.leg, 1)} L`, inst: "Adicionar e agitar 5 min" });
    if (f.estimull > 0.01) receitaSteps.push({ prod: "Estimull", qty: `${n2(f.estimull * 1000, 0)} mL`, inst: "Adicionar e homogeneizar" });
    if (f.amino > 0.01)    receitaSteps.push({ prod: "Amino+",   qty: `${n2(f.amino, 2)} L`,             inst: "Adicionar e homogeneizar" });
    receitaSteps.push({ prod: "Completar com &Aacute;gua", qty: "at&eacute; 1.000 L", inst: "Misturar por 1 hora antes de aplicar" });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recomendação NitroPlus</title>
<style>
@page{size:A4;margin:16mm 14mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}
.hdr{background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;padding:18px 22px;border-radius:8px;margin-bottom:14px}
.hdr h1{font-size:20px;font-weight:700}.hdr .sub{font-size:11px;opacity:.88;margin-top:4px}
.hdr .badge{display:inline-block;background:rgba(255,255,255,.25);border-radius:99px;padding:3px 10px;font-size:10px;font-weight:600;margin-top:8px}
.sec{margin-bottom:14px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#4c1d95;border-bottom:2px solid #a78bfa;padding-bottom:4px;margin-bottom:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #d1d5db;border-radius:6px;overflow:hidden}
.g3c{padding:10px 12px;text-align:center}.g3c+.g3c{border-left:1px solid #d1d5db}
.g3l{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.g3v{font-size:16px;font-weight:700}.g3s{font-size:9px;color:#6b7280;margin-top:2px}
.red{color:#ef4444}.vio{color:#7c3aed}.green{color:#16a34a}
table{width:100%;border-collapse:collapse}
th{background:#f5f3ff;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#4c1d95;padding:6px 8px;border-bottom:1px solid #c4b5fd;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f3f4f6;font-size:10.5px;vertical-align:top}
tr:last-child td{border-bottom:none}
.step{display:flex;gap:10px;align-items:flex-start;margin-bottom:7px}
.snum{width:22px;height:22px;border-radius:50%;background:#7c3aed;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sprod{font-weight:600}.sqty{color:#7c3aed;font-weight:700;font-size:12px}.sinst{font-size:10px;color:#6b7280;margin-top:1px}
.footer{margin-top:18px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;color:#9ca3af;font-size:9px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>

<div class="hdr">
  <img src="${logoUrl}" style="height:48px;margin-bottom:10px;display:block" alt="NUTRIR" />
  <h1>NitroPlus &mdash; N180 + Micronutrientes</h1>
  <div class="sub">${[meta.produtor && `Produtor: ${meta.produtor}`, meta.fazenda && `Fazenda: ${meta.fazenda}`, `Cultura: ${meta.cultura}`, `&Aacute;rea: ${n2(area, 0)} ha`].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>
  <div class="badge">${ADUBOS[adubo].label} ${n2(doseHa, 0)} kg/ha &nbsp;&middot;&nbsp; ${n2(calc.pontosN, 1)} kg N/ha &nbsp;&middot;&nbsp; Complexa&ccedil;&atilde;o: ${complexLevel} &nbsp;&middot;&nbsp; ${n2(calc.volTotalHa, 0)} L/ha</div>
</div>

<div class="sec">
  <div class="sec-title">Comparativo de Custos</div>
  <div class="grid3">
    <div class="g3c">
      <div class="g3l">Convencional (${ADUBOS[adubo].label})</div>
      <div class="g3v red">${moedaP(custoConvHa)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(doseHa, 0)} kg &times; R$&nbsp;${n2(precoPorKg, 2)}/kg</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(custoConvHa * area)}</div>
    </div>
    <div class="g3c" style="background:#f5f3ff">
      <div class="g3l">NitroPlus NUTRIR</div>
      <div class="g3v vio">${moedaP(calc.custoPorHa)}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(calc.ureiaKgHa, 1)} kg Ureia + complexantes</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(calc.custoTotal)}</div>
    </div>
    <div class="g3c">
      <div class="g3l">Diferen&ccedil;a</div>
      <div class="g3v ${diffRha > 0 ? "green" : "red"}">${diffRha > 0 ? "&#9660; " : "&#9650; "}${moedaP(Math.abs(diffRha))}<span style="font-size:10px;font-weight:400">/ha</span></div>
      <div class="g3s">${n2(Math.abs(diffPct), 1)}% ${diffRha > 0 ? "economia" : "adicional"}</div>
      <div class="g3s" style="margin-top:4px">Total: ${moedaP(Math.abs(diffRha * area))}</div>
    </div>
  </div>
</div>

<div class="sec">
  <div class="sec-title">Volume Total de Aplica&ccedil;&atilde;o</div>
  <table><thead><tr><th>Volume/ha</th><th>Total na &Aacute;rea</th><th>N&deg; Bateladas (${n2(volBatelada, 0)} L)</th><th>N&deg; Coberturas</th></tr></thead>
  <tbody><tr>
    <td>${n2(calc.volTotalHa, 0)} L/ha</td>
    <td>${n2(calc.volTotalL, 0)} L</td>
    <td>${batCheias} bat.${batParcial > 0 ? ` + 1 parcial de ${n2(batParcial, 0)} L` : ""}</td>
    <td>${nCoberturas} cobertura${nCoberturas !== 1 ? "s" : ""}${possuiMicron ? " + sulco" : ""}</td>
  </tr></tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Aplica&ccedil;&otilde;es por Est&aacute;gio Fenol&oacute;gico</div>
  <table><thead><tr><th>#</th><th>Est&aacute;gio</th><th>Tipo</th><th>Volume/ha</th><th>Volume Total</th></tr></thead>
  <tbody>
    ${possuiMicron ? `<tr><td>—</td><td>Sulco de Plantio</td><td>N180 puro (${cxSulco === "lifegrow" ? "Life Grow" : "TSH"})</td><td>${n2(calc.sulcoVolHa, 0)} L/ha</td><td>${n2(calc.sulcoVolHa * area, 0)} L</td></tr>` : ""}
    ${calc.coberturaApps.map((app, i) => `<tr><td>${i + 1}</td><td>${app.stage} &mdash; NitroPlus</td><td>N180 + Micros (cobertura)</td><td>${n2(app.vol, 0)} L/ha</td><td>${n2(app.vol * area, 0)} L</td></tr>`).join("")}
  </tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Lista de Compras</div>
  <table><thead><tr><th>Produto</th><th>Necess&aacute;rio</th><th>R$/un</th><th>Total</th></tr></thead>
  <tbody>
    ${compras.map(c => `<tr><td><strong>${c.nome}</strong></td><td>${c.necessario}</td><td>${c.unit}</td><td>${c.total}</td></tr>`).join("")}
    <tr style="background:#f5f3ff;font-weight:700">
      <td colspan="3" style="text-align:right;padding-right:12px">Total Geral</td>
      <td>${moedaP(calc.custoTotal)}</td>
    </tr>
  </tbody></table>
</div>

<div class="sec">
  <div class="sec-title">Receita de Preparo da Calda (por 1.000 L)</div>
  <div style="padding:4px 0">
    ${receitaSteps.map((s, i) => `
    <div class="step">
      <div class="snum">${i + 1}</div>
      <div><div class="sprod">${s.prod}</div><div class="sqty">${s.qty}</div><div class="sinst">${s.inst}</div></div>
    </div>`).join("")}
  </div>
</div>

${diffRha > 0 ? `
<div style="margin:16px 0 14px;border:2px solid #7c3aed;border-radius:10px;overflow:hidden">
  <div style="background:#7c3aed;color:#fff;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">
    &#9733; Destaque de Economia &mdash; NitroPlus vs Aduba&ccedil;&atilde;o Convencional
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#fff;align-items:center">
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">Convencional / ha</div>
      <div style="font-size:22px;font-weight:700;color:#ef4444">${moedaP(custoConvHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moedaP(custoConvHa * area)}</div>
    </div>
    <div style="text-align:center;border-right:1px solid #e5e7eb;padding:14px 12px">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">NitroPlus NUTRIR / ha</div>
      <div style="font-size:22px;font-weight:700;color:#7c3aed">${moedaP(calc.custoPorHa)}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px">Total: ${moedaP(calc.custoTotal)}</div>
    </div>
    <div style="text-align:center;padding:14px 12px;background:#f5f3ff">
      <div style="font-size:9px;color:#4c1d95;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;font-weight:600">Economia com NUTRIR</div>
      <div style="font-size:15px;font-weight:700;color:#16a34a;margin-bottom:2px">&#9660; ${moedaP(Math.abs(diffRha))}/ha &nbsp;(${n2(Math.abs(diffPct),1)}%)</div>
      <div style="font-size:26px;font-weight:800;color:#4c1d95;line-height:1.1">${moedaP(Math.abs(diffRha * area))}</div>
      <div style="font-size:10px;color:#7c3aed;margin-top:3px">em ${n2(area,0)} ha</div>
    </div>
  </div>
</div>` : ""}
<div class="footer">
  <span>NUTRIR &mdash; Programa de Aduba&ccedil;&atilde;o NitroPlus &middot; Gerado em ${hoje}</span>
  <span>NitroPlus Fertagro &middot; ${meta.cultura} &middot; ${n2(area, 0)} ha &middot; Complexa&ccedil;&atilde;o ${complexLevel}</span>
</div>
<script>window.print();</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const listaCulturas  = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;
  const fontePrecosMsg = mps.length > 0
    ? `✓ Preços do banco (${mps.length} MPs · ${complexadores.length} complexantes)`
    : "⚠ Cadastre matérias-primas para preços automáticos";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><Atom className="w-5 h-5 text-violet-600" />NitroPlus — N180 + Micros</span> as any}
        description="Ureia complexada + micronutrientes foliares · LEG / BOR / Estimull / Amino+ / íON"
        actions={
          <div className="flex gap-2">
            <Button onClick={irParaRecomendacao} className="gap-1.5 bg-violet-600 hover:bg-violet-700"><FileText className="w-4 h-4" />Recomendação</Button>
          </div>
        }
      />

      <div className="px-4 space-y-4">

        {/* Identificação */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Identificação</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${mps.length > 0 ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>{fontePrecosMsg}</span>
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

        {/* Configuração N */}
        <Card className="border-violet-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Atom className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-violet-700">Nitrogênio Base (N180)</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Lbl t="Adubo">
              <Select value={adubo} onValueChange={v => setAdubo(v as AduboKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.entries(ADUBOS) as [AduboKey, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Dose (kg/ha)"><Input type="number" step="10" value={doseHa || ""} onFocus={e => e.target.select()} onChange={e => setDoseHa(parseFloat(e.target.value) || 0)} /></Lbl>
            <Lbl t="Pontos N (auto)">
              <div className="h-10 flex items-center px-3 bg-violet-50 border border-violet-200 rounded-md">
                <span className="font-bold text-violet-700 text-sm">{num(calc.pontosN, 1)} kg N/ha</span>
              </div>
            </Lbl>
            <Lbl t="Ureia N180/ha (auto)">
              <div className="h-10 flex items-center px-3 bg-violet-50 border border-violet-200 rounded-md">
                <span className="font-bold text-violet-700 text-sm">{num(calc.ureiaKgHa, 1)} kg</span>
              </div>
            </Lbl>
          </div>

          {/* Coberturas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
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
            <Lbl t="Volume calda/ha (auto)">
              <div className="h-10 flex items-center px-3 bg-violet-50 border border-violet-200 rounded-md">
                <span className="font-bold text-violet-700 text-sm">{num(calc.volTotalHa, 0)} L/ha</span>
              </div>
            </Lbl>
          </div>

          {/* Micron */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg mb-3 cursor-pointer" onClick={() => setPossuiMicron(p => !p)}>
            <input type="checkbox" readOnly checked={possuiMicron} className="w-4 h-4 accent-primary pointer-events-none" />
            <span className="text-sm font-medium">Possui Micron — sulco usa N180 puro (Life Grow ou TSH)</span>
          </div>
          {possuiMicron && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Lbl t="Vazão Micron (L/ha)"><Input type="number" step="5" value={vazaoMicron || ""} onFocus={e => e.target.select()} onChange={e => setVazaoMicron(parseFloat(e.target.value) || 0)} /></Lbl>
              <Lbl t="Dose Sulco (auto)">
                <div className="h-10 flex items-center px-3 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="font-bold text-blue-700 text-sm">{num(calc.sulcoVolHa, 0)} L/ha — N180 puro</span>
                </div>
              </Lbl>
              <Lbl t="Complexante Sulco">
                <Select value={cxSulco} onValueChange={v => setCxSulco(v as CxSulco)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="tsh">TSH</SelectItem><SelectItem value="lifegrow">Life Grow</SelectItem></SelectContent>
                </Select>
              </Lbl>
            </div>
          )}
        </CardContent></Card>

        {/* Nível de complexação */}
        <Card className="border-violet-200"><CardContent className="pt-4">
          <p className="text-sm font-semibold text-violet-700 mb-3">Complexação — LEG / BOR / íON</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Lbl t="Nível de Complexação">
              <Select value={complexLevel} onValueChange={v => setComplexLevel(v as ComplexLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fraca">Fraca — LEG 11,2%</SelectItem>
                  <SelectItem value="padrao">Padrão — LEG 14%</SelectItem>
                  <SelectItem value="forte">Forte — LEG 18,75%</SelectItem>
                </SelectContent>
              </Select>
            </Lbl>
            <Lbl t="LEG total (auto)">
              <div className="h-10 flex items-center px-3 bg-violet-50 border border-violet-200 rounded-md">
                <span className="font-bold text-violet-700 text-sm">{num(calc.legTotalHa, 2)} L/ha</span>
              </div>
            </Lbl>
            <Lbl t="Estimull (L/ha)">
              <Input type="number" step="0.05" value={estimullLHa || ""} onFocus={e => e.target.select()} onChange={e => setEstimullLHa(parseFloat(e.target.value) || 0)} />
            </Lbl>
            <Lbl t="Amino+ (L/ha)">
              <Input type="number" step="0.1"  value={aminoLHa || ""} onFocus={e => e.target.select()} onChange={e => setAminoLHa(parseFloat(e.target.value) || 0)} />
            </Lbl>
          </div>

          {/* íON toggle */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg cursor-pointer" onClick={() => setPossuiIon(p => !p)}>
            <input type="checkbox" readOnly checked={possuiIon} className="w-4 h-4 accent-violet-600 pointer-events-none" />
            <div>
              <span className="text-sm font-medium">Usar íON Complex</span>
              <p className="text-xs text-muted-foreground">
                {complexLevel === "forte" ? "25%" : complexLevel === "padrao" ? "20%" : "15%"} sobre total de sais micro
                {calc.ionLHa > 0 && ` → ${num(calc.ionLHa, 2)} L/ha`}
              </p>
            </div>
          </div>

          <div className="mt-2 text-[10px] text-muted-foreground px-1 space-y-0.5">
            <p>LEG sobre sais micro: fraca 11,2% · padrão 14% · forte 18,75%</p>
            <p>LEG sobre Ureia/MAP/KCl: fraca 4,9% · padrão 6,25% · forte 8%</p>
            <p>Complex BOR: fraca 53% · padrão 60% · forte 76% sobre kg de Ácido Bórico</p>
            <p>Estimull: 50 mL/ha a 1,5 L/ha &nbsp;·&nbsp; Amino+: 500 mL/ha a 3 L/ha</p>
          </div>
        </CardContent></Card>

        {/* Tabela de micronutrientes */}
        <Card>
          <CardContent className="pt-4">
            <button
              className="w-full flex items-center justify-between text-sm font-semibold text-primary mb-1"
              onClick={() => setShowMicros(p => !p)}
            >
              <span>Micronutrientes (gr/ha de elemento)</span>
              {showMicros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showMicros && (
              <div className="mt-3 space-y-2">
                {MICRO_SALTS.map(s => {
                  const grHa   = micros[s.elem] || 0;
                  const salKg  = calc.saisKgHa[s.elem] || 0;
                  return (
                    <div key={s.elem} className="grid grid-cols-3 gap-2 items-center text-xs">
                      <div>
                        <p className="font-medium">{s.label}</p>
                        <p className="text-muted-foreground">{s.sal} ({(s.pct * 100).toFixed(0)}%)</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" step="10"
                          value={grHa || ""}
                          onFocus={e => e.target.select()}
                          onChange={e => setMicro(s.elem, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-xs"
                        />
                        <span className="text-muted-foreground shrink-0">gr/ha</span>
                      </div>
                      <div className="text-right">
                        {salKg > 0 && (
                          <span className="font-semibold text-violet-700">
                            {num(salKg, s.elem === "Mn" || s.elem === "Co" || s.elem === "Ni" || s.elem === "Se" ? 3 : 2)} kg/ha
                          </span>
                        )}
                        {salKg <= 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  );
                })}
                {calc.totalMicroKg > 0 && (
                  <div className="mt-2 p-2 bg-violet-50 rounded-lg flex justify-between text-xs">
                    <span className="text-muted-foreground">Total sais micro:</span>
                    <span className="font-bold text-violet-700">{num(calc.totalMicroKg, 2)} kg/ha</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resultado */}
        <Card className="border-violet-200"><CardContent className="pt-4">
          <p className="text-sm font-semibold text-violet-700 mb-3">Resultado por Hectare</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-violet-50 rounded-lg text-xs mb-3">
            <div><p className="text-muted-foreground">Ureia N180/ha</p><p className="font-bold">{num(calc.ureiaKgHa, 1)} kg</p></div>
            <div><p className="text-muted-foreground">LEG total/ha</p><p className="font-bold">{num(calc.legTotalHa, 2)} L</p></div>
            {calc.abKgHa > 0 && <div><p className="text-muted-foreground">Ácido Bórico/ha</p><p className="font-bold">{num(calc.abKgHa, 2)} kg</p></div>}
            {calc.borLHa > 0 && <div><p className="text-muted-foreground">Complex Bor/ha</p><p className="font-bold">{num(calc.borLHa, 2)} L</p></div>}
            <div><p className="text-muted-foreground">Estimull/ha</p><p className="font-bold">{num(estimullLHa, 2)} L</p></div>
            <div><p className="text-muted-foreground">Amino+/ha</p><p className="font-bold">{num(aminoLHa, 2)} L</p></div>
            {possuiIon && <div><p className="text-muted-foreground">íON/ha</p><p className="font-bold">{num(calc.ionLHa, 2)} L</p></div>}
            <div><p className="text-muted-foreground">Vol. calda/ha</p><p className="font-bold">{num(calc.volTotalHa, 0)} L</p></div>
            <div><p className="text-muted-foreground">Custo/ha</p><p className="font-bold text-violet-700">{moeda(calc.custoPorHa)}</p></div>
          </div>

          {/* Fórmula por 1000 L */}
          <div className="p-3 bg-muted/40 rounded-lg text-xs">
            <p className="font-semibold mb-2">Fórmula por 1.000 L de NitroPlus:</p>
            <div className="space-y-0.5">
              {calc.formula1000.bor > 0 && <p>• {num(calc.formula1000.bor, 1)} L Complex Bor</p>}
              {calc.formula1000.ab > 0  && <p>• {num(calc.formula1000.ab, 1)} kg Ácido Bórico — Agitar 10 min</p>}
              <p>• {num(calc.formula1000.ureia, 0)} kg Ureia</p>
              {calc.formula1000.salts.filter(s => s.qty1000 > 0.01).map(s => (
                <p key={s.elem}>• {num(s.qty1000, s.elem === "Se" || s.elem === "Co" ? 2 : 1)} {s.cat === "boro" ? "kg" : "kg"} {s.sal}</p>
              ))}
              <p className="text-muted-foreground">— Adicionar no incorporador, diluir 5 min —</p>
              <p>• {num(calc.formula1000.leg, 1)} L LEG</p>
              {calc.formula1000.estimull > 0.01 && <p>• {num(calc.formula1000.estimull * 1000, 0)} mL Estimull</p>}
              {calc.formula1000.amino > 0.01    && <p>• {num(calc.formula1000.amino, 2)} L Amino+</p>}
              {possuiIon && calc.formula1000.ion > 0.01 && <p>• {num(calc.formula1000.ion, 2)} L íON Complex</p>}
              <p className="font-medium mt-1">• Completar com água até 1.000 L — misturar 1 hora</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Distribuição de aplicações */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Distribuição de Aplicações</p>
          <div className="space-y-1">
            {possuiMicron && (
              <div className="flex items-center justify-between py-2.5 border-b">
                <div>
                  <p className="text-sm font-medium">Sulco de Plantio — N180 puro</p>
                  <p className="text-xs text-muted-foreground">{cxSulco === "lifegrow" ? "Life Grow" : "TSH"} · {num(calc.sulcoVolHa, 0)} L/ha · sem micros</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold">{num(calc.sulcoVolHa * meta.areaHa, 0)} L total</p>
                </div>
              </div>
            )}
            {calc.coberturaApps.map((app, i) => {
              const fora = app.vol > app.max || (app.min > 0 && app.vol < app.min);
              return (
                <div key={app.stage} className={`flex items-center justify-between py-2.5 border-b last:border-0 ${fora ? "bg-amber-50 -mx-2 px-2 rounded" : ""}`}>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {app.stage} — NitroPlus completo
                      {fora && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded">fora do limite</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {num(app.vol, 0)} L/ha
                      {i < 2 && app.vol <= 50 && <span className="ml-1 text-amber-600">(mín. 50 L/ha)</span>}
                      <span className="ml-1 opacity-60">(ref: {app.min > 0 ? `${app.min}–` : "máx "}{app.max} L/ha)</span>
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

        {/* Preços */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Preços de Insumos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <PrecoInput label="Ureia (R$/t)"          value={precos.ureia}      step="100"  onChange={v => setPrecos({...precos, ureia: v})} />
            <PrecoInput label="Life Grow (R$/L)"       value={precos.lifeGrow}   step="0.50" onChange={v => setPrecos({...precos, lifeGrow: v})} />
            <PrecoInput label="TSH (R$/L)"             value={precos.tsh}        step="0.50" onChange={v => setPrecos({...precos, tsh: v})} />
            <PrecoInput label="LEG (R$/L)"             value={precos.leg}        step="0.50" onChange={v => setPrecos({...precos, leg: v})} />
            <PrecoInput label="Ácido Bórico (R$/kg)"   value={precos.acidoBorico} step="0.5" onChange={v => setPrecos({...precos, acidoBorico: v})} />
            <PrecoInput label="Complex Bor (R$/L)"     value={precos.complexBor} step="1"    onChange={v => setPrecos({...precos, complexBor: v})} />
            <PrecoInput label="Estimull (R$/L)"        value={precos.estimull}   step="1"    onChange={v => setPrecos({...precos, estimull: v})} />
            <PrecoInput label="Amino+ (R$/L)"          value={precos.aminoplus}  step="1"    onChange={v => setPrecos({...precos, aminoplus: v})} />
            {possuiIon && <PrecoInput label="íON Complex (R$/L)" value={precos.ion} step="1" onChange={v => setPrecos({...precos, ion: v})} />}
          </div>
        </CardContent></Card>

        {/* Bateladas */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-3">Bateladas de Produção</p>
          <div className="max-w-xs mb-4">
            <Lbl t="Volume por batelada (L)"><Input type="number" value={volBatelada || ""} onFocus={e => e.target.select()} onChange={e => setVolBatelada(parseFloat(e.target.value) || 1000)} /></Lbl>
          </div>
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
            <p className="text-xs font-bold text-violet-700 mb-2">NitroPlus — {num(calc.volTotalL, 0)} L totais ({num(meta.areaHa, 0)} ha)</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcial > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcial, 0)} L</span>}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {num(calc.formula1000.ureia * vBat / 1000, 0)} kg Ureia + {num(calc.formula1000.leg * vBat / 1000, 1)} L LEG</p>
              <p>+ {num(estimullLHa * vBat / calc.volTotalHa * 1000, 0)} mL Estimull + {num(aminoLHa * vBat / calc.volTotalHa, 2)} L Amino+</p>
              <p>Completar com água até {num(vBat, 0)} L — misturar 1 hora</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Insumos e Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-xs text-muted-foreground">Ureia total</p><p className="font-bold">{num(calc.ureiaTotal / 1000, 3)} t</p></div>
            <div><p className="text-xs text-muted-foreground">LEG total</p><p className="font-bold">{num(calc.legTotal, 0)} L</p></div>
            {calc.borTotal > 0 && <div><p className="text-xs text-muted-foreground">Complex Bor</p><p className="font-bold">{num(calc.borTotal, 1)} L</p></div>}
            {calc.abTotal > 0  && <div><p className="text-xs text-muted-foreground">Ácido Bórico</p><p className="font-bold">{num(calc.abTotal, 1)} kg</p></div>}
            <div><p className="text-xs text-muted-foreground">Custo NitroPlus/ha</p><p className="font-bold text-violet-700">{moeda(calc.custoPorHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p><p className="font-bold text-primary">{moeda(calc.custoTotal)}</p></div>
          </div>
          <Button className="w-full mt-2 gap-2 bg-violet-600 hover:bg-violet-700" onClick={irParaRecomendacao}>
            <FileText className="h-4 w-4" />Gerar Recomendação
          </Button>
          <Button variant="outline" className="w-full mt-2 gap-2" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido Fertagro (LEG / BOR / Estimull / Amino+)
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
