import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, MessageSquare, MapPin, FileText, GripVertical } from "lucide-react";
import { toast } from "sonner";

const ETAPAS = [
  { id: "prospeccao", label: "Prospecção", cor: "bg-slate-100 dark:bg-slate-800" },
  { id: "qualificacao", label: "Qualificação", cor: "bg-blue-50 dark:bg-blue-950/40" },
  { id: "proposta", label: "Proposta", cor: "bg-amber-50 dark:bg-amber-950/40" },
  { id: "negociacao", label: "Negociação", cor: "bg-purple-50 dark:bg-purple-950/40" },
  { id: "ganhou", label: "Ganhou", cor: "bg-emerald-50 dark:bg-emerald-950/40" },
  { id: "perdeu", label: "Perdeu", cor: "bg-red-50 dark:bg-red-950/40" },
];

type Op = { id: string; titulo: string; cliente_nome: string | null; cliente_id: string | null; valor_estimado: number; etapa: string; probabilidade: number; data_prevista: string | null; descricao: string | null };
type Inter = { id: string; tipo: string; descricao: string; data: string };

export default function CrmPipeline() {
  const { current } = useOrg();
  const [ops, setOps] = useState<Op[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Op | null>(null);
  const [form, setForm] = useState<any>({ titulo: "", cliente_id: "", cliente_nome: "", valor_estimado: 0, etapa: "prospeccao", probabilidade: 30, data_prevista: "", descricao: "" });
  const [drag, setDrag] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Op | null>(null);
  const [interacoes, setInteracoes] = useState<Inter[]>([]);
  const [novaInter, setNovaInter] = useState({ tipo: "nota", descricao: "" });

  const load = async () => {
    if (!current) return;
    const [{ data: o }, { data: c }] = await Promise.all([
      supabase.from("nutrir_crm_oportunidades" as any).select("*").eq("organization_id", current.id).order("ordem"),
      supabase.from("nutrir_clientes" as any).select("id,razao_social,nome_fantasia").eq("organization_id", current.id).limit(500),
    ]);
    setOps((o as any) ?? []);
    setClientes((c as any) ?? []);
  };

  useEffect(() => { load(); }, [current?.id]);

  const loadInter = async (opId: string) => {
    const { data } = await supabase.from("nutrir_crm_interacoes" as any).select("*").eq("oportunidade_id", opId).order("data", { ascending: false });
    setInteracoes((data as any) ?? []);
  };

  const salvar = async () => {
    if (!current || !form.titulo) { toast.error("Informe o título"); return; }
    const cliente = clientes.find(c => c.id === form.cliente_id);
    const payload = {
      organization_id: current.id, titulo: form.titulo,
      cliente_id: form.cliente_id || null,
      cliente_nome: cliente ? (cliente.nome_fantasia || cliente.razao_social) : form.cliente_nome,
      valor_estimado: Number(form.valor_estimado), etapa: form.etapa,
      probabilidade: Number(form.probabilidade),
      data_prevista: form.data_prevista || null,
      descricao: form.descricao || null,
    };
    if (editing) {
      await supabase.from("nutrir_crm_oportunidades" as any).update(payload).eq("id", editing.id);
    } else {
      await supabase.from("nutrir_crm_oportunidades" as any).insert(payload);
    }
    toast.success("Salvo");
    setOpen(false); setEditing(null);
    setForm({ titulo: "", cliente_id: "", cliente_nome: "", valor_estimado: 0, etapa: "prospeccao", probabilidade: 30, data_prevista: "", descricao: "" });
    load();
  };

  const onDrop = async (etapa: string) => {
    if (!drag) return;
    const op = ops.find(o => o.id === drag);
    if (!op || op.etapa === etapa) { setDrag(null); return; }
    setOps(ops.map(o => o.id === drag ? { ...o, etapa } : o));
    await supabase.from("nutrir_crm_oportunidades" as any).update({ etapa }).eq("id", drag);
    setDrag(null);
    toast.success(`Movido para ${ETAPAS.find(e => e.id === etapa)?.label}`);
  };

  const addInter = async () => {
    if (!detalhes || !novaInter.descricao) return;
    await supabase.from("nutrir_crm_interacoes" as any).insert({
      organization_id: current!.id, oportunidade_id: detalhes.id, cliente_id: detalhes.cliente_id,
      tipo: novaInter.tipo, descricao: novaInter.descricao,
    });
    setNovaInter({ tipo: "nota", descricao: "" });
    loadInter(detalhes.id);
  };

  const totals = useMemo(() => {
    const m: Record<string, { count: number; valor: number }> = {};
    ETAPAS.forEach(e => m[e.id] = { count: 0, valor: 0 });
    ops.forEach(o => { m[o.etapa] ??= { count: 0, valor: 0 }; m[o.etapa].count++; m[o.etapa].valor += Number(o.valor_estimado); });
    return m;
  }, [ops]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const iconInter = (t: string) => ({ ligacao: Phone, email: Mail, whatsapp: MessageSquare, visita: MapPin, nota: FileText } as any)[t] ?? FileText;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM — Pipeline de Vendas</h1>
          <p className="text-sm text-muted-foreground">Arraste cards entre as colunas para mover</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Oportunidade</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} oportunidade</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={v => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor estimado</Label><Input type="number" value={form.valor_estimado} onChange={e => setForm({ ...form, valor_estimado: e.target.value })} /></div>
                <div><Label>Probabilidade %</Label><Input type="number" min={0} max={100} value={form.probabilidade} onChange={e => setForm({ ...form, probabilidade: e.target.value })} /></div>
                <div><Label>Etapa</Label>
                  <Select value={form.etapa} onValueChange={v => setForm({ ...form, etapa: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ETAPAS.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Previsão</Label><Input type="date" value={form.data_prevista} onChange={e => setForm({ ...form, data_prevista: e.target.value })} /></div>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
              <Button onClick={salvar} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {ETAPAS.map(e => (
          <div key={e.id} className={`rounded-lg p-3 ${e.cor} min-h-[400px]`} onDragOver={(ev) => ev.preventDefault()} onDrop={() => onDrop(e.id)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{e.label}</h3>
              <Badge variant="outline" className="text-xs">{totals[e.id]?.count ?? 0}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{fmt(totals[e.id]?.valor ?? 0)}</p>
            <div className="space-y-2">
              {ops.filter(o => o.etapa === e.id).map(o => (
                <Card key={o.id} className="cursor-grab active:cursor-grabbing hover:shadow-md transition" draggable onDragStart={() => setDrag(o.id)} onClick={() => { setDetalhes(o); loadInter(o.id); }}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{o.titulo}</p>
                        {o.cliente_nome && <p className="text-xs text-muted-foreground truncate">{o.cliente_nome}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-primary">{fmt(Number(o.valor_estimado))}</span>
                          <Badge variant="outline" className="text-[10px]">{o.probabilidade}%</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!detalhes} onOpenChange={(v) => !v && setDetalhes(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detalhes && <>
            <DialogHeader><DialogTitle>{detalhes.titulo}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> {detalhes.cliente_nome || "-"}</div>
                <div><span className="text-muted-foreground">Valor:</span> {fmt(Number(detalhes.valor_estimado))}</div>
                <div><span className="text-muted-foreground">Etapa:</span> {ETAPAS.find(e => e.id === detalhes.etapa)?.label}</div>
                <div><span className="text-muted-foreground">Prob.:</span> {detalhes.probabilidade}%</div>
              </div>
              {detalhes.descricao && <p className="text-sm bg-muted/40 p-2 rounded">{detalhes.descricao}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(detalhes); setForm({ ...detalhes, valor_estimado: detalhes.valor_estimado, data_prevista: detalhes.data_prevista || "" }); setDetalhes(null); setOpen(true); }}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={async () => { if (confirm("Excluir?")) { await supabase.from("nutrir_crm_oportunidades" as any).delete().eq("id", detalhes.id); setDetalhes(null); load(); } }}>Excluir</Button>
              </div>
              <div className="border-t pt-3">
                <h4 className="font-medium mb-2">Histórico de interações</h4>
                <div className="flex gap-2 mb-2">
                  <Select value={novaInter.tipo} onValueChange={v => setNovaInter({ ...novaInter, tipo: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nota">Nota</SelectItem><SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="visita">Visita</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Descreva..." value={novaInter.descricao} onChange={e => setNovaInter({ ...novaInter, descricao: e.target.value })} />
                  <Button size="sm" onClick={addInter}>+</Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {interacoes.map(i => {
                    const Icon = iconInter(i.tipo);
                    return <div key={i.id} className="flex gap-2 text-sm border-l-2 border-primary/40 pl-2 py-1">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p>{i.descricao}</p>
                        <p className="text-xs text-muted-foreground">{new Date(i.data).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>;
                  })}
                  {interacoes.length === 0 && <p className="text-xs text-muted-foreground">Sem interações</p>}
                </div>
              </div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
