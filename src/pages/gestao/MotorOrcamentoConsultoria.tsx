import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calculator, Save, DollarSign, Percent, Beaker, Ruler } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/nutrir/precos-engine";

interface Params {
  id?: string;
  custo_amostra: number;
  meta_lucratividade: number;
  rendimento_ref_soja: number;
  piso_amostra: number;
  piso_hectare: number;
  grid_min_cereais: number;
}

const DEFAULT: Params = {
  custo_amostra: 350,
  meta_lucratividade: 45,
  rendimento_ref_soja: 8000,
  piso_amostra: 0,
  piso_hectare: 0,
  grid_min_cereais: 50,
};

export default function MotorOrcamentoConsultoria() {
  const { current } = useOrg();
  const [p, setP] = useState<Params>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("nutrir_parametros_consultoria")
        .select("*").eq("organization_id", current.id).maybeSingle();
      if (data) setP({ ...DEFAULT, ...data });
      setLoading(false);
    })();
  }, [current?.id]);

  const save = async () => {
    if (!current) return;
    setSaving(true);
    const payload = {
      organization_id: current.id,
      custo_amostra: p.custo_amostra,
      meta_lucratividade: p.meta_lucratividade,
      rendimento_ref_soja: p.rendimento_ref_soja,
      piso_amostra: p.piso_amostra,
      piso_hectare: p.piso_hectare,
      grid_min_cereais: p.grid_min_cereais,
    };
    const { error } = await (supabase as any)
      .from("nutrir_parametros_consultoria")
      .upsert(payload, { onConflict: "organization_id" });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parâmetros salvos" });
  };

  // Preview de cálculo
  const margemBruta = p.custo_amostra * (p.meta_lucratividade / 100);
  const precoFinalAmostra = p.custo_amostra + margemBruta;
  const precoPorHa = precoFinalAmostra / p.grid_min_cereais;

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" />
          Motor · Orçamento Consultoria
        </h1>
        <p className="text-muted-foreground text-sm">
          Define o custo da amostra e parâmetros usados no Painel Custo de Análise (visível somente ao ADM).
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Beaker className="w-4 h-4"/>Custo da Amostra</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Custo de cada amostra (R$)</Label>
              <Input type="number" step="0.01" value={p.custo_amostra}
                onChange={e => setP({ ...p, custo_amostra: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">Inclui laboratório, equipamento, depreciação, visita, impostos.</p>
            </div>
            <div>
              <Label>Piso mínimo por amostra (R$)</Label>
              <Input type="number" step="0.01" value={p.piso_amostra}
                onChange={e => setP({ ...p, piso_amostra: parseFloat(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4"/>Margem & Lucratividade</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Meta de lucratividade (%)</Label>
              <Input type="number" step="0.1" value={p.meta_lucratividade}
                onChange={e => setP({ ...p, meta_lucratividade: parseFloat(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">% aplicado sobre o custo total da amostra.</p>
            </div>
            <div>
              <Label>Piso mínimo por hectare (R$)</Label>
              <Input type="number" step="0.01" value={p.piso_hectare}
                onChange={e => setP({ ...p, piso_hectare: parseFloat(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ruler className="w-4 h-4"/>Grid & Referência</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Grid mínimo cereais (ha/amostra)</Label>
              <Input type="number" step="0.1" value={p.grid_min_cereais}
                onChange={e => setP({ ...p, grid_min_cereais: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Rendimento referência soja (kg/ha)</Label>
              <Input type="number" step="1" value={p.rendimento_ref_soja}
                onChange={e => setP({ ...p, rendimento_ref_soja: parseFloat(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4"/>Pré-visualização</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Custo amostra:</span><span className="font-mono">{formatBRL(p.custo_amostra)}</span></div>
            <div className="flex justify-between"><span>Margem bruta ({p.meta_lucratividade}%):</span><span className="font-mono">{formatBRL(margemBruta)}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Preço final / amostra:</span><span className="font-mono text-primary">{formatBRL(precoFinalAmostra)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Preço por hectare ({p.grid_min_cereais} ha/amostra):</span><span className="font-mono">{formatBRL(precoPorHa)}</span></div>
            <p className="text-xs text-muted-foreground pt-2">Esses valores aparecem no Painel Custo de Análise.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-2"/>{saving ? "Salvando…" : "Salvar parâmetros"}
        </Button>
      </div>
    </div>
  );
}
