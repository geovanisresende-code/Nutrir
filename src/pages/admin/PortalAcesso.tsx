import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Power, Link as LinkIcon } from "lucide-react";

export default function PortalAcesso() {
  const { current } = useOrg();
  const [tokens, setTokens] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [expira, setExpira] = useState("");

  const load = async () => {
    if (!current) return;
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("nutrir_portal_tokens" as any).select("*").eq("organization_id", current.id).order("created_at", { ascending: false }),
      supabase.from("nutrir_clientes" as any).select("id,razao_social,nome_fantasia").eq("organization_id", current.id).limit(500),
    ]);
    setTokens((t as any) ?? []);
    setClientes((c as any) ?? []);
  };
  useEffect(() => { load(); }, [current?.id]);

  const gerar = async () => {
    if (!current || !clienteId) { toast.error("Selecione um cliente"); return; }
    await supabase.from("nutrir_portal_tokens" as any).insert({
      organization_id: current.id, cliente_id: clienteId,
      expira_em: expira ? new Date(expira).toISOString() : null,
    });
    toast.success("Token gerado");
    setClienteId(""); setExpira("");
    load();
  };

  const link = (token: string) => `${window.location.origin}/portal/${token}`;
  const copiar = (token: string) => { navigator.clipboard.writeText(link(token)); toast.success("Link copiado"); };
  const toggle = async (id: string, ativo: boolean) => { await supabase.from("nutrir_portal_tokens" as any).update({ ativo: !ativo }).eq("id", id); load(); };

  const nomeCliente = (id: string) => { const c = clientes.find(x => x.id === id); return c ? (c.nome_fantasia || c.razao_social) : id.slice(0, 8); };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Portal do Cliente — Acessos</h1>
        <p className="text-sm text-muted-foreground">Gere links únicos para clientes acessarem pedidos, boletos e dados</p>
      </div>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-3 gap-3 items-end">
          <div><Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Expiração (opcional)</Label><Input type="date" value={expira} onChange={e => setExpira(e.target.value)} /></div>
          <Button onClick={gerar}><Plus className="h-4 w-4 mr-1" />Gerar acesso</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40"><tr>
              <th className="p-2 text-left">Cliente</th><th className="p-2 text-left">Link</th><th className="p-2 text-left">Expira</th><th className="p-2 text-left">Último acesso</th><th className="p-2 text-center">Ativo</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {tokens.map(t => <tr key={t.id} className="border-t">
                <td className="p-2 font-medium">{nomeCliente(t.cliente_id)}</td>
                <td className="p-2"><span className="font-mono text-xs">{t.token.slice(0, 8)}…</span></td>
                <td className="p-2 text-xs">{t.expira_em ? new Date(t.expira_em).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="p-2 text-xs">{t.ultimo_acesso ? new Date(t.ultimo_acesso).toLocaleString("pt-BR") : "—"}</td>
                <td className="p-2 text-center"><Badge variant={t.ativo ? "default" : "secondary"}>{t.ativo ? "sim" : "não"}</Badge></td>
                <td className="p-2 flex gap-1 justify-end">
                  <Button size="sm" variant="outline" onClick={() => copiar(t.token)}><Copy className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(link(t.token), "_blank")}><LinkIcon className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(t.id, t.ativo)}><Power className="h-3 w-3" /></Button>
                </td>
              </tr>)}
              {tokens.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum acesso gerado</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
