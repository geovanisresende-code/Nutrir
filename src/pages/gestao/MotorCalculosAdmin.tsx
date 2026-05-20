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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Save, RotateCcw, FlaskConical, TrendingDown, DollarSign, Droplets, Atom, Info } from "lucide-react";
import { useMotorConfig, MOTOR_DEFAULTS, type MotorParam, paramMap } from "@/lib/nutrir/useMotorConfig";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIAS: { id: string; label: string; icon: any; cor: string }[] = [
  { id: "reducao",    label: "Reduções de Dose",    icon: TrendingDown,  cor: "text-amber-600" },
  { id: "complexante",label: "Complexantes",         icon: FlaskConical,  cor: "text-emerald-600" },
  { id: "receita",    label: "Receita N180",         icon: Atom,          cor: "text-primary" },
  { id: "boro",       label: "Boro",                 icon: Droplets,      cor: "text-sky-600" },
  { id: "n32",        label: "N32 Foliar",           icon: FlaskConical,  cor: "text-violet-600" },
  { id: "npk",        label: "NPK Solo",             icon: Droplets,      cor: "text-orange-600" },
  { id: "precos",     label: "Preços Padrão",        icon: DollarSign,    cor: "text-rose-600" },
];

// ─── Componente de campo editável ─────────────────────────────────────────────
function ParamRow({
  param,
  onChange,
  isModified,
}: {
  param: MotorParam;
  onChange: (chave: string, valor: number) => void;
  isModified: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isModified ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/40"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{param.label}</span>
          {isModified && <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/50 text-primary shrink-0">editado</Badge>}
        </div>
        {param.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{param.descricao}</p>
        )}
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
      </div>
    </div>
  );
}

// ─── Preview de cálculo N180 ─────────────────────────────────────────────────
function PreviewN180({ cfg }: { cfg: Record<string, number> }) {
  const ex = { doseUreia: 200, areaHa: 100 };
  const reducao = (cfg.reducao_ureia_branca ?? 60) / 100;
  const ureiaReduzida = ex.doseUreia * (1 - reducao);
  const n180L = ureiaReduzida / (cfg.n180_ureia_kg_1000l ?? 400) * 1000 / 1; // simplificado: ureia/400*1000 → mas n180 = ureia*2.5
  // N180: 400kg ureia = 1000L N180 → 1 kg ureia = 2,5 L N180
  const n180LHa = ureiaReduzida * 2.5;
  const precoUreia = cfg.preco_ureia_kg ?? 2.20;
  const precoTsh = cfg.preco_tsh_l ?? 16.5;
  const tshPctUreia = (cfg.tsh_pct_ureia ?? 15) / 100;
  // Custo N180/L = 0,4 kg ureia × preço + tsh% × preço_tsh
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MotorCalculosAdmin() {
  const { params, loading, saving, save } = useMotorConfig();
  const [local, setLocal] = useState<MotorParam[] | null>(null);

  // Usa local se editou, senão usa do banco
  const current = local ?? params;

  // Detecta quais chaves foram modificadas
  const defaultMap = useMemo(() => Object.fromEntries(MOTOR_DEFAULTS.map(p => [p.chave, p.valor])), []);
  const savedMap   = useMemo(() => paramMap(params), [params]);
  const modifiedKeys = useMemo(
    () => new Set(current.filter(p => p.valor !== savedMap[p.chave]).map(p => p.chave)),
    [current, savedMap]
  );

  const handleChange = (chave: string, valor: number) => {
    setLocal(prev =>
      (prev ?? params).map(p => p.chave === chave ? { ...p, valor } : p)
    );
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
    toast({ title: "Valores resetados para o padrão do DOCX", description: "Clique em Salvar para confirmar." });
  };

  const cfg = useMemo(() => paramMap(current), [current]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando configurações do motor…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" /> Motor de Cálculos
          </h1>
          <p className="text-sm text-muted-foreground">
            Edite os parâmetros do motor. As calculadoras (N180, NPK, Foliar) usarão estes valores.
          </p>
        </div>
        <div className="flex gap-2">
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
            const count = current.filter(p => p.categoria === cat.id && modifiedKeys.has(p.chave)).length;
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

        {CATEGORIAS.map(cat => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm flex items-center gap-2 ${cat.cor}`}>
                  <cat.icon className="w-4 h-4" /> {cat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {current.filter(p => p.categoria === cat.id).map(param => (
                  <ParamRow
                    key={param.chave}
                    param={param}
                    onChange={handleChange}
                    isModified={modifiedKeys.has(param.chave)}
                  />
                ))}
                {current.filter(p => p.categoria === cat.id).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum parâmetro nesta categoria.</p>
                )}
              </CardContent>
            </Card>

            {/* Dica por categoria */}
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
            {cat.id === "npk" && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 space-y-1">
                <p><strong>Proporção máxima de sal na calda:</strong> 50% (500 kg/1.000 L)</p>
                <p><strong>Ureia NPK:</strong> max 300 kg/1.000 L + 12,5% TSH = 37,5 L TSH</p>
                <p><strong>KCl:</strong> max 200 kg/1.000 L + 10% TSH = 20 L TSH</p>
                <p><strong>MAP:</strong> max 200 kg/1.000 L + 10% TSH = 20 L TSH</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
