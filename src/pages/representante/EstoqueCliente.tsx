import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, ArrowDown, ArrowUp, RefreshCw, Package, AlertTriangle,
  Search, TrendingDown, DollarSign,
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LIMITE_ALERTA = 10; // saldo abaixo disso → alerta amarelo
const LIMITE_CRITICO = 3; // saldo abaixo disso → alerta vermelho

export default function EstoqueCliente() {
  const { current } = useOrg();
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [estoques, setEstoques] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  // form mov
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [produtoNome, setProdutoNome] = useState("");
  const [unidade, setUnidade] = useState("L");
  const [qtd, setQtd] = useState("");
  const [custo, setCusto] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClientes = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("nutrir_clientes" as any)
      .select("id,razao_social")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("razao_social");
    setClientes(data ?? []);
    if (!clienteId && data && data.length > 0) setClienteId((data as any[])[0].id);
  };

  const loadEstoque = async () => {
    if (!clienteId) { setEstoques([]); setMovs([]); return; }
    const [{ data: e }, { data: m }] = await Promise.all([
      (supabase as any).from("nutrir_estoque_cliente").select("*").eq("cliente_id", clienteId).order("produto_nome"),
      (supabase as any).from("nutrir_estoque_movimentacoes").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(80),
    ]);
    setEstoques((e as any[]) ?? []);
    setMovs((m as any[]) ?? []);
  };

  useEffect(() => { loadClientes(); }, [current?.id]);
  useEffect(() => { loadEstoque(); }, [clienteId]);

  const reset = () => {
    setTipo("entrada"); setProdutoNome(""); setUnidade("L"); setQtd(""); setCusto(""); setObs("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !clienteId) return;
    setSaving(true);
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
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movimentação registrada");
    setOpen(false); reset(); loadEstoque();
  };

  // Filtro por busca
  const estoquesFiltrados = useMemo(() => {
    if (!busca.trim()) return estoques;
    const b = busca.toLowerCase();
    return estoques.filter(e => e.produto_nome?.toLowerCase().includes(b));
  }, [estoques, busca]);

  // Alertas
  const alertas = useMemo(() => estoques.filter(e => Number(e.saldo) < LIMITE_ALERTA), [estoques]);
  const criticos = useMemo(() => estoques.filter(e => Number(e.saldo) < LIMITE_CRITICO), [estoques]);

  const totalSaldo = useMemo(() =>
    estoques.reduce((a, e) => a + Number(e.saldo) * Number(e.custo_medio), 0),
    [estoques]
  );

  function saldoStatus(saldo: number) {
    if (saldo < LIMITE_CRITICO) return "critico";
    if (saldo < LIMITE_ALERTA) return "baixo";
    return "ok";
  }

  return (
    <>
      <PageHeader
        title="Estoque do Cliente"
        description="Saldo de produtos por cliente, com custo médio e alertas"
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={loadEstoque} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild>
                <Button disabled={!clienteId}>
                  <Plus className="h-4 w-4 mr-1" /> Movimentar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova movimentação de estoque</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">📥 Entrada</SelectItem>
                          <SelectItem value="saida">📤 Saída / Uso</SelectItem>
                          <SelectItem value="ajuste">🔄 Ajuste</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unidade</Label>
                      <Select value={unidade} onValueChange={setUnidade}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="sc">sc</SelectItem>
                          <SelectItem value="un">un</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Produto</Label>
                    {estoques.length > 0 ? (
                      <>
                        <Select value={produtoNome} onValueChange={setProdutoNome}>
                          <SelectTrigger><SelectValue placeholder="Selecionar produto existente…" /></SelectTrigger>
                          <SelectContent>
                            {estoques.map(e => (
                              <SelectItem key={e.id} value={e.produto_nome}>{e.produto_nome} ({fmt(Number(e.saldo))} {e.unidade})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">ou digite um novo:</p>
                      </>
                    ) : null}
                    <Input
                      value={produtoNome}
                      onChange={(e) => setProdutoNome(e.target.value)}
                      required
                      placeholder="Nome do produto (ex: Nutrir N180, Bor 10…)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Quantidade ({unidade})</Label>
                      <Input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Custo unitário (R$/{unidade})</Label>
                      <Input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observação</Label>
                    <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Nota de entrega, número do pedido…" />
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Salvando…" : "Registrar movimentação"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Seletor de cliente */}
        <Card><CardContent className="p-4">
          <Label className="text-xs">Cliente</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent></Card>

        {/* Alertas de estoque crítico/baixo */}
        {criticos.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Estoque crítico: </span>
              {criticos.map(e => `${e.produto_nome} (${fmt(Number(e.saldo))} ${e.unidade})`).join(", ")}
            </div>
          </div>
        )}
        {alertas.length > criticos.length && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Estoque baixo: </span>
              {alertas.filter(e => Number(e.saldo) >= LIMITE_CRITICO).map(e => `${e.produto_nome} (${fmt(Number(e.saldo))} ${e.unidade})`).join(", ")}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Itens em estoque</div>
            <div className="text-2xl font-bold">{estoques.length}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Valor total</div>
            <div className="text-2xl font-bold">{money(totalSaldo)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Baixo estoque</div>
            <div className={`text-2xl font-bold ${alertas.length > 0 ? "text-amber-600" : ""}`}>{alertas.length}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Movimentações</div>
            <div className="text-2xl font-bold">{movs.length}</div>
          </CardContent></Card>
        </div>

        {/* Saldos */}
        <Card><CardContent className="p-0">
          <div className="p-4 flex items-center justify-between gap-3">
            <span className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Saldos atuais
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="pl-8 h-8 w-48"
              />
            </div>
          </div>
          {estoquesFiltrados.length === 0 ? (
            <div className="p-6 pt-0 text-sm text-muted-foreground">
              {estoques.length === 0 ? "Sem estoque registrado para este cliente." : "Nenhum produto encontrado."}
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Unid.</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Custo médio</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última mov.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {estoquesFiltrados.map((e) => {
                  const saldo = Number(e.saldo);
                  const st = saldoStatus(saldo);
                  return (
                    <TableRow key={e.id} className={st === "critico" ? "bg-red-50/50" : st === "baixo" ? "bg-amber-50/50" : ""}>
                      <TableCell className="font-medium">{e.produto_nome}</TableCell>
                      <TableCell>{e.unidade}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(saldo)}</TableCell>
                      <TableCell className="text-right">{money(Number(e.custo_medio))}</TableCell>
                      <TableCell className="text-right font-medium">{money(saldo * Number(e.custo_medio))}</TableCell>
                      <TableCell>
                        {st === "critico" ? (
                          <Badge variant="destructive" className="text-[10px]">Crítico</Badge>
                        ) : st === "baixo" ? (
                          <Badge className="bg-amber-500 text-[10px]">Baixo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.ultima_movimentacao ? new Date(e.ultima_movimentacao).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>

        {/* Histórico de movimentações */}
        <Card><CardContent className="p-0">
          <div className="p-4 font-semibold">Histórico de movimentações</div>
          {movs.length === 0 ? (
            <div className="p-6 pt-0 text-sm text-muted-foreground">Sem movimentações registradas.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Obs.</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm capitalize">
                        {m.tipo === "entrada"
                          ? <ArrowDown className="h-3.5 w-3.5 text-green-600" />
                          : m.tipo === "saida"
                          ? <ArrowUp className="h-3.5 w-3.5 text-red-600" />
                          : <RefreshCw className="h-3.5 w-3.5 text-blue-500" />}
                        {m.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{m.produto_nome ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(m.quantidade))} {m.unidade}</TableCell>
                    <TableCell className="text-right">{m.custo_unitario ? money(Number(m.custo_unitario)) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.origem ?? "manual"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{m.observacao ?? "—"}</TableCell>
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
