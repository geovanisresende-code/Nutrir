import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Percent, Beaker, Ruler, Lock, Save, ShieldCheck } from "lucide-react";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/*
  Painel Custo de Análise
  ────────────────────────────────────────────
  Página de leitura para REPRESENTANTES / consultores: mostra o valor
  fixo da amostra calibrado pelo ADM e o preço final calculado.
  Edição da margem fica liberada SOMENTE para ADM/Diretor — qualquer
  outro papel vê em modo read-only e é redirecionado ao Motor para
  alterações estruturais.
*/

interface Params {
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

export default function PainelCustoAnalise() {
  const { current } = useOrg();
  const { isAdmin, isDirector, loading: rLoading } = useUserRole();
  const canEdit = isAdmin || isDirector;

  const [p, setP] = useState<Params>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMargem, setEditingMargem] = useState(false);

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

  const margemBruta = p.custo_amostra * (p.meta_lucratividade / 100);
  const precoFinalAmostra = p.custo_amostra + margemBruta;
  const precoPorHa = precoFinalAmostra / Math.max(1, p.grid_min_cereais);

  const saveMargem = async () => {
    if (!current || !canEdit) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("nutrir_parametros_consultoria")
      .upsert(
        { organization_id: current.id, meta_lucratividade: p.meta_lucratividade },
        { onConflict: "organization_id" }
      );
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Margem atualizada");
    setEditingMargem(false);
  };

  if (loading || rLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" />Painel Custo de Análise</span>}
        description="Valor de referência da amostra, definido pelo ADM. Utilizado em todos os orçamentos."
        actions={
          canEdit ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/app/gestao/orcamento-consultoria">
                <ShieldCheck className="w-4 h-4 mr-2" />Configurar parâmetros (Motor)
              </Link>
            </Button>
          ) : (
            <Badge variant="secondary" className="text-xs"><Lock className="w-3 h-3 mr-1" />Somente leitura</Badge>
          )
        }
      />

      <div className="p-3 md:p-6 space-y-4 max-w-5xl">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Custo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Beaker className="w-4 h-4" />Custo da Amostra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Custo unitário" value={formatBRL(p.custo_amostra)} />
              <Row label="Piso mínimo por amostra" value={formatBRL(p.piso_amostra)} subdued />
              <p className="text-xs text-muted-foreground pt-2">
                Inclui laboratório, depreciação, visita, impostos. Editado por ADM no Motor de Cálculos.
              </p>
            </CardContent>
          </Card>

          {/* Margem (editável p/ admins) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="w-4 h-4" />Margem & Lucratividade
                {canEdit && (
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {editingMargem ? "edição ativa" : "editar como ADM"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Meta de lucratividade (%)</Label>
                {canEdit && editingMargem ? (
                  <Input
                    type="number" step="0.1" value={p.meta_lucratividade}
                    onChange={e => setP({ ...p, meta_lucratividade: parseFloat(e.target.value) || 0 })}
                  />
                ) : (
                  <div className="text-2xl font-bold text-primary">{p.meta_lucratividade.toFixed(1)}%</div>
                )}
              </div>
              <Row label="Piso mínimo por hectare" value={formatBRL(p.piso_hectare)} subdued />
              {canEdit && (
                <div className="flex gap-2 pt-1">
                  {!editingMargem ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingMargem(true)}>
                      Alterar margem
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" onClick={saveMargem} disabled={saving}>
                        <Save className="w-3 h-3 mr-1" />{saving ? "Salvando…" : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingMargem(false)}>
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grid & referência */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ruler className="w-4 h-4" />Grid & Referência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Grid mínimo (cereais)" value={`${p.grid_min_cereais} ha/amostra`} />
              <Row label="Rendimento ref. soja" value={`${p.rendimento_ref_soja.toLocaleString("pt-BR")} kg/ha`} subdued />
            </CardContent>
          </Card>

          {/* Preço final calculado */}
          <Card className="bg-primary/5 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />Preço Calculado (utilizado nos orçamentos)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Custo amostra" value={formatBRL(p.custo_amostra)} subdued />
              <Row label={`Margem bruta (${p.meta_lucratividade}%)`} value={formatBRL(margemBruta)} subdued />
              <div className="border-t pt-2">
                <Row label="Preço final / amostra" value={formatBRL(precoFinalAmostra)} bold />
                <Row label={`Preço por ha (${p.grid_min_cereais} ha/amostra)`} value={formatBRL(precoPorHa) + " /ha"} subdued />
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Esse valor é aplicado automaticamente nos Orçamentos de Consultoria.
              </p>
            </CardContent>
          </Card>
        </div>

        {!canEdit && (
          <Card className="border-dashed">
            <CardContent className="py-4 text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Apenas o ADM/Diretor pode alterar o custo da amostra e parâmetros estruturais.
              Procure o responsável caso precise revisar esses valores.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

const Row = ({ label, value, subdued, bold }: { label: string; value: string; subdued?: boolean; bold?: boolean }) => (
  <div className={`flex justify-between items-baseline ${subdued ? "text-muted-foreground" : ""} ${bold ? "font-bold" : ""}`}>
    <span className="text-sm">{label}</span>
    <span className={`font-mono ${bold ? "text-base text-primary" : "text-sm"}`}>{value}</span>
  </div>
);
