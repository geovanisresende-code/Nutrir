import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable, useOrgTable } from "@/lib/nutrir/useNutrirData";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { FlaskConical, ShoppingCart, Droplets } from "lucide-react";

interface Cultura { id: string; nome: string; }
interface MP { id: string; codigo: string | null; nome: string; preco_atual: number | null; unidade_preco: string; ativo: boolean; }
interface Complexador { id: string; nome: string; preco_litro: number; ativo: boolean; }

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

// K180: 180 g K₂O/L → KCl 60% K₂O → 0,300 kg KCl por L
const KCL_KG_PER_L_K180  = 0.180 / 0.60; // 0,300

const CULTURAS_FALLBACK = ["Soja","Milho","Cana-de-açúcar","Café","Algodão","Laranja","Arroz","Eucalipto"];

// ── Componentes menores ─────────────────────────────────────────
function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground block mb-1">{t}</label>{children}</div>;
}
function PrecoInput({ value, onChange, label, step = "1" }: { value: number; onChange: (v: number) => void; label: string; step?: string }) {
  return (
    <Lbl t={label}>
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground px-2 border border-r-0 rounded-l-md h-10 flex items-center bg-muted shrink-0">R$</span>
        <Input
          type="number"
          step={step}
          value={value || ""}
          onFocus={e => e.target.select()}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="rounded-l-none"
        />
      </div>
    </Lbl>
  );
}

