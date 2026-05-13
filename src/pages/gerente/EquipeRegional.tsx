import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Target, TrendingUp } from "lucide-react";
import { fmtBRL as formatCurrency } from "@/lib/nutrir/format";

type Colab = {
  id: string; nome: string; cargo: string; regional_id: string | null; ativo: boolean;
  meta_mensal: number | null; comissao_base_pct: number | null; superior_id: string | null;
};

export default function EquipeRegional() {
  const { current } = useOrg();
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [vendas, setVendas] = useState<Record<string, number>>({});
  const [visitas, setVisitas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const inicio = new Date(); inicio.setDate(1); inicio.setHours(0,0,0,0);
      const [c, p, v] = await Promise.all([
        (supabase as any).from("nutrir_colaboradores").select("id,nome,cargo,regional_id,ativo,meta_mensal,comissao_base_pct,superior_id").eq("organization_id", current.id).order("cargo"),
        (supabase as any).from("nutrir_pedidos").select("representante_id,total").eq("organization_id", current.id).gte("data_pedido", inicio.toISOString().slice(0,10)).in("status", ["confirmado","entregue","faturado"]),
        (supabase as any).from("nutrir_visitas").select("user_id").eq("organization_id", current.id).gte("data_visita", inicio.toISOString().slice(0,10)),
      ]);
      setColabs(c.data ?? []);
      const vendasMap: Record<string, number> = {};
      (p.data ?? []).forEach((row: any) => { if (row.representante_id) vendasMap[row.representante_id] = (vendasMap[row.representante_id] ?? 0) + Number(row.total ?? 0); });
      setVendas(vendasMap);
      const visMap: Record<string, number> = {};
      (v.data ?? []).forEach((row: any) => { if (row.user_id) visMap[row.user_id] = (visMap[row.user_id] ?? 0) + 1; });
      setVisitas(visMap);
      setLoading(false);
    })();
  }, [current?.id]);

  const cargoLabel = (c: string) => ({ diretor:"Diretor", gerente:"Gerente", rtv:"RTV", at:"Assistente Técnico", consultor:"Consultor" } as any)[c] ?? c;
  const grupos = colabs.reduce((acc, c) => { (acc[c.cargo] = acc[c.cargo] ?? []).push(c); return acc; }, {} as Record<string, Colab[]>);

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary"/>Equipe Regional</h1>
        <p className="text-muted-foreground text-sm">Indicadores do mês: visitas, vendas, meta e comissão.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
       colabs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum colaborador cadastrado ainda. Vá em <strong>Gestão → Colaboradores</strong> para começar.
        </CardContent></Card>
       ) : Object.entries(grupos).map(([cargo, lista]) => (
        <div key={cargo}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 mt-4">{cargoLabel(cargo)}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lista.map(c => {
              const venda = vendas[c.id] ?? 0;
              const meta = Number(c.meta_mensal ?? 0);
              const pctMeta = meta > 0 ? Math.min(100, (venda / meta) * 100) : 0;
              const comiss = venda * (Number(c.comissao_base_pct ?? 0) / 100);
              return (
                <Card key={c.id} className={!c.ativo ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{c.nome}</CardTitle>
                      {!c.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Visitas:</span><span className="font-medium">{visitas[c.id] ?? 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Vendas:</span><span className="font-medium">{formatCurrency(venda)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Meta:</span><span>{meta > 0 ? formatCurrency(meta) : "—"}</span></div>
                    {meta > 0 && (
                      <div className="mt-1">
                        <div className="h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pctMeta}%` }}/></div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Target className="w-3 h-3"/>{pctMeta.toFixed(0)}% da meta</p>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t mt-2"><span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3"/>Comissão est.:</span><span className="font-semibold text-primary">{formatCurrency(comiss)}</span></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
