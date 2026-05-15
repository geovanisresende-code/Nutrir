import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import { Plus, Trash2, ShoppingCart, FileSpreadsheet, CheckCircle2, MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";
import { toast } from "@/hooks/use-toast";
import AuditoriaStatusDialog from "@/components/nutrir/AuditoriaStatusDialog";

interface Orcamento {
  id: string; titulo: string; cliente_id: string | null;
  area_total_ha: number; total_geral: number; status: string;
  created_at: string;
}
interface Cliente { id: string; razao_social: string; }
interface Pedido { id: string; orcamento_origem_id: string | null; numero: string | null; }

export default function Orcamentos() {
  const { data: orcamentos, loading, reload } = useOrgTable<Orcamento>("nutrir_orcamentos", { orderBy: "created_at", ascending: false });
  const { data: clientes } = useOrgTable<Cliente>("nutrir_clientes", { select: "id,razao_social" });
  const { data: pedidos } = useOrgTable<Pedido>("nutrir_pedidos", { select: "id,orcamento_origem_id,numero" });

  const pedidoDe = (orcId: string) => pedidos.find(p => p.orcamento_origem_id === orcId);

  const excluir = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    await (supabase as any).from("nutrir_orcamento_itens").delete().eq("orcamento_id", id);
    await (supabase as any).from("nutrir_orcamentos").delete().eq("id", id);
    toast({ title: "Orçamento excluído" });
    reload();
  };

  const statusBadge = (o: Orcamento, ped?: Pedido) => {
    if (ped) return <Badge className="bg-[#c49a30] hover:bg-[#a07820]"><CheckCircle2 className="w-3 h-3 mr-1"/>Convertido</Badge>;
    if (o.status === "convertido") return <Badge className="bg-[#c49a30] hover:bg-[#a07820]">Convertido</Badge>;
    return <Badge variant="secondary">{o.status || "rascunho"}</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Orçamentos de Consultoria"
        description="Histórico de orçamentos salvos · conversão em pedido em 1 clique"
        actions={<Link to="/app/nutrir/orcamento"><Button><Plus className="w-4 h-4 mr-1"/>Novo orçamento</Button></Link>}
      />
      <div className="p-4 md:p-6">
        <Card className="overflow-x-auto"><div className="min-w-[640px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Título</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Área (ha)</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              : orcamentos.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum orçamento salvo</td></tr>
              : orcamentos.map(o => {
                const ped = pedidoDe(o.id);
                return (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/app/nutrir/orcamento?id=${o.id}`} className="hover:underline flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-primary"/>{o.titulo}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{clientes.find(c => c.id === o.cliente_id)?.razao_social ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(o.area_total_ha).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatBRL(o.total_geral)}</td>
                    <td className="px-3 py-2">{statusBadge(o, ped)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {ped ? (
                        <Link to={`/app/nutrir/pedidos`}>
                          <Button variant="ghost" size="sm" title="Ver pedido gerado">
                            <ShoppingCart className="w-4 h-4 mr-1"/>Ver pedido
                          </Button>
                        </Link>
                      ) : (
                        <Link to={`/app/nutrir/pedidos?from_orcamento=${o.id}`}>
                          <Button variant="ghost" size="sm" title="Converter em pedido">
                            <ShoppingCart className="w-4 h-4 mr-1"/>Converter
                          </Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" title="Enviar por WhatsApp" onClick={() => abrirWhatsApp({
                        contexto: "orcamento",
                        cliente: clientes.find(c => c.id === o.cliente_id)?.razao_social ?? null,
                        identificador: o.titulo,
                        total: Number(o.total_geral),
                        observacao: `Área total: ${Number(o.area_total_ha).toFixed(1)} ha`,
                      })}><MessageCircle className="w-4 h-4 text-[#b08826]"/></Button>
                      <AuditoriaStatusDialog entidade="orcamento" entidadeId={o.id} titulo={o.titulo} />
                      <Button variant="ghost" size="icon" onClick={() => excluir(o.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </>
  );
}
