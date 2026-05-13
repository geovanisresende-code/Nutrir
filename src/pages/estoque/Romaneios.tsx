import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Truck, Trash2 } from "lucide-react";

const STATUS = [
  { id: "preparando", label: "Preparando", cls: "bg-slate-100 text-slate-700" },
  { id: "em_transito", label: "Em trânsito", cls: "bg-blue-100 text-blue-700" },
  { id: "entregue", label: "Entregue", cls: "bg-emerald-100 text-emerald-700" },
  { id: "devolvido", label: "Devolvido", cls: "bg-red-100 text-red-700" },
];

type Item = { produto: string; quantidade: number; unidade: string };
type Rom = { id: string; numero: string; cliente_nome: string | null; data_emissao: string; data_entrega: string | null; motorista: string | null; placa: string | null; transportadora: string | null; status: string; itens: Item[]; endereco_entrega: string | null; observacoes: string | null };

export default function Romaneios() {
  const { current } = useOrg();
  const [list, setList] = useState<Rom[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ numero: "", cliente_id: "", cliente_nome: "", data_emissao: new Date().toISOString().split("T")[0], data_entrega: "", motorista: "", placa: "", transportadora: "", status: "preparando", endereco_entrega: "", observacoes: "" });
  const [itens, setItens] = useState<Item[]>([]);
  const [novoItem, setNovoItem] = useState({ produto: "", quantidade: 0, unidade: "L" });

  const load = async () => {
    if (!current) return;
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from("nutrir_romaneios" as any).select("*").eq("organization_id", current.id).order("created_at", { ascending: false }),
      supabase.from("nutrir_clientes" as any).select("id,razao_social,nome_fantasia,endereco,cidade,uf").eq("organization_id", current.id).limit(500),
    ]);
    setList((r as any) ?? []);
    setClientes((c as any) ?? []);
  };
  useEffect(() => { load(); }, [current?.id]);

  const salvar = async () => {
    if (!current || !form.numero) { toast.error("Informe o número"); return; }
    const cliente = clientes.find(c => c.id === form.cliente_id);
    await supabase.from("nutrir_romaneios" as any).insert({
      organization_id: current.id, numero: form.numero,
      cliente_id: form.cliente_id || null,
      cliente_nome: cliente ? (cliente.nome_fantasia || cliente.razao_social) : form.cliente_nome,
      data_emissao: form.data_emissao, data_entrega: form.data_entrega || null,
      motorista: form.motorista, placa: form.placa, transportadora: form.transportadora,
      status: form.status, itens, endereco_entrega: form.endereco_entrega, observacoes: form.observacoes,
    });
    toast.success("Romaneio criado");
    setOpen(false); setItens([]);
    setForm({ numero: "", cliente_id: "", cliente_nome: "", data_emissao: new Date().toISOString().split("T")[0], data_entrega: "", motorista: "", placa: "", transportadora: "", status: "preparando", endereco_entrega: "", observacoes: "" });
    load();
  };

  const updateStatus = async (id: string, s: string) => {
    await supabase.from("nutrir_romaneios" as any).update({ status: s }).eq("id", id);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Romaneios de Entrega</h1>
          <p className="text-sm text-muted-foreground">Controle de despacho e logística</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Romaneio</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo romaneio</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número *</Label><Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /></div>
              <div><Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={v => { const c = clientes.find(x => x.id === v); setForm({ ...form, cliente_id: v, endereco_entrega: c ? `${c.endereco ?? ""} ${c.cidade ?? ""}/${c.uf ?? ""}`.trim() : "" }); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })} /></div>
              <div><Label>Entrega prevista</Label><Input type="date" value={form.data_entrega} onChange={e => setForm({ ...form, data_entrega: e.target.value })} /></div>
              <div><Label>Motorista</Label><Input value={form.motorista} onChange={e => setForm({ ...form, motorista: e.target.value })} /></div>
              <div><Label>Placa</Label><Input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })} /></div>
              <div className="col-span-2"><Label>Transportadora</Label><Input value={form.transportadora} onChange={e => setForm({ ...form, transportadora: e.target.value })} /></div>
              <div className="col-span-2"><Label>Endereço de entrega</Label><Input value={form.endereco_entrega} onChange={e => setForm({ ...form, endereco_entrega: e.target.value })} /></div>
              <div className="col-span-2 border-t pt-3">
                <Label>Itens</Label>
                <div className="flex gap-2 mb-2">
                  <Input placeholder="Produto" value={novoItem.produto} onChange={e => setNovoItem({ ...novoItem, produto: e.target.value })} />
                  <Input type="number" placeholder="Qtd" className="w-24" value={novoItem.quantidade} onChange={e => setNovoItem({ ...novoItem, quantidade: Number(e.target.value) })} />
                  <Input placeholder="Un" className="w-20" value={novoItem.unidade} onChange={e => setNovoItem({ ...novoItem, unidade: e.target.value })} />
                  <Button size="sm" onClick={() => { if (novoItem.produto) { setItens([...itens, novoItem]); setNovoItem({ produto: "", quantidade: 0, unidade: "L" }); } }}>+</Button>
                </div>
                <div className="space-y-1">
                  {itens.map((i, idx) => <div key={idx} className="flex justify-between text-sm bg-muted/30 p-2 rounded"><span>{i.produto}</span><span>{i.quantidade} {i.unidade} <Button variant="ghost" size="sm" onClick={() => setItens(itens.filter((_, x) => x !== idx))}><Trash2 className="h-3 w-3" /></Button></span></div>)}
                </div>
              </div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
            </div>
            <Button onClick={salvar}>Salvar</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {list.map(r => {
          const s = STATUS.find(x => x.id === r.status);
          return <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-start gap-3">
                  <Truck className="h-8 w-8 text-primary mt-1" />
                  <div>
                    <p className="font-semibold">Romaneio #{r.numero}</p>
                    <p className="text-sm text-muted-foreground">{r.cliente_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Emissão: {new Date(r.data_emissao + "T12:00").toLocaleDateString("pt-BR")}{r.data_entrega && ` · Entrega: ${new Date(r.data_entrega + "T12:00").toLocaleDateString("pt-BR")}`}</p>
                    {r.motorista && <p className="text-xs">Motorista: {r.motorista} {r.placa && `· ${r.placa}`}</p>}
                    {r.endereco_entrega && <p className="text-xs text-muted-foreground">📍 {r.endereco_entrega}</p>}
                    <div className="mt-2 text-xs">
                      {r.itens.map((i, idx) => <span key={idx} className="inline-block mr-3">• {i.produto}: {i.quantidade} {i.unidade}</span>)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={s?.cls}>{s?.label}</Badge>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map(x => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>;
        })}
        {list.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum romaneio</CardContent></Card>}
      </div>
    </div>
  );
}
