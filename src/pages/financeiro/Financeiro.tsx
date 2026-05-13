import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Plus, Wallet, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

type Lanc = { id: string; data: string; descricao: string; tipo: string; valor: number; status: string; categoria_id?: string | null; conta_id?: string | null; forma_pagamento?: string | null; observacoes?: string | null };
type Cat = { id: string; nome: string; tipo: string; cor: string | null };
type Conta = { id: string; nome: string; tipo: string; saldo_inicial: number };

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

export default function Financeiro() {
  const { current } = useOrg();
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [form, setForm] = useState<any>({ data: format(new Date(), "yyyy-MM-dd"), descricao: "", valor: "", status: "pago", categoria_id: "", conta_id: "", forma_pagamento: "PIX", observacoes: "" });
  const [openCat, setOpenCat] = useState(false);
  const [novaCat, setNovaCat] = useState({ nome: "", tipo: "despesa", cor: "#3B82F6" });
  const [openConta, setOpenConta] = useState(false);
  const [novaConta, setNovaConta] = useState({ nome: "", tipo: "banco", saldo_inicial: 0 });

  const load = async () => {
    if (!current) return;
    const [{ data: l }, { data: c }, { data: ct }] = await Promise.all([
      supabase.from("nutrir_financeiro_lancamentos" as any).select("*").eq("organization_id", current.id).order("data", { ascending: false }).limit(500),
      supabase.from("nutrir_financeiro_categorias" as any).select("*").eq("organization_id", current.id).eq("ativo", true),
      supabase.from("nutrir_financeiro_contas" as any).select("*").eq("organization_id", current.id).eq("ativo", true),
    ]);
    setLancs((l as any) ?? []);
    setCats((c as any) ?? []);
    setContas((ct as any) ?? []);
  };

  useEffect(() => { load(); }, [current?.id]);

  const kpis = useMemo(() => {
    const inicio = startOfMonth(new Date()).toISOString().split("T")[0];
    const fim = endOfMonth(new Date()).toISOString().split("T")[0];
    const mes = lancs.filter(l => l.data >= inicio && l.data <= fim);
    const receitas = mes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
    const despesas = mes.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
    const pendentes = lancs.filter(l => l.status === "pendente").reduce((s, l) => s + (l.tipo === "receita" ? Number(l.valor) : -Number(l.valor)), 0);
    const saldoContas = contas.reduce((s, c) => s + Number(c.saldo_inicial), 0);
    const movimento = lancs.filter(l => l.status === "pago").reduce((s, l) => s + (l.tipo === "receita" ? Number(l.valor) : -Number(l.valor)), 0);
    return { receitas, despesas, lucro: receitas - despesas, pendentes, saldoAtual: saldoContas + movimento };
  }, [lancs, contas]);

  const chartMensal = useMemo(() => {
    const meses: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const ini = startOfMonth(d).toISOString().split("T")[0];
      const fim = endOfMonth(d).toISOString().split("T")[0];
      const m = lancs.filter(l => l.data >= ini && l.data <= fim);
      meses.push({
        mes: format(d, "MMM/yy"),
        Receita: m.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0),
        Despesa: m.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0),
      });
    }
    return meses;
  }, [lancs]);

  const chartCategorias = useMemo(() => {
    const map: Record<string, number> = {};
    lancs.filter(l => l.tipo === "despesa").forEach(l => {
      const cat = cats.find(c => c.id === l.categoria_id);
      const nome = cat?.nome ?? "Sem categoria";
      map[nome] = (map[nome] ?? 0) + Number(l.valor);
    });
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 7);
  }, [lancs, cats]);

  const salvar = async () => {
    if (!current || !form.descricao || !form.valor) { toast.error("Preencha descrição e valor"); return; }
    const { error } = await supabase.from("nutrir_financeiro_lancamentos" as any).insert({
      organization_id: current.id, tipo,
      data: form.data, descricao: form.descricao, valor: Number(form.valor),
      status: form.status, categoria_id: form.categoria_id || null, conta_id: form.conta_id || null,
      forma_pagamento: form.forma_pagamento, observacoes: form.observacoes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento salvo");
    setOpen(false);
    setForm({ data: format(new Date(), "yyyy-MM-dd"), descricao: "", valor: "", status: "pago", categoria_id: "", conta_id: "", forma_pagamento: "PIX", observacoes: "" });
    load();
  };

  const salvarCat = async () => {
    if (!current || !novaCat.nome) return;
    await supabase.from("nutrir_financeiro_categorias" as any).insert({ ...novaCat, organization_id: current.id });
    toast.success("Categoria criada");
    setOpenCat(false); setNovaCat({ nome: "", tipo: "despesa", cor: "#3B82F6" });
    load();
  };

  const salvarConta = async () => {
    if (!current || !novaConta.nome) return;
    await supabase.from("nutrir_financeiro_contas" as any).insert({ ...novaConta, organization_id: current.id });
    toast.success("Conta criada");
    setOpenConta(false); setNovaConta({ nome: "", tipo: "banco", saldo_inicial: 0 });
    load();
  };

  const togglePago = async (l: Lanc) => {
    await supabase.from("nutrir_financeiro_lancamentos" as any).update({ status: l.status === "pago" ? "pendente" : "pago" }).eq("id", l.id);
    load();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Fluxo de caixa, DRE e categorização</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openConta} onOpenChange={setOpenConta}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Wallet className="h-4 w-4 mr-1" />Contas</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova conta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={novaConta.nome} onChange={e => setNovaConta({ ...novaConta, nome: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={novaConta.tipo} onValueChange={v => setNovaConta({ ...novaConta, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="banco">Banco</SelectItem><SelectItem value="caixa">Caixa</SelectItem><SelectItem value="cartao">Cartão</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Saldo inicial</Label><Input type="number" value={novaConta.saldo_inicial} onChange={e => setNovaConta({ ...novaConta, saldo_inicial: Number(e.target.value) })} /></div>
                <div className="border rounded p-2 max-h-40 overflow-y-auto text-sm space-y-1">
                  {contas.map(c => <div key={c.id} className="flex justify-between"><span>{c.nome}</span><span className="text-muted-foreground">{fmt(Number(c.saldo_inicial))}</span></div>)}
                </div>
                <Button onClick={salvarConta} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openCat} onOpenChange={setOpenCat}>
            <DialogTrigger asChild><Button variant="outline" size="sm">Categorias</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={novaCat.nome} onChange={e => setNovaCat({ ...novaCat, nome: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={novaCat.tipo} onValueChange={v => setNovaCat({ ...novaCat, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="despesa">Despesa</SelectItem><SelectItem value="receita">Receita</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Cor</Label><Input type="color" value={novaCat.cor} onChange={e => setNovaCat({ ...novaCat, cor: e.target.value })} /></div>
                <div className="border rounded p-2 max-h-40 overflow-y-auto text-sm space-y-1">
                  {cats.map(c => <div key={c.id} className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ background: c.cor ?? "#888" }} /><span>{c.nome}</span><Badge variant="outline" className="ml-auto">{c.tipo}</Badge></div>)}
                </div>
                <Button onClick={salvarCat} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Lançamento</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
              <Tabs value={tipo} onValueChange={v => setTipo(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="receita" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Receita</TabsTrigger>
                  <TabsTrigger value="despesa" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Despesa</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
                <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
                <div><Label>Categoria</Label>
                  <Select value={form.categoria_id} onValueChange={v => setForm({ ...form, categoria_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{cats.filter(c => c.tipo === tipo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Conta</Label>
                  <Select value={form.conta_id} onValueChange={v => setForm({ ...form, conta_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pago">Pago</SelectItem><SelectItem value="pendente">Pendente</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Forma pgto</Label>
                  <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="PIX">PIX</SelectItem><SelectItem value="Boleto">Boleto</SelectItem><SelectItem value="Dinheiro">Dinheiro</SelectItem><SelectItem value="Cartão">Cartão</SelectItem><SelectItem value="Transferência">Transferência</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
              </div>
              <Button onClick={salvar} className="w-full">Salvar</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-4 w-4" />Receitas no mês</div><p className="text-xl font-bold text-emerald-600 mt-1">{fmt(kpis.receitas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingDown className="h-4 w-4" />Despesas no mês</div><p className="text-xl font-bold text-red-600 mt-1">{fmt(kpis.despesas)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><DollarSign className="h-4 w-4" />Resultado</div><p className={`text-xl font-bold mt-1 ${kpis.lucro >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(kpis.lucro)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs">Pendente líquido</div><p className="text-xl font-bold mt-1">{fmt(kpis.pendentes)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Wallet className="h-4 w-4" />Saldo atual</div><p className="text-xl font-bold mt-1">{fmt(kpis.saldoAtual)}</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita x Despesa (6 meses)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><BarChart data={chartMensal}>
              <XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} /><Legend />
              <Bar dataKey="Receita" fill="#10B981" /><Bar dataKey="Despesa" fill="#EF4444" />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><PieChart>
              <Pie data={chartCategorias} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.nome}>
                {chartCategorias.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip formatter={(v: any) => fmt(Number(v))} />
            </PieChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Categoria</th><th className="p-2 text-right">Valor</th><th className="p-2 text-center">Status</th></tr></thead>
              <tbody>
                {lancs.slice(0, 50).map(l => {
                  const cat = cats.find(c => c.id === l.categoria_id);
                  return <tr key={l.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">{new Date(l.data + "T12:00").toLocaleDateString("pt-BR")}</td>
                    <td className="p-2 flex items-center gap-2">{l.tipo === "receita" ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" /> : <ArrowDownCircle className="h-4 w-4 text-red-600" />}{l.descricao}</td>
                    <td className="p-2">{cat?.nome ?? "-"}</td>
                    <td className={`p-2 text-right font-medium ${l.tipo === "receita" ? "text-emerald-600" : "text-red-600"}`}>{fmt(Number(l.valor))}</td>
                    <td className="p-2 text-center"><Badge variant={l.status === "pago" ? "default" : "secondary"} className="cursor-pointer" onClick={() => togglePago(l)}>{l.status}</Badge></td>
                  </tr>;
                })}
                {lancs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum lançamento ainda</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
