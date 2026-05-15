import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, AlertTriangle, Package } from "lucide-react";
import { differenceInDays } from "date-fns";

type Lote = { id: string; produto_nome: string; numero_lote: string; data_fabricacao: string | null; data_validade: string | null; quantidade: number; unidade: string; custo_unitario: number; deposito: string | null; observacoes: string | null };

export default function Lotes() {
  const { current } = useOrg();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [form, setForm] = useState<any>({ produto_nome: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade: 0, unidade: "L", custo_unitario: 0, deposito: "principal", observacoes: "" });

  const load = async () => {
    if (!current) return;
    const { data } = await supabase.from("nutrir_estoque_lotes" as any).select("*").eq("organization_id", current.id).order("data_validade", { nullsFirst: false });
    setLotes((data as any) ?? []);
  };
  useEffect(() => { load(); }, [current?.id]);

  const salvar = async () => {
    if (!current || !form.produto_nome || !form.numero_lote) { toast.error("Produto e nº do lote obrigatórios"); return; }
    await supabase.from("nutrir_estoque_lotes" as any).insert({
      ...form, organization_id: current.id,
      data_fabricacao: form.data_fabricacao || null, data_validade: form.data_validade || null,
      quantidade: Number(form.quantidade), custo_unitario: Number(form.custo_unitario),
    });
    toast.success("Lote cadastrado");
    setOpen(false); setForm({ produto_nome: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade: 0, unidade: "L", custo_unitario: 0, deposito: "principal", observacoes: "" });
    load();
  };

  const filtrados = useMemo(() => lotes.filter(l => !filtro || l.produto_nome.toLowerCase().includes(filtro.toLowerCase()) || l.numero_lote.includes(filtro)), [lotes, filtro]);

  const kpis = useMemo(() => {
    const hoje = new Date();
    const vencidos = lotes.filter(l => l.data_validade && new Date(l.data_validade) < hoje).length;
    const proximos = lotes.filter(l => l.data_validade && differenceInDays(new Date(l.data_validade), hoje) <= 90 && new Date(l.data_validade) >= hoje).length;
    const valorTotal = lotes.reduce((s, l) => s + Number(l.quantidade) * Number(l.custo_unitario), 0);
    return { vencidos, proximos, valorTotal, total: lotes.length };
  }, [lotes]);

  const statusValidade = (d: string | null) => {
    if (!d) return { label: "Sem validade", cls: "bg-muted text-muted-foreground" };
    const dias = differenceInDays(new Date(d), new Date());
    if (dias < 0) return { label: "Vencido", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
    if (dias <= 30) return { label: `${dias}d`, cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" };
    if (dias <= 90) return { label: `${dias}d`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
    return { label: `${dias}d`, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-[#e8c975]" };
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Estoque — Lotes</h1>
          <p className="text-sm text-muted-foreground">Controle por lote, validade e custo</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Lote</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo lote</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Produto *</Label><Input value={form.produto_nome} onChange={e => setForm({ ...form, produto_nome: e.target.value })} /></div>
              <div><Label>Nº lote *</Label><Input value={form.numero_lote} onChange={e => setForm({ ...form, numero_lote: e.target.value })} /></div>
              <div><Label>Depósito</Label><Input value={form.deposito} onChange={e => setForm({ ...form, deposito: e.target.value })} /></div>
              <div><Label>Fabricação</Label><Input type="date" value={form.data_fabricacao} onChange={e => setForm({ ...form, data_fabricacao: e.target.value })} /></div>
              <div><Label>Validade</Label><Input type="date" value={form.data_validade} onChange={e => setForm({ ...form, data_validade: e.target.value })} /></div>
              <div><Label>Quantidade</Label><Input type="number" step="0.01" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} /></div>
              <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} /></div>
              <div className="col-span-2"><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" value={form.custo_unitario} onChange={e => setForm({ ...form, custo_unitario: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
            </div>
            <Button onClick={salvar}>Salvar</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="h-4 w-4" />Total de lotes</div><p className="text-xl font-bold mt-1">{kpis.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 text-orange-500" />Próximos 90d</div><p className="text-xl font-bold mt-1 text-orange-600">{kpis.proximos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 text-red-500" />Vencidos</div><p className="text-xl font-bold mt-1 text-red-600">{kpis.vencidos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground">Valor total</div><p className="text-xl font-bold mt-1">{fmt(kpis.valorTotal)}</p></CardContent></Card>
      </div>

      <Input placeholder="Buscar por produto ou nº lote..." value={filtro} onChange={e => setFiltro(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40"><tr>
              <th className="p-2 text-left">Produto</th><th className="p-2 text-left">Lote</th><th className="p-2 text-left">Validade</th>
              <th className="p-2 text-right">Qtd</th><th className="p-2 text-right">Custo unit.</th><th className="p-2 text-right">Total</th><th className="p-2 text-left">Depósito</th>
            </tr></thead>
            <tbody>
              {filtrados.map(l => {
                const s = statusValidade(l.data_validade);
                return <tr key={l.id} className="border-t">
                  <td className="p-2 font-medium">{l.produto_nome}</td>
                  <td className="p-2 font-mono text-xs">{l.numero_lote}</td>
                  <td className="p-2"><Badge className={s.cls}>{l.data_validade ? new Date(l.data_validade + "T12:00").toLocaleDateString("pt-BR") + " (" + s.label + ")" : s.label}</Badge></td>
                  <td className="p-2 text-right">{Number(l.quantidade).toLocaleString("pt-BR")} {l.unidade}</td>
                  <td className="p-2 text-right">{fmt(Number(l.custo_unitario))}</td>
                  <td className="p-2 text-right font-medium">{fmt(Number(l.custo_unitario) * Number(l.quantidade))}</td>
                  <td className="p-2">{l.deposito}</td>
                </tr>;
              })}
              {filtrados.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum lote</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
