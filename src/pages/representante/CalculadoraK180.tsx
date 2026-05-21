import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useGlobalTable, useOrgTable } from "@/lib/nutrir/useNutrirData";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { FlaskRound, ShoppingCart } from "lucide-react";

interface Cultura { id: string; nome: string; }
interface MP { id: string; codigo: string | null; nome: string; preco_atual: number | null; unidade_preco: string; ativo: boolean; }
interface Complexador { id: string; nome: string; preco_litro: number; ativo: boolean; }

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num   = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

const CULTURAS_FALLBACK = ["Soja", "Milho", "Cana-de-açúcar", "Café", "Algodão", "Laranja", "Arroz", "Eucalipto"];

// K180: KCl = 0,300 kg por litro de K180
// Recipe per 1.000 L: water + 300 kg KCl + TSH L + water to 1.000 L
const KCL_KG_PER_L = 0.300;

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

export default function CalculadoraK180() {
  const navigate = useNavigate();
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: mps, loading: mpsLoading } = useOrgTable<MP>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: complexadores, loading: cmpLoading } = useOrgTable<Complexador>("nutrir_complexadores", { orderBy: "nome" });
  const { params, loading: cfgLoading } = useMotorConfig();
  const [precoInit, setPrecoInit] = useState(false);

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [k180, setK180] = useState({
    doseHa:          270,    // L/ha de K180
    tshLper1000:     8.1,    // L de TSH por 1.000 L de K180
    precoKcl:        2800,   // R$/t
    precoTsh:        18.0,   // R$/L
  });
  const [volBatelada, setVolBatelada] = useState(6000);

  // Carrega preços do motor / matérias-primas
  useEffect(() => {
    if (precoInit || cfgLoading || mpsLoading || cmpLoading) return;
    const cfg    = paramMap(params);
    const byCode = (cod: string) => mps.find(m => m.codigo?.toUpperCase() === cod && m.ativo && m.preco_atual != null);
    const byCmp  = (nome: string) => complexadores.find(c => c.nome.toLowerCase().includes(nome.toLowerCase()) && c.ativo);
    const kcl    = byCode("KCL") ?? byCode("KCl");
    const tsh    = byCmp("TSH");
    setK180(p => ({
      ...p,
      precoKcl: kcl?.preco_atual != null ? kcl.preco_atual * 1000 : cfg.preco_kcl_kg ? cfg.preco_kcl_kg * 1000 : p.precoKcl,
      precoTsh: tsh?.preco_litro ?? cfg.preco_tsh_l ?? p.precoTsh,
    }));
    setPrecoInit(true);
  }, [cfgLoading, mpsLoading, cmpLoading, precoInit, params, mps, complexadores]);

  const k180c = useMemo(() => {
    const kclKgHa  = KCL_KG_PER_L * k180.doseHa;                         // kg KCl/ha
    const tshLHa   = (k180.tshLper1000 / 1000) * k180.doseHa;            // L TSH/ha
    const custoKcl = kclKgHa * k180.precoKcl / 1000;                     // R$/ha
    const custoTsh = tshLHa  * k180.precoTsh;                             // R$/ha
    const custoPorHa = custoKcl + custoTsh;

    const area       = meta.areaHa || 0;
    const volTotal   = k180.doseHa * area;
    const kclTotal   = kclKgHa    * area;
    const tshTotal   = tshLHa     * area;
    const custoTotal = custoPorHa * area;

    return { kclKgHa, tshLHa, custoKcl, custoTsh, custoPorHa, volTotal, kclTotal, tshTotal, custoTotal };
  }, [k180, meta.areaHa]);

  const vBat         = Math.max(volBatelada, 100);
  const batCheias    = Math.floor(k180c.volTotal / vBat);
  const batParcialV  = Math.round(k180c.volTotal % vBat);

  // Receita por vBat litros
  const kclPorBat = KCL_KG_PER_L * vBat;
  const tshPorBat = (k180.tshLper1000 / 1000) * vBat;

  const irParaPedido = () => {
    const itens = [
      { produto_nome: "KCl",  quantidade: Math.ceil(k180c.kclTotal), unidade: "kg", preco_unitario: k180.precoKcl / 1000 },
      { produto_nome: "TSH",  quantidade: Math.ceil(k180c.tshTotal), unidade: "L",  preco_unitario: k180.precoTsh },
    ];
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem:       "calc_k180",
      titulo:       `K180 — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha:      meta.areaHa,
      observacoes:  `Produção TPD K180 · ${meta.cultura} · ${meta.areaHa} ha`,
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
        title={<span className="flex items-center gap-2"><FlaskRound className="w-5 h-5 text-primary" />K180 — Potássio Líquido</span> as any}
        description="KCl + TSH + água · 180 g K₂O/L · KCl = 0,300 kg/L"
        actions={<Button onClick={irParaPedido} className="gap-1.5"><ShoppingCart className="w-4 h-4" />Criar Pedido</Button>}
      />

      <div className="px-4 space-y-4">

        {/* Identificação */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">Identificação</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${mps.length > 0 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>
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

        {/* K180 */}
        <Card className="border-orange-200"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1">
            <FlaskRound className="w-4 h-4 text-orange-700" />
            <p className="text-sm font-semibold text-orange-700">K180 — Potássio Líquido</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">KCl + TSH + água · 180 g K₂O/L · KCl = 0,300 kg/L</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Lbl t="Dose (L/ha)">
              <Input type="number" value={k180.doseHa || ""} onFocus={e => e.target.select()}
                onChange={e => setK180({ ...k180, doseHa: parseFloat(e.target.value) || 0 })} />
            </Lbl>
            <Lbl t="TSH (L / 1.000 L K180)">
              <Input type="number" step="0.1" value={k180.tshLper1000 || ""} onFocus={e => e.target.select()}
                onChange={e => setK180({ ...k180, tshLper1000: parseFloat(e.target.value) || 0 })} />
            </Lbl>
            <PrecoInput label="KCl (R$/t)"    value={k180.precoKcl} step="100"  onChange={v => setK180({ ...k180, precoKcl: v })} />
            <PrecoInput label="TSH (R$/L)"    value={k180.precoTsh} step="0.50" onChange={v => setK180({ ...k180, precoTsh: v })} />
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-orange-50 rounded-lg text-xs">
            <div>
              <p className="text-muted-foreground">KCl/ha</p>
              <p className="font-bold">{num(k180c.kclKgHa, 1)} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">TSH/ha</p>
              <p className="font-bold">{num(k180c.tshLHa, 1)} L</p>
            </div>
            <div>
              <p className="text-muted-foreground">Custo K180/ha</p>
              <p className="font-bold text-orange-700">{moeda(k180c.custoPorHa)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Volume total</p>
              <p className="font-bold">{num(k180c.volTotal, 0)} L</p>
            </div>
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
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-bold text-orange-700 mb-2">K180 — {num(k180c.volTotal, 0)} L totais</p>
            <p className="text-sm font-semibold">
              {batCheias} batelada{batCheias !== 1 ? "s" : ""} de {num(vBat, 0)} L
              {batParcialV > 0 && (
                <span className="text-muted-foreground font-normal"> + 1 parcial de {num(batParcialV, 0)} L</span>
              )}
            </p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Por batelada: {num(kclPorBat, 0)} kg KCl + {num(tshPorBat, 1)} L TSH</p>
              <p>Completar com água até {num(vBat, 0)} L</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Fórmula por 1.000 L */}
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold text-primary mb-2">Fórmula por 1.000 L de K180</p>
          <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
            <p>• {num(KCL_KG_PER_L * 1000, 0)} kg KCl</p>
            <p>• {num(k180.tshLper1000, 1)} L TSH</p>
            <p>• Completar com água até 1.000 L</p>
          </div>
        </CardContent></Card>

        {/* Resumo */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo de Custos</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Custo K180/ha</p>
              <p className="font-bold text-orange-700">{moeda(k180c.custoPorHa)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total {num(meta.areaHa, 0)} ha</p>
              <p className="font-bold text-primary">{moeda(k180c.custoTotal)}</p>
            </div>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={irParaPedido}>
            <ShoppingCart className="h-4 w-4" />Gerar Pedido com estes insumos
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
