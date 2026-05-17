import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { ArrowLeft, Package, Leaf, Droplets, Microscope, FlaskConical, FileText } from "lucide-react";

const CAT_COLORS: Record<string, string> = {
  DIAMANTE: "bg-cyan-50 text-cyan-800 border-cyan-300",
  OURO:     "bg-yellow-50 text-yellow-800 border-yellow-300",
  PRATA:    "bg-slate-50 text-slate-700 border-slate-300",
  BRONZE:   "bg-orange-50 text-orange-800 border-orange-300",
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 font-medium pt-0.5">{label}</span>
      <span className="text-sm flex-1 whitespace-pre-wrap">{value}</span>
    </div>
  );
}

export default function ProdutoFicha() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { current } = useOrg();
  const [prod, setProd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !current) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("nutrir_produtos")
        .select("*")
        .eq("id", id)
        .eq("organization_id", current.id)
        .maybeSingle();
      setProd(data);
      setLoading(false);
    })();
  }, [id, current?.id]);

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!prod) return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
      <p className="text-muted-foreground mt-4">Produto não encontrado.</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title={prod.nome}
        description={[prod.linha, prod.classificacao].filter(Boolean).join(" · ") || "Ficha técnica do produto"}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        <div className="grid md:grid-cols-3 gap-4">

          {/* Imagem */}
          <Card className="md:col-span-1">
            <CardContent className="p-3 flex items-center justify-center min-h-[200px]">
              {prod.imagem_url ? (
                <img
                  src={prod.imagem_url}
                  alt={prod.nome}
                  className="max-w-full max-h-64 object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Package className="h-16 w-16 opacity-20" />
                  <span className="text-xs">Sem imagem</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info rápida */}
          <Card className="md:col-span-2">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                {prod.categoria && (
                  <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${CAT_COLORS[prod.categoria] ?? ""}`}>
                    {prod.categoria}
                  </span>
                )}
                {prod.linha && <Badge variant="outline">{prod.linha}</Badge>}
                {!prod.ativo && <Badge variant="destructive">Inativo</Badge>}
              </div>

              {prod.codigo && (
                <div className="text-xs text-muted-foreground font-mono">Código: {prod.codigo}</div>
              )}

              {prod.descricao && (
                <p className="text-sm text-muted-foreground leading-relaxed">{prod.descricao}</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                {prod.dose_recomendada && (
                  <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
                    <div className="text-[10px] text-emerald-700 font-semibold uppercase">Dose recomendada</div>
                    <div className="text-sm font-medium text-emerald-900 mt-0.5">{prod.dose_recomendada}</div>
                  </div>
                )}
                {prod.classificacao && (
                  <div className="rounded-md bg-muted/40 border p-2">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase">Classificação</div>
                    <div className="text-sm font-medium mt-0.5">{prod.classificacao}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ficha técnica */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Ficha Técnica
            </div>
            <div>
              <InfoRow label="Modo de aplicação" value={prod.modo_aplicacao} />
              <InfoRow label="Recomendação de uso" value={prod.recomendacao_uso} />
              <InfoRow label="Garantias / Composição" value={prod.garantias} />
              <InfoRow label="Cultura indicada" value={prod.cultura_indicada} />
              <InfoRow label="Estágio recomendado" value={prod.estagio_recomendado} />
              <InfoRow label="Compatibilidade" value={prod.compatibilidade} />
              <InfoRow label="Observações" value={prod.observacoes} />
            </div>
          </CardContent>
        </Card>

        {/* Ícones de categoria de benefício */}
        {(prod.linha || prod.classificacao) && (
          <Card><CardContent className="p-4">
            <div className="text-sm font-semibold mb-3">Benefícios</div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {prod.linha?.toLowerCase().includes("n180") && (
                <div className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-primary" /> Nitrogênio Complexado</div>
              )}
              {prod.linha?.toLowerCase().includes("foliar") && (
                <div className="flex items-center gap-1.5"><Leaf className="h-4 w-4 text-emerald-600" /> Adubação Foliar</div>
              )}
              {prod.linha?.toLowerCase().includes("bio") && (
                <div className="flex items-center gap-1.5"><Microscope className="h-4 w-4 text-green-600" /> Biológico</div>
              )}
              {prod.linha?.toLowerCase().includes("micro") && (
                <div className="flex items-center gap-1.5"><Droplets className="h-4 w-4 text-blue-600" /> Micronutrientes</div>
              )}
            </div>
          </CardContent></Card>
        )}
      </div>
    </>
  );
}
