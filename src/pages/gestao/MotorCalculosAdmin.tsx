/**
 * MotorCalculosAdmin — Edição das regras do motor de cálculos
 * Acessível em /app/gestao/motor-calculos-admin (Diretoria/ADM)
 *
 * Permite ao Cristiano editar todos os parâmetros do motor
 * (reduções, complexantes, receitas, preços) sem precisar de código.
 * Os valores são salvos no Supabase e usados por todos os calculadores.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Save, RotateCcw, FlaskConical, TrendingDown, DollarSign, Droplets,
  Atom, Info, Plus, Trash2,
} from "lucide-react";
import { useMotorConfig, MOTOR_DEFAULTS, type MotorParam, paramMap } from "@/lib/nutrir/useMotorConfig";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIAS: { id: string; label: string; icon: any; cor: string; descricao?: string }[] = [
  { id: "reducao",    label: "Reduções de Dose",    icon: TrendingDown,  cor: "text-amber-600",   descricao: "Fatores de substituição de adubação nitrogenada por N180" },
  { id: "complexante",label: "Complexantes",         icon: FlaskConical,  cor: "text-emerald-600", descricao: "Percentuais de TSH, Life Grow e LEG na calda" },
  { id: "receita",    label: "Receita N180",         icon: Atom,          cor: "text-primary",     descricao: "Proporção de ureia e concentração de N na calda N180" },
  { id: "boro",       label: "Boro",                 icon: Droplets,      cor: "text-sky-600",     descricao: "Teor de B no ácido bórico e fator do complexador Bor" },
  { id: "n32",        label: "N32 Foliar",           icon: FlaskConical,  cor: "text-violet-600",  descricao: "Parâmetros da adubação foliar nitrogenada (N32)" },
  { id: "n180b",      label: "N180 + Boro",          icon: Droplets,      cor: "text-cyan-600",    descricao: "Receita do sulco com boro: vazão, ácido bórico, Bor" },
  { id: "n32b",       label: "N32 + Boro",           icon: FlaskConical,  cor: "text-teal-600",    descricao: "Parâmetros da calda N32+B: ajuste N, LEG e fator boro" },
  { id: "npk",        label: "NPK Solo",             icon: Droplets,      cor: "text-orange-600",  descricao: "Máximos de sais e percentuais de TSH no NPK líquido" },
  { id: "precos",     label: "Preços Padrão",        icon: DollarSign,    cor: "text-rose-600",    descricao: "Preços de insumos para cálculo de custo nas calculadoras" },
  { id: "custom",     label: "Personalizados",       icon: Plus,          cor: "text-purple-600",  descricao: "Parâmetros adicionados manualmente pelo administrador" },
];

// ─── Componente de campo editável ─────────────────────────────────────────────
function ParamRow({
  param,
  onChange,
  isModified,
  onRemove,
}: {
  param: MotorParam;
  onChange: (chave: string, valor: number) => void;
  isModified: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isModified ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/40"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{param.label}</span>
          {isModified && <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/50 text-primary shrink-0">editado</Badge>}
          {param.categoria === "custom" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-400 text-purple-600 shrink-0">custom</Badge>
          )}
        </div>
        {param.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{param.descricao}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 font-mono">{param.chave}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-32">
          <Input
            type="number"
            step={param.unidade?.includes("R$") ? "0.01" : param.valor < 10 ? "0.01" : "1"}
            value={param.valor || ""}
            onFocus={e => e.target.select()}
            onChange={e => onChange(param.chave, parseFloat(e.target.value) || 0)}
            className="pr-12 text-right text-sm h-8"
          />
          {param.unidade && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
              {param.unidade.replace("R$/", "").replace("R$", "")}
            </span>
          )}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Preview de cálculo N180 ─────────────────────────────────────────────────
function PreviewN180({ cfg }: { cfg: Record<string, number> }) {
  const ex = { doseUreia: 200, areaHa: 100 };
  const reducao = (cfg.reducao_ureia_branca ?? 60) / 100;
  const ureiaReduzida = ex.doseUreia * (1 - reducao);
  const n180LHa = ureiaReduzida * 2.5;
  const precoUreia = cfg.preco_ureia_kg ?? 2.20;
  const precoTsh = cfg.preco_tsh_l ?? 16.5;
  const tshPctUreia = (cfg.tsh_pct_ureia ?? 15) / 100;
  const custoN180L = 0.4 * precoUreia + (tshPctUreia * 0.4) * precoTsh;
  const custoConvHa = ex.doseUreia * precoUreia;
  const custoN180Ha = n180LHa * custoN180L;
  const econPct = custoConvHa > 0 ? ((custoConvHa - custoN180Ha) / custoConvHa * 100) : 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm text-primary flex items-center gap-2">
          <Info className="w-4 h-4" /> Preview: Ureia branca 200 kg/ha · 100 ha (com TSH)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-2 bg-background rounded-lg border">
            <p className="text-xs text-muted-foreground">Ureia reduzida</p>
            <p className="font-bold">{fmt2(ureiaReduzida)} kg/ha</p>
          </div>
          <div className="p-2 bg-background rounded-lg border">
            <p className="text-xs text-muted-foreground">N180 necessário</p>
            <p className="font-bold text-primary">{fmt2(n180LHa)} L/ha</p>
          </div>
          <div className="p-2 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-muted-foreground">Custo ureia/ha</p>
            <p className="font-bold text-red-700">{fmtBRL(custoConvHa)}</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-muted-foreground">Custo N180/ha</p>
            <p className="font-bold text-emerald-700">{fmtBRL(custoN180Ha)}</p>
          </div>
        </div>
        <div className="mt-2 p-2 bg-emerald-100 rounded-lg text-center">
          <span className="text-sm font-bold text-emerald-800">
            Economia: {fmtBRL((custoConvHa - custoN180Ha) * ex.areaHa)} total
            &nbsp;·&nbsp; {fmt2(econPct)}% de redução/ha
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog: Novo Parâmetro ───────────────────────────────────────────────────
const CATEGORIAS_SELECT = [
  { id: "reducao",    label: "Reduções de Dose" },
  { id: "complexante",label: "Complexantes" },
  { id: "receita",    label: "Receita N180" },
  { id: "boro",       label: "Boro" },
  { id: "n32",        label: "N32 Foliar" },
  { id: "n180b",      label: "N180 + Boro" },
  { id: "n32b",       label: "N32 + Boro" },
  { id: "npk",        label: "NPK Solo" },
  { id: "precos",     label: "Preços Padrão" },
  { id: "custom",     label: "Personalizado" },
];

function NovoParamDialog({
  open,
  onClose,
  onAdd,
  existingChaves,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (param: MotorParam) => void;
  existingChaves: Set<string>;
}) {
  const [form, setForm] = useState<Partial<MotorParam>>({
    categoria: "custom",
    valor: 0,
    unidade: "",
    descricao: "",
  });
  const [erro, setErro] = useState("");

  const handleAdd = () => {
    if (!form.label?.trim()) return setErro("Informe o nome do parâmetro.");
    if (!form.chave?.trim()) return setErro("Informe a chave (identificador).");
    if (existingChaves.has(form.chave!)) return setErro("Já existe um parâmetro com essa chave.");
    onAdd({
      chave: form.chave!.trim().toLowerCase().replace(/\s+/g, "_"),
      categoria: form.categoria || "custom",
      label: form.label!.trim(),
      valor: form.valor ?? 0,
      unidade: form.unidade || undefined,
      descricao: form.descricao || undefined,
    });
    setForm({ categoria: "custom", valor: 0, unidade: "", descricao: "" });
    setErro("");
    onClose();
  };

  const autoChave = (label: string) =>
    label.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Novo Parâmetro do Motor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">Nome do parâmetro *</Label>
            <Input
              placeholder="Ex: TSH sobre KCl no N180+B"
              value={form.label || ""}
              onChange={e => {
                const label = e.target.value;
                setForm(f => ({
                  ...f,
                  label,
                  chave: f.chave || autoChave(label),
                }));
              }}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Chave (ID único) *</Label>
              <Input
                placeholder="Ex: tsh_pct_kcl_n180b"
                value={form.chave || ""}
                onChange={e => setForm(f => ({ ...f, chave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={form.categoria || "custom"}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                {CATEGORIAS_SELECT.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor padrão</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor ?? ""}
                onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Unidade (ex: %, L, kg/ha)</Label>
              <Input
                placeholder="%, L, kg, R$/L…"
                value={form.unidade || ""}
                onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input
              placeholder="Explique o que este parâmetro controla…"
              value={form.descricao || ""}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="mt-1"
            />
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Parâmetro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MotorCalculosAdmin() {
  const { params, loading, saving, save } = useMotorConfig();
  const [local, setLocal] = useState<MotorParam[] | null>(null);
  const [openNovo, setOpenNovo] = useState(false);

  // Usa local se editou, senão usa do banco
  const current = local ?? params;

  // Detecta quais chaves foram modificadas
  const savedMap   = useMemo(() => paramMap(params), [params]);
  const modifiedKeys = useMemo(
    () => new Set(current.filter(p => p.valor !== savedMap[p.chave]).map(p => p.chave)),
    [current, savedMap]
  );

  const existingChaves = useMemo(() => new Set(current.map(p => p.chave)), [current]);

  const handleChange = (chave: string, valor: number) => {
    setLocal(prev =>
      (prev ?? params).map(p => p.chave === chave ? { ...p, valor } : p)
    );
  };

  const handleAddParam = (param: MotorParam) => {
    setLocal(prev => [...(prev ?? params), param]);
    toast({ title: "Parâmetro adicionado!", description: "Clique em Salvar para confirmar." });
  };

  const handleRemoveCustom = (chave: string) => {
    if (!confirm("Remover este parâmetro personalizado?")) return;
    setLocal(prev => (prev ?? params).filter(p => p.chave !== chave));
  };

  const handleSave = async () => {
    const ok = await save(current);
    if (ok) {
      toast({ title: "Motor de cálculos salvo!", description: "Todas as calculadoras usarão os novos valores." });
      setLocal(null);
    } else {
      toast({ title: "Erro ao salvar", description: "Verifique a tabela nutrir_motor_config no Supabase.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setLocal(MOTOR_DEFAULTS.map(d => ({ ...d })));
    toast({ title: "Valores resetados para o padrão", description: "Clique em Salvar para confirmar." });
  };

  const cfg = useMemo(() => paramMap(current), [current]);

  // Parâmetros por categoria (inclui custom)
  const paramsPorCat = useMemo(() => {
    const map: Record<string, MotorParam[]> = {};
    for (const p of current) {
      const cat = p.categoria ?? "custom";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [current]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando configurações do motor…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" /> Regras do Motor de Cálculos
          </h1>
          <p className="text-sm text-muted-foreground">
            Edite os parâmetros de todas as fórmulas (N180, N180+B, N32, N32+B, NPK, Foliar).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setOpenNovo(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Parâmetro
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Resetar padrões
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || modifiedKeys.size === 0}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Salvando…" : `Salvar${modifiedKeys.size > 0 ? ` (${modifiedKeys.size})` : ""}`}
          </Button>
        </div>
      </div>

      {modifiedKeys.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          ⚠️ Você tem <strong>{modifiedKeys.size} parâmetro{modifiedKeys.size > 1 ? "s" : ""}</strong> editado{modifiedKeys.size > 1 ? "s" : ""} não salvos.
          Clique em <strong>Salvar</strong> para confirmar.
        </div>
      )}

      {/* Preview live */}
      <PreviewN180 cfg={cfg} />

      {/* Tabs por categoria */}
      <Tabs defaultValue="reducao">
        <TabsList className="flex-wrap h-auto gap-1">
          {CATEGORIAS.map(cat => {
            const catParams = paramsPorCat[cat.id] ?? [];
            if (catParams.length === 0 && cat.id !== "custom") return null;
            const count = catParams.filter(p => modifiedKeys.has(p.chave)).length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5 relative">
                <cat.icon className={`w-3.5 h-3.5 ${cat.cor}`} />
                {cat.label}
                {count > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIAS.map(cat => {
          const catParams = paramsPorCat[cat.id] ?? [];
          const isCustom = cat.id === "custom";
          return (
            <TabsContent key={cat.id} value={cat.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm flex items-center justify-between gap-2 ${cat.cor}`}>
                    <span className="flex items-center gap-2">
                      <cat.icon className="w-4 h-4" /> {cat.label}
                    </span>
                    {isCustom && (
                      <Button size="sm" variant="outline" onClick={() => setOpenNovo(true)} className="h-7 text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Novo
                      </Button>
                    )}
                  </CardTitle>
                  {cat.descricao && <p className="text-xs text-muted-foreground">{cat.descricao}</p>}
                </CardHeader>
                <CardContent className="space-y-1">
                  {catParams.map(param => (
                    <ParamRow
                      key={param.chave}
                      param={param}
                      onChange={handleChange}
                      isModified={modifiedKeys.has(param.chave)}
                      onRemove={isCustom ? () => handleRemoveCustom(param.chave) : undefined}
                    />
                  ))}
                  {catParams.length === 0 && (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">Nenhum parâmetro personalizado ainda.</p>
                      <Button size="sm" variant="outline" onClick={() => setOpenNovo(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar primeiro parâmetro
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dicas por categoria */}
              {cat.id === "reducao" && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <p><strong>Ureia Branca 60%:</strong> 200 kg → 80 kg restantes → 200 L de N180/ha</p>
                  <p><strong>Ureia Protegida 55%:</strong> 200 kg → 90 kg → 225 L de N180/ha</p>
                  <p><strong>Nitrato Amônio 45%:</strong> 275 kg/ha → reduz 45% = 49,5 kg N → 110 kg ureia equivalente</p>
                </div>
              )}
              {cat.id === "complexante" && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-1">
                  <p><strong>Fórmula para 1.000 L N180 (TSH):</strong> 400 L água + 400 kg ureia + 60 L TSH + água até completar</p>
                  <p><strong>Life Grow:</strong> 400 L água + 400 kg ureia + 75 L Life Grow + água</p>
                  <p><strong>LEG:</strong> 400 L água + 400 kg ureia + 25 L LEG + água</p>
                </div>
              )}
              {cat.id === "n180b" && (
                <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-800 space-y-1">
                  <p><strong>Receita do sulco (por 1.000 L):</strong> 400 L água + {cfg.n180b_bor_l_por_1000l ?? 7.5} L Bor + {cfg.n180b_ab_kg_por_1000l ?? 12} kg Ác. Bórico + 400 kg Ureia + complexante</p>
                  <p><strong>Boro no sulco:</strong> máx. {cfg.n180b_boro_sulco_g_ha ?? 80} g/ha · Vazão: {cfg.n180b_sulco_vazao_l_ha ?? 40} L/ha</p>
                </div>
              )}
              {cat.id === "n32b" && (
                <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 space-y-1">
                  <p><strong>Fórmula N32+B:</strong> N do produto × {cfg.n32b_n_ajuste_pct ?? 15}% de ajuste → converte em Ureia → {cfg.n32b_leg_pct_ureia ?? 18.75}% LEG sobre ureia</p>
                  <p><strong>Calda boro:</strong> Ácido bórico (kg) × {cfg.n32b_calda_boro_fator ?? 2.8} = volume de calda de boro (L/ha)</p>
                </div>
              )}
              {cat.id === "npk" && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 space-y-1">
                  <p><strong>Proporção máxima de sal na calda:</strong> 50% (500 kg/1.000 L)</p>
                  <p><strong>Ureia NPK:</strong> max {cfg.npk_ureia_max_1000l ?? 300} kg/1.000 L + {cfg.npk_tsh_pct_ureia ?? 12.5}% TSH</p>
                  <p><strong>KCl:</strong> max {cfg.npk_kcl_max_1000l ?? 200} kg/1.000 L + {cfg.npk_tsh_pct_kcl ?? 10}% TSH</p>
                  <p><strong>MAP:</strong> max {cfg.npk_map_max_1000l ?? 200} kg/1.000 L + {cfg.npk_tsh_pct_map ?? 10}% TSH</p>
                </div>
              )}
              {cat.id === "custom" && catParams.length > 0 && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
                  <p>Parâmetros personalizados são salvos no banco e ficam disponíveis para as calculadoras via <code className="font-mono">motorConfig</code>.</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Dialog novo parâmetro */}
      <NovoParamDialog
        open={openNovo}
        onClose={() => setOpenNovo(false)}
        onAdd={handleAddParam}
        existingChaves={existingChaves}
      />
    </div>
  );
}