// ── Página Principal ────────────────────────────────────────────
export default function CalculadoraN180() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: mps, loading: mpsLoading } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: complexadores, loading: cmpLoading } = useGlobalTable<Complexador>("nutrir_complexadores", "nome");
  const { params, loading: cfgLoading } = useMotorConfig();
  const [precoInit, setPrecoInit] = useState(false);

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [n180, setN180] = useState({
    doseHa: 175,            // L/ha
    lifeGrowLper1000: 8.75, // L de Life Grow por 1000 L de N180
    precoUreia: 4000,       // R$/t (será sobrescrito pelo motor config)
    precoLifeGrow: 25,      // R$/L
  });
  const [k180, setK180] = useState({
    doseHa: 270,            // L/ha
    tshLper1000: 8.1,       // L de TSH por 1000 L de K180
    precoKcl: 2800,         // R$/t
    precoTsh: 16.5,         // R$/L
  });
  const [volBatelada, setVolBatelada] = useState(6000);

  // ── Inicializa preços: nutrir_materias_primas > nutrir_complexadores > motor_config ──
  useEffect(() => {
    if (precoInit) return;
    if (cfgLoading || mpsLoading || cmpLoading) return;

    const cfg = paramMap(params);

    // Matérias-primas pelo código
    const byCode = (cod: string) => mps.find(m => m.codigo?.toUpperCase() === cod && m.ativo && m.preco_atual != null);
    const urb = byCode("URB");
    const kcl = byCode("KCL");

    // Complexadores pelo nome
    const byCmp = (nome: string) => complexadores.find(c => c.nome.toLowerCase().includes(nome.toLowerCase()) && c.ativo);
    const lifeGrow = byCmp("Life Grow") ?? byCmp("lifegrow");
    const tsh = byCmp("TSH");

    setN180(p => ({
      ...p,
      // Ureia: MP (R$/kg → R$/t) > motor_config > default
      precoUreia: urb?.preco_atual != null
        ? urb.preco_atual * 1000
        : cfg.preco_ureia_kg ? cfg.preco_ureia_kg * 1000 : p.precoUreia,
      // Life Grow: complexador > motor_config > default
      precoLifeGrow: lifeGrow?.preco_litro ?? cfg.preco_lifegrow_l ?? p.precoLifeGrow,
    }));

    setK180(p => ({
      ...p,
      // KCl: MP (R$/kg → R$/t) > motor_config > default
      precoKcl: kcl?.preco_atual != null
        ? kcl.preco_atual * 1000
        : cfg.preco_kcl_kg ? cfg.preco_kcl_kg * 1000 : p.precoKcl,
      // TSH: complexador > motor_config > default
      precoTsh: tsh?.preco_litro ?? cfg.preco_tsh_l ?? p.precoTsh,
    }));

    setPrecoInit(true);
  }, [cfgLoading, mpsLoading, cmpLoading, precoInit, params, mps, complexadores]);

  // Ureia por litro de N180 — vem do motor config (padrão 400 kg/1000L = 0,400 kg/L)
  const ureiaKgPerLN180 = useMemo(() => {
    const cfg = paramMap(params);
    return (cfg.n180_ureia_kg_1000l ?? 400) / 1000;
  }, [params]);

  // ── Cálculos N180 ───────────────────────────────────────────
  const n180c = useMemo(() => {
    const ureiaKgHa    = ureiaKgPerLN180 * n180.doseHa;
    const lifeGrowLHa  = (n180.lifeGrowLper1000 / 1000) * n180.doseHa;
    const custoUreia   = ureiaKgHa * n180.precoUreia / 1000;
    const custoLG      = lifeGrowLHa * n180.precoLifeGrow;
    const custoPorHa   = custoUreia + custoLG;
    const volTotal     = n180.doseHa * meta.areaHa;
    const ureiaTotal   = ureiaKgHa * meta.areaHa;
    const lifeGrowTotal = lifeGrowLHa * meta.areaHa;
    const custoTotal   = custoPorHa * meta.areaHa;
    return { ureiaKgHa, lifeGrowLHa, custoUreia, custoLG, custoPorHa, volTotal, ureiaTotal, lifeGrowTotal, custoTotal };
  }, [n180, meta, ureiaKgPerLN180]);

  // ── Cálculos K180 ───────────────────────────────────────────
  const k180c = useMemo(() => {
    const kclKgHa    = KCL_KG_PER_L_K180 * k180.doseHa;
    const tshLHa     = (k180.tshLper1000 / 1000) * k180.doseHa;
    const custoKcl   = kclKgHa * k180.precoKcl / 1000;
    const custoTsh   = tshLHa * k180.precoTsh;
    const custoPorHa = custoKcl + custoTsh;
    const volTotal   = k180.doseHa * meta.areaHa;
    const kclTotal   = kclKgHa * meta.areaHa;
    const tshTotal   = tshLHa * meta.areaHa;
    const custoTotal = custoPorHa * meta.areaHa;
    return { kclKgHa, tshLHa, custoKcl, custoTsh, custoPorHa, volTotal, kclTotal, tshTotal, custoTotal };
  }, [k180, meta]);

  const custoPorHa = n180c.custoPorHa + k180c.custoPorHa;
  const custoTotal = n180c.custoTotal + k180c.custoTotal;

  // ── Bateladas ────────────────────────────────────────────────
  const batN180Cheias  = Math.floor(n180c.volTotal / volBatelada);
  const batN180Parcial = Math.round(n180c.volTotal % volBatelada);
  const batK180Cheias  = Math.floor(k180c.volTotal / volBatelada);
  const batK180Parcial = Math.round(k180c.volTotal % volBatelada);

  // ── Gerar Pedido ─────────────────────────────────────────────
  const irParaPedido = () => {
    const itens = [
      { produto_nome: "Ureia Branca", quantidade: Math.ceil(n180c.ureiaTotal), unidade: "kg", preco_unitario: n180.precoUreia / 1000 },
      { produto_nome: "Life Grow",    quantidade: Math.ceil(n180c.lifeGrowTotal), unidade: "L",  preco_unitario: n180.precoLifeGrow },
      { produto_nome: "KCl",          quantidade: Math.ceil(k180c.kclTotal),     unidade: "kg", preco_unitario: k180.precoKcl / 1000 },
      { produto_nome: "TSH",          quantidade: Math.ceil(k180c.tshTotal),     unidade: "L",  preco_unitario: k180.precoTsh },
    ];
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_n180",
      titulo: `N180/K180 — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha: meta.areaHa,
      observacoes: `Produção TPD N180+K180 · ${meta.cultura} · ${meta.areaHa} ha`,
      itens,
    }));
    navigate("/app/rep/pedidos");
  };

  const listaCulturas = culturas.length > 0 ? culturas.map(c => c.nome) : CULTURAS_FALLBACK;
  const fontePrecosMsg = mps.length > 0
    ? `✓ Preços carregados do banco (${mps.length} mat. primas · ${complexadores.length} complexantes)`
    : "⚠ Cadastre matérias-primas e complexantes para carregar preços automáticos";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        title={<span className="flex items-center gap-2"><FlaskConical className="w-5 h-5 text-primary"/>Calculadora N180 / K180</span> as any}
        description="Produção de fertilizante líquido na fazenda · bateladas · lista de compras"
        actions={
          <Button onClick={irParaPedido} className="gap-1.5">
            <ShoppingCart className="w-4 h-4" />Criar Pedido
          </Button>
        }
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
              <Input value={meta.produtor} onChange={e => setMeta({...meta, produtor: e.target.value})} placeholder="Nome do produtor" />
            </Lbl>
            <Lbl t="Fazenda">
              <Input value={meta.fazenda} onChange={e => setMeta({...meta, fazenda: e.target.value})} placeholder="Nome da fazenda" />
            </Lbl>
            <Lbl t="Cultura">
              <Select value={meta.cultura} onValueChange={v => setMeta({...meta, cultura: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {listaCulturas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Lbl>
            <Lbl t="Área (ha)">
              <Input type="number" value={meta.areaHa || ""} onFocus={e => e.target.select()}
                onChange={e => setMeta({...meta, areaHa: parseFloat(e.target.value) || 0})} />
            </Lbl>
          </div>
        </CardContent></Card>

        {/* N180 */}
        <Card className="border-green-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-green-700" />
            <p className="text-sm font-semibold text-green-700">N180 — Nitrogênio Líquido</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Ureia branca + Life Grow + água · 180 g N/L · Ureia = 0,400 kg/L</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Lbl t="Dose (L/ha)">
              <Input type="number" value={n180.doseHa || ""} onFocus={e => e.target.select()}
                onChange={e => setN180({...n180, doseHa: parseFloat(e.target.value) || 0})} />
            </Lbl>
            <Lbl t="Life Grow (L / 1.000 L N180)">
              <Input type="number" step="0.01" value={n180.lifeGrowLper1000 || ""} onFocus={e => e.target.select()}
                onChange={e => setN180({...n180, lifeGrowLper1000: parseFloat(e.target.value) || 0})} />
            </Lbl>
            <PrecoInput label="Ureia (R$/t)" value={n180.precoUreia} step="100"
              onChange={v => setN180({...n180, precoUreia: v})} />
            <PrecoInput label="Life Grow (R$/L)" value={n180.precoLifeGrow} step="0.50"
              onChange={v => setN180({...n180, precoLifeGrow: v})} />
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-green-50 rounded-lg text-xs">
            <div><p className="text-muted-foreground">Ureia/ha</p><p className="font-bold">{num(n180c.ureiaKgHa)} kg</p></div>
            <div><p className="text-muted-foreground">Life Grow/ha</p><p className="font-bold">{num(n180c.lifeGrowLHa)} L</p></div>
            <div><p className="text-muted-foreground">Custo N180/ha</p><p className="font-bold text-green-700">{moeda(n180c.custoPorHa)}</p></div>
            <div><p className="text-muted-foreground">Volume total</p><p className="font-bold">{num(n180c.volTotal, 0)} L</p></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground px-1">
            <div>Ureia total: <span className="font-semibold text-foreground">{num(n180c.ureiaTotal / 1000, 3)} t</span></div>
            <div>Life Grow total: <span className="font-semibold text-foreground">{num(n180c.lifeGrowTotal, 0)} L</span></div>
          </div>
        </CardContent></Card>

        {/* K180 */}
        <Card className="border-sky-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="w-4 h-4 text-sky-700" />
            <p className="text-sm font-semibold text-sky-700">K180 — Potássio Líquido</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">KCl + TSH + água · 180 g K₂O/L · KCl = 0,300 kg/L</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Lbl t="Dose (L/ha)">
              <Input type="number" value={k180.doseHa || ""} onFocus={e => e.target.select()}
                onChange={e => setK180({...k180, doseHa: parseFloat(e.target.value) || 0})} />
            </Lbl>
            <Lbl t="TSH (L / 1.000 L K180)">
              <Input type="number" step="0.01" value={k180.tshLper1000 || ""} onFocus={e => e.target.select()}
                onChange={e => setK180({...k180, tshLper1000: parseFloat(e.target.value) || 0})} />
            </Lbl>
            <PrecoInput label="KCl (R$/t)" value={k180.precoKcl} step="100"
              onChange={v => setK180({...k180, precoKcl: v})} />
            <PrecoInput label="TSH (R$/L)" value={k180.precoTsh} step="0.50"
              onChange={v => setK180({...k180, precoTsh: v})} />
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-sky-50 rounded-lg text-xs">
            <div><p className="text-muted-foreground">KCl/ha</p><p className="font-bold">{num(k180c.kclKgHa)} kg</p></div>
            <div><p className="text-muted-foreground">TSH/ha</p><p className="font-bold">{num(k180c.tshLHa)} L</p></div>
            <div><p className="text-muted-foreground">Custo K180/ha</p><p className="font-bold text-sky-700">{moeda(k180c.custoPorHa)}</p></div>
            <div><p className="text-muted-foreground">Volume total</p><p className="font-bold">{num(k180c.volTotal, 0)} L</p></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground px-1">
            <div>KCl total: <span className="font-semibold text-foreground">{num(k180c.kclTotal / 1000, 3)} t</span></div>
            <div>TSH total: <span className="font-semibold text-foreground">{num(k180c.tshTotal, 0)} L</span></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-bold text-green-700 mb-2">N180 — {num(n180c.volTotal, 0)} L totais</p>
              <p className="text-sm font-semibold">
                {batN180Cheias} batelada{batN180Cheias !== 1 ? "s" : ""} de {num(volBatelada, 0)} L
                {batN180Parcial > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batN180Parcial, 0)} L</span>}
              </p>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <p>Por batelada: {num(n180c.ureiaKgHa / n180.doseHa * volBatelada, 1)} kg ureia + {num(n180c.lifeGrowLHa / n180.doseHa * volBatelada, 1)} L Life Grow</p>
                <p>Completar com água até {num(volBatelada, 0)} L</p>
              </div>
            </div>
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <p className="text-xs font-bold text-sky-700 mb-2">K180 — {num(k180c.volTotal, 0)} L totais</p>
              <p className="text-sm font-semibold">
                {batK180Cheias} batelada{batK180Cheias !== 1 ? "s" : ""} de {num(volBatelada, 0)} L
                {batK180Parcial > 0 && <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batK180Parcial, 0)} L</span>}
              </p>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <p>Por batelada: {num(k180c.kclKgHa / k180.doseHa * volBatelada, 1)} kg KCl + {num(k180c.tshLHa / k180.doseHa * volBatelada, 1)} L TSH</p>
                <p>Completar com água até {num(volBatelada, 0)} L</p>
              </div>
            </div>
          </div>
        </CardContent></Card>

        {/* Resumo + CTA */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">N180/ha</p><p className="font-bold text-green-700">{moeda(n180c.custoPorHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">K180/ha</p><p className="font-bold text-sky-700">{moeda(k180c.custoPorHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total/ha (N+K)</p><p className="font-bold text-primary">{moeda(custoPorHa)}</p></div>
            <div><p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p><p className="font-bold">{moeda(custoTotal)}</p></div>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />
            Gerar Pedido com estes insumos
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
