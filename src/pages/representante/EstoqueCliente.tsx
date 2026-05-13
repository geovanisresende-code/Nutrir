import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ArrowDown, ArrowUp, RefreshCw, Package } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EstoqueCliente() {
  const { current } = useOrg();
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [estoques, setEstoques] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // form mov
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [produtoNome, setProdutoNome] = useState("");
  const [unidade, setUnidade] = useState("L");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const [obs, setObs] = useState("");

  const loadClientes = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("nutrir_clientes")
      .select("id, razao_social")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("razao_social");
    setClientes(data ?? []);
    if (!clienteId && data && data.length > 0) setClienteId(data[0].id);
  };

  const loadEstoque = async () => {
    if (!clienteId) { setEstoques([]); setMovs([]); return; }
    const [{ data: e }, { data: m }] = await Promise.all([
      supabase.from("nutrir_estoque_cliente" as any).select("*").eq("cliente_id", clienteId).order("produto_nome"),
      supabase.from("nutrir_estoque_movimentacoes" as any).select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(50),
    ]);
    setEstoques((e as any[]) ?? []);
    setMovs((m as any[]) ?? []);
  };

  useEffect(() => { loadClientes(); }, [current?.id]);
  useEffect(() => { loadEstoque(); }, [clienteId]);

  const reset = () => { setTipo("entrada"); setProdutoNome(""); setUnidade("L"); setQtd(""); setCusto(""); setObs(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !clienteId) return;
    const { error } = await (supabase as any).rpc("estoque_movimentar", {
      _org: current.id,
      _cliente: clienteId,
      _produto_nome: produtoNome,
      _unidade: unidade,
      _tipo: tipo,
      _quantidade: Number(qtd.replace(",", ".")) || 0,
      _custo: custo ? Number(custo.replace(",", ".")) : null,
      _origem: "manual",
      _origem_id: null,
      _obs: obs || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Movimentação registrada");
    setOpen(false); reset(); loadEstoque();
  };

  const totalSaldo = useMemo(() => estoques.reduce((a, e) => a + Number(e.saldo) * Number(e.custo_medio), 0), [estoques]);

  return (
    <>
      <PageHeader
        title="Estoque do Cliente"
        description="Saldo de produtos por cliente, com custo médio"
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={loadEstoque} title="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary" disabled={!clienteId}><Plus className="h-4 w-4 mr-1" /> Movimentar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                          <SelectItem value="ajuste">Ajuste</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Unidade</Label>
                      <Select value={unidade} onValueChange={setUnidade}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="un">un</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Produto</Label><Input value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} required placeholder="Nutrir Cana, Bor 10, ÍON…" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Quantidade</Label><Input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} required /></div>
                    <div className="space-y-1.5"><Label>Custo unitário (opcional)</Label><Input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Observação</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" className="bg-gradient-primary">Registrar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <Card><CardContent className="p-4">
          <Label className="text-xs">Cliente</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent></Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Itens em estoque</div><div className="text-2xl font-bold">{estoques.length}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Valor total (custo médio)</div><div className="text-2xl font-bold">{money(totalSaldo)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Movimentações (50 últimas)</div><div className="text-2xl font-bold">{movs.length}</div></CardContent></Card>
        </div>

        <Card><CardContent className="p-0">
          <div className="p-4 font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Saldos atuais</div>
          {estoques.length === 0 ? (
            <div className="p-6 pt-0 text-sm text-muted-foreground">Sem estoque registrado para este cliente.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produto</TableHead><TableHead>Unid.</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Custo médio</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Última mov.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {estoques.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.produto_nome}</TableCell>
                    <TableCell>{e.unidade}</TableCell>
                    <TableCell className="text-right">{fmt(Number(e.saldo))}</TableCell>
                    <TableCell className="text-right">{money(Number(e.custo_medio))}</TableCell>
                    <TableCell className="text-right font-medium">{money(Number(e.saldo) * Number(e.custo_medio))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.ultima_movimentacao ? new Date(e.ultima_movimentacao).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-0">
          <div className="p-4 font-semibold">Histórico de movimentações</div>
          {movs.length === 0 ? (
            <div className="p-6 pt-0 text-sm text-muted-foreground">Sem movimentações.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quando</TableHead><TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead>Origem</TableHead><TableHead>Observação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 capitalize">
                        {m.tipo === "entrada" ? <ArrowDown className="h-3 w-3 text-emerald-600" /> :
                         m.tipo === "saida" ? <ArrowUp className="h-3 w-3 text-destructive" /> : <RefreshCw className="h-3 w-3" />}
                        {m.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmt(Number(m.quantidade))}</TableCell>
                    <TableCell className="text-right">{m.custo_unitario ? money(Number(m.custo_unitario)) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.origem ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.observacao ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>
    </>
  );
}
