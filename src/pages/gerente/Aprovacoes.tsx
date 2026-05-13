import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, FileText, Receipt, ShoppingCart } from "lucide-react";
import { fmtBRL as formatCurrency } from "@/lib/nutrir/format";

type Pendencia = {
  id: string;
  tipo: "orcamento" | "rdv" | "pedido";
  titulo: string;
  subtitulo: string;
  valor: number | null;
  data: string;
  status: string;
};

export default function Aprovacoes() {
  const { current } = useOrg();
  const [items, setItems] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [orcs, rdvs, peds] = await Promise.all([
      (supabase as any).from("nutrir_orcamentos").select("id,titulo,total_geral,created_at,status").eq("organization_id", current.id).eq("status", "rascunho").limit(50),
      (supabase as any).from("nutrir_rdv").select("id,descricao,valor,data,status,categoria").eq("organization_id", current.id).eq("status", "enviado").limit(50),
      (supabase as any).from("nutrir_pedidos").select("id,numero,total,data_pedido,status,desconto,subtotal").eq("organization_id", current.id).eq("status", "rascunho").limit(50),
    ]);
    const list: Pendencia[] = [];
    (orcs.data ?? []).forEach((o: any) => list.push({ id: o.id, tipo: "orcamento", titulo: o.titulo ?? "Orçamento", subtitulo: "Aguarda aprovação", valor: o.total_geral, data: o.created_at, status: o.status }));
    (rdvs.data ?? []).forEach((r: any) => list.push({ id: r.id, tipo: "rdv", titulo: r.descricao ?? "RDV", subtitulo: r.categoria ?? "—", valor: r.valor, data: r.data, status: r.status }));
    (peds.data ?? []).forEach((p: any) => list.push({ id: p.id, tipo: "pedido", titulo: `Pedido ${p.numero ?? ""}`, subtitulo: p.desconto > 0 ? `Desconto ${p.desconto}` : "Aguarda confirmação", valor: p.total, data: p.data_pedido, status: p.status }));
    setItems(list.sort((a, b) => +new Date(b.data) - +new Date(a.data)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [current?.id]);

  const decide = async (item: Pendencia, aprovado: boolean) => {
    const tabela = item.tipo === "orcamento" ? "nutrir_orcamentos" : item.tipo === "rdv" ? "nutrir_rdv" : "nutrir_pedidos";
    const novoStatus = aprovado
      ? (item.tipo === "rdv" ? "aprovado" : item.tipo === "pedido" ? "confirmado" : "aprovado")
      : (item.tipo === "rdv" ? "rejeitado" : "cancelado");
    const patch: any = { status: novoStatus };
    if (item.tipo === "rdv") { patch.reviewed_at = new Date().toISOString(); }
    const { error } = await (supabase as any).from(tabela).update(patch).eq("id", item.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: aprovado ? "Aprovado" : "Rejeitado" });
    load();
  };

  const filtered = (tipo: string) => tipo === "todos" ? items : items.filter(i => i.tipo === tipo);
  const icon = (t: string) => t === "orcamento" ? <FileText className="w-4 h-4" /> : t === "rdv" ? <Receipt className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-primary"/>Aprovações Pendentes</h1>
        <p className="text-muted-foreground text-sm">Revise orçamentos, RDV e pedidos da equipe.</p>
      </div>

      <Tabs defaultValue="todos">
        <TabsList>
          <TabsTrigger value="todos">Todos ({items.length})</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamentos ({items.filter(i=>i.tipo==='orcamento').length})</TabsTrigger>
          <TabsTrigger value="rdv">RDV ({items.filter(i=>i.tipo==='rdv').length})</TabsTrigger>
          <TabsTrigger value="pedido">Pedidos ({items.filter(i=>i.tipo==='pedido').length})</TabsTrigger>
        </TabsList>
        {["todos","orcamento","rdv","pedido"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-2 mt-4">
            {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
             filtered(tab).length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma pendência.</CardContent></Card>
            ) : filtered(tab).map(item => (
              <Card key={item.tipo+item.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-muted">{icon(item.tipo)}</div>
                    <div>
                      <CardTitle className="text-base">{item.titulo}</CardTitle>
                      <p className="text-xs text-muted-foreground">{item.subtitulo} · {new Date(item.data).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.valor != null && <p className="font-semibold">{formatCurrency(item.valor)}</p>}
                    <Badge variant="outline" className="mt-1">{item.tipo}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => decide(item, true)}><CheckCircle2 className="w-4 h-4 mr-1"/>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(item, false)}><XCircle className="w-4 h-4 mr-1"/>Rejeitar</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
