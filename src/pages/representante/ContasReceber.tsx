import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, Search, MessageCircle } from "lucide-react";
import { openWhatsapp, wppTemplates } from "@/lib/whatsapp";

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_COLOR: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  em_aberto: "secondary", vencendo: "outline", vencido: "destructive", pago: "default", cancelado: "outline",
};

export default function ContasReceber() {
  const { current } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Record<string, { nome: string; whatsapp: string | null; telefone: string | null }>>({});
  const [tab, setTab] = useState<string>("todos");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!current) return;
    await (supabase as any).rpc("atualizar_status_cr").then(() => {});
    const { data } = await supabase
      .from("nutrir_contas_receber" as any)
      .select("*")
      .eq("organization_id", current.id)
      .order("data_vencimento", { ascending: true })
      .limit(500);
    setItems((data as any[]) ?? []);
    const ids = Array.from(new Set(((data as any[]) ?? []).map((i) => i.cliente_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase.from("nutrir_clientes").select("id, razao_social, whatsapp, telefone").in("id", ids as string[]);
      const map: Record<string, { nome: string; whatsapp: string | null; telefone: string | null }> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = { nome: c.razao_social, whatsapp: c.whatsapp, telefone: c.telefone }; });
      setClientes(map);
    }
  };
  useEffect(() => { load(); }, [current?.id]);

  const baixar = async (id: string, valor: number) => {
    if (!confirm(`Confirmar pagamento de ${money(valor)}?`)) return;
    const { error } = await supabase.from("nutrir_contas_receber" as any)
      .update({ status: "pago", valor_pago: valor, data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado");
    load();
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (tab !== "todos" && i.status !== tab) return false;
      if (q) {
        const needle = q.toLowerCase();
        const cli = (clientes[i.cliente_id]?.nome ?? "").toLowerCase();
        if (!cli.includes(needle) && !(i.numero_nf ?? "").toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [items, tab, q, clientes]);

  const totais = useMemo(() => {
    const acc: Record<string, number> = { em_aberto: 0, vencendo: 0, vencido: 0, pago: 0 };
    items.forEach((i) => { acc[i.status] = (acc[i.status] ?? 0) + Number(i.valor); });
    return acc;
  }, [items]);

  return (
    <>
      <PageHeader
        title="Contas a Receber"
        description="Títulos com vencimento, alertas e baixa de pagamentos"
        actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em aberto</div><div className="text-xl font-bold">{money(totais.em_aberto)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Vencendo (15d)</div><div className="text-xl font-bold text-amber-600">{money(totais.vencendo)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Vencido</div><div className="text-xl font-bold text-destructive">{money(totais.vencido)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pago</div><div className="text-xl font-bold text-[#b08826]">{money(totais.pago)}</div></CardContent></Card>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="em_aberto">Em aberto</TabsTrigger>
              <TabsTrigger value="vencendo">Vencendo</TabsTrigger>
              <TabsTrigger value="vencido">Vencido</TabsTrigger>
              <TabsTrigger value="pago">Pago</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cliente ou NF…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <Card><CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum título encontrado.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cliente</TableHead><TableHead>NF</TableHead>
                <TableHead>Emissão</TableHead><TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  const cli = clientes[i.cliente_id];
                  const venc = ["vencendo", "vencido"].includes(i.status);
                  const wppPhone = cli?.whatsapp || cli?.telefone || null;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{cli?.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{i.numero_nf ?? "—"}</TableCell>
                      <TableCell className="text-xs">{i.data_emissao}</TableCell>
                      <TableCell className="text-xs">{i.data_vencimento}</TableCell>
                      <TableCell className="text-right font-medium">{money(Number(i.valor))}</TableCell>
                      <TableCell><Badge variant={STATUS_COLOR[i.status]}>{i.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {venc && wppPhone && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Cobrar via WhatsApp"
                            onClick={() => openWhatsapp(wppPhone, wppTemplates.contaVencendo(cli!.nome, Number(i.valor), new Date(i.data_vencimento).toLocaleDateString("pt-BR")))}
                          >
                            <MessageCircle className="h-4 w-4 text-[#b08826]" />
                          </Button>
                        )}
                        {i.status !== "pago" && i.status !== "cancelado" && (
                          <Button size="sm" variant="outline" onClick={() => baixar(i.id, Number(i.valor))}>
                            <CheckCircle2 className="h-4 w-4 mr-1 text-[#b08826]" /> Baixar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>
    </>
  );
}
