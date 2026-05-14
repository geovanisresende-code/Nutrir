import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, FileDown, ShoppingCart, ArrowLeft, CheckCircle2, XCircle, Truck, MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import AuditoriaStatusDialog from "@/components/nutrir/AuditoriaStatusDialog";

interface Pedido {
  id: string; numero: string | null; cliente_id: string | null; representante_id: string | null;
  regional_id: string | null; modalidade_id: string | null; data_pedido: string;
  data_entrega: string | null; status: string; subtotal: number; desconto: number; total: number;
  observacoes: string | null;
  orcamento_origem_id?: string | null;
}
interface Item {
  _key?: string; id?: string; produto_id: string; embalagem_id: string | null;
  quantidade: number; preco_unitario: number; desconto_pct: number; subtotal: number; ordem: number;
}
interface Cliente { id: string; razao_social: string; cnpj?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; }
interface Representante { id: string; nome: string; }
interface Regional { id: string; nome: string; }
interface Modalidade { id: string; nome: string; }
interface Produto { id: string; nome: string; }
interface Embalagem { id: string; nome: string; }
interface Preco { id: string; produto_id: string; embalagem_id: string | null; regional_id: string | null; modalidade_id: string | null; preco: number; ativo: boolean; }

const STATUS = [
  { v: "rascunho", l: "Rascunho", c: "secondary" },
  { v: "confirmado", l: "Confirmado", c: "default" },
  { v: "faturado", l: "Faturado", c: "default" },
  { v: "entregue", l: "Entregue", c: "default" },
  { v: "cancelado", l: "Cancelado", c: "destructive" },
] as const;

export default function Pedidos() {
  const { current } = useOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pedidos, loading, reload } = useOrgTable<Pedido>("nutrir_pedidos", { orderBy: "created_at", ascending: false });
  const { data: clientes } = useOrgTable<Cliente>("nutrir_clientes", { orderBy: "razao_social", select: "id,razao_social,cnpj,endereco,cidade,uf" });
  const { data: representantes } = useOrgTable<Representante>("nutrir_representantes", { orderBy: "nome", select: "id,nome" });
  const { data: regionais } = useOrgTable<Regional>("nutrir_regionais", { orderBy: "nome", select: "id,nome" });
  const { data: modalidades } = useOrgTable<Modalidade>("nutrir_modalidades", { orderBy: "nome", select: "id,nome" });
  const { data: produtos } = useOrgTable<Produto>("nutrir_produtos", { orderBy: "nome", select: "id,nome" });
  const { data: embalagens } = useOrgTable<Embalagem>("nutrir_embalagens", { orderBy: "nome", select: "id,nome" });
  const { data: precos } = useOrgTable<Preco>("nutrir_precos", { filter: q => q.eq("ativo", true) });

  const [editing, setEditing] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [salvando, setSalvando] = useState(false);

  // ── Conversão de orçamento em pedido (?from_orcamento=ID) ──
  useEffect(() => {
    const orcId = searchParams.get("from_orcamento");
    if (!orcId || !current) return;
    (async () => {
      const { data: orc } = await (supabase as any)
        .from("nutrir_orcamentos").select("*").eq("id", orcId).maybeSingle();
      if (!orc) { toast({ title: "Orçamento não encontrado", variant: "destructive" }); return; }
      setEditing({
        id: "", numero: null,
        cliente_id: orc.cliente_id ?? null,
        representante_id: orc.representante_id ?? null,
        regional_id: null, modalidade_id: null,
        data_pedido: new Date().toISOString().slice(0, 10),
        data_entrega: null, status: "rascunho",
        subtotal: 0, desconto: 0, total: 0,
        observacoes: `Originado do orçamento "${orc.titulo}" (${Number(orc.area_total_ha).toFixed(1)} ha)`,
        orcamento_origem_id: orc.id,
      });
      setItens([]);
      setSearchParams({}, { replace: true });
      toast({ title: "Pedido pré-preenchido a partir do orçamento", description: "Adicione os produtos e salve para concluir a conversão." });
    })();
  }, [searchParams, current?.id]);

  const buscarPreco = (produto_id: string, embalagem_id: string | null) => {
    if (!editing) return 0;
    const cands = precos.filter(p => p.produto_id === produto_id);
    const score = (p: Preco) => {
      let s = 0;
      if (p.embalagem_id === embalagem_id) s += 4;
      if (p.regional_id === editing.regional_id) s += 2;
      if (p.modalidade_id === editing.modalidade_id) s += 1;
      return s;
    };
    return cands.sort((a, b) => score(b) - score(a))[0]?.preco ?? 0;
  };

  const novoPedido = () => {
    setEditing({
      id: "", numero: null, cliente_id: null, representante_id: null,
      regional_id: null, modalidade_id: null,
      data_pedido: new Date().toISOString().slice(0, 10),
      data_entrega: null, status: "rascunho",
      subtotal: 0, desconto: 0, total: 0, observacoes: null,
    });
    setItens([]);
  };

  const carregarPedido = async (p: Pedido) => {
    setEditing(p);
    const { data } = await (supabase as any).from("nutrir_pedido_itens")
      .select("*").eq("pedido_id", p.id).order("ordem");
    setItens((data ?? []).map((i: any) => ({ ...i, _key: i.id })));
  };

  const adicionarItem = () => setItens([...itens, {
    _key: crypto.randomUUID(), produto_id: "", embalagem_id: null, quantidade: 1,
    preco_unitario: 0, desconto_pct: 0, subtotal: 0, ordem: itens.length,
  }]);

  const updateItem = (key: string, patch: Partial<Item>) => {
    setItens(items => items.map(it => {
      if (it._key !== key) return it;
      const merged = { ...it, ...patch };
      if (patch.produto_id !== undefined || patch.embalagem_id !== undefined) {
        merged.preco_unitario = buscarPreco(merged.produto_id, merged.embalagem_id);
      }
      const subtotal = merged.quantidade * merged.preco_unitario * (1 - (merged.desconto_pct || 0) / 100);
      merged.subtotal = Math.round(subtotal * 100) / 100;
      return merged;
    }));
  };

  const removerItem = (key: string) => setItens(items => items.filter(it => it._key !== key));

  const totais = useMemo(() => {
    const subtotal = itens.reduce((s, i) => s + i.subtotal, 0);
    const desc = editing?.desconto ?? 0;
    return { subtotal, desconto: desc, total: Math.max(0, subtotal - desc) };
  }, [itens, editing?.desconto]);

  const salvar = async () => {
    if (!current || !editing) return;
    if (!editing.cliente_id) { toast({ title: "Cliente obrigatório", variant: "destructive" }); return; }
    if (itens.length === 0) { toast({ title: "Adicione ao menos 1 item", variant: "destructive" }); return; }
    setSalvando(true);

    const payload: any = {
      organization_id: current.id,
      cliente_id: editing.cliente_id, representante_id: editing.representante_id,
      regional_id: editing.regional_id, modalidade_id: editing.modalidade_id,
      data_pedido: editing.data_pedido, data_entrega: editing.data_entrega,
      status: editing.status, subtotal: totais.subtotal, desconto: totais.desconto, total: totais.total,
      observacoes: editing.observacoes,
      orcamento_origem_id: editing.orcamento_origem_id ?? null,
    };

    let pedidoId = editing.id;
    if (pedidoId) {
      await (supabase as any).from("nutrir_pedidos").update(payload).eq("id", pedidoId);
      await (supabase as any).from("nutrir_pedido_itens").delete().eq("pedido_id", pedidoId);
    } else {
      const { data, error } = await (supabase as any).from("nutrir_pedidos").insert(payload).select().single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSalvando(false); return; }
      pedidoId = data.id;
    }

    const itensPayload = itens.filter(i => i.produto_id).map((i, idx) => ({
      pedido_id: pedidoId, produto_id: i.produto_id, embalagem_id: i.embalagem_id,
      quantidade: i.quantidade, preco_unitario: i.preco_unitario,
      desconto_pct: i.desconto_pct, subtotal: i.subtotal, ordem: idx,
    }));
    if (itensPayload.length) {
      await (supabase as any).from("nutrir_pedido_itens").insert(itensPayload);
    }

    // Marca o orçamento de origem como convertido (alimenta KPI de conversão do dashboard)
    if (editing.orcamento_origem_id && !editing.id) {
      await (supabase as any)
        .from("nutrir_orcamentos")
        .update({ status: "convertido" })
        .eq("id", editing.orcamento_origem_id);
    }

    setSalvando(false);
    toast({ title: "Pedido salvo", description: editing.orcamento_origem_id && !editing.id ? "Orçamento marcado como convertido." : undefined });
    setEditing(null); setItens([]); reload();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir pedido?")) return;
    await (supabase as any).from("nutrir_pedido_itens").delete().eq("pedido_id", id);
    await (supabase as any).from("nutrir_pedidos").delete().eq("id", id);
    reload();
  };

  const mudarStatus = async (id: string, novo: string) => {
    const { error } = await (supabase as any).from("nutrir_pedidos").update({ status: novo }).eq("id", id);
    if (error) {
      const isPermissao = /Apenas administradores/i.test(error.message ?? "");
      toast({
        title: isPermissao ? "Sem permissão" : "Não foi possível alterar o status",
        description: isPermissao
          ? "Apenas administradores podem cancelar pedidos."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: `Pedido marcado como ${novo}` });
    reload();
  };

  const exportarPDF = async (p: Pedido) => {
    const { data: its } = await (supabase as any).from("nutrir_pedido_itens")
      .select("*").eq("pedido_id", p.id).order("ordem");
    const cli = clientes.find(c => c.id === p.cliente_id);
    const { gerarPedidoPDF } = await import("@/lib/nutrir/pedido-pdf");
    const blob = await gerarPedidoPDF({
      numero: p.numero ?? p.id.slice(0, 8).toUpperCase(),
      data_pedido: p.data_pedido,
      data_entrega: p.data_entrega,
      cliente_nome: cli?.razao_social ?? "—",
      cliente_doc: cli?.cnpj ?? null,
      cliente_endereco: [cli?.endereco, cli?.cidade, cli?.uf].filter(Boolean).join(", ") || null,
      representante: representantes.find(r => r.id === p.representante_id)?.nome ?? null,
      regional: regionais.find(r => r.id === p.regional_id)?.nome ?? null,
      modalidade: modalidades.find(m => m.id === p.modalidade_id)?.nome ?? null,
      status: p.status,
      itens: (its ?? []).map((it: any) => ({
        produto: produtos.find(pr => pr.id === it.produto_id)?.nome ?? "—",
        embalagem: embalagens.find(e => e.id === it.embalagem_id)?.nome ?? null,
        quantidade: Number(it.quantidade), preco_unitario: Number(it.preco_unitario),
        desconto_pct: Number(it.desconto_pct ?? 0), subtotal: Number(it.subtotal),
      })),
      subtotal: Number(p.subtotal), desconto: Number(p.desconto), total: Number(p.total),
      observacoes: p.observacoes,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pedido_${p.numero ?? p.id.slice(0,8)}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Lista ───
  if (!editing) {
    return (
      <>
        <PageHeader title="Pedidos" description="Pedidos comerciais e venda direta"
          actions={<Button onClick={novoPedido}><Plus className="w-4 h-4 mr-1"/>Novo pedido</Button>}/>
        <div className="p-4 md:p-6">
          <Card className="overflow-x-auto"><div className="min-w-[640px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Representante</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
                : pedidos.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhum pedido</td></tr>
                : pedidos.map(p => {
                  const st = STATUS.find(s => s.v === p.status);
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => carregarPedido(p)}>
                      <td className="px-3 py-2">{new Date(p.data_pedido).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 font-medium">{clientes.find(c => c.id === p.cliente_id)?.razao_social ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{representantes.find(r => r.id === p.representante_id)?.nome ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant={st?.c as any}>{st?.l ?? p.status}</Badge></td>
                      <td className="px-3 py-2 text-right font-mono">{formatBRL(p.total)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" title="PDF" onClick={() => exportarPDF(p)}><FileDown className="w-4 h-4"/></Button>
                        <Button variant="ghost" size="icon" title="Enviar por WhatsApp" onClick={() => {
                          const cli = clientes.find(c => c.id === p.cliente_id);
                          abrirWhatsApp({
                            contexto: "pedido",
                            cliente: cli?.razao_social ?? null,
                            telefone: (cli as any)?.telefone ?? null,
                            identificador: `Pedido ${p.numero ?? p.id.slice(0,8).toUpperCase()}`,
                            total: Number(p.total),
                            observacao: `Status: ${st?.l ?? p.status} · Data: ${new Date(p.data_pedido).toLocaleDateString("pt-BR")}`,
                          });
                        }}><MessageCircle className="w-4 h-4 text-emerald-600"/></Button>
                        {p.status === "rascunho" && (
                          <Button variant="ghost" size="icon" title="Confirmar" onClick={() => mudarStatus(p.id, "confirmado")}><CheckCircle2 className="w-4 h-4 text-green-600"/></Button>
                        )}
                        {p.status === "confirmado" && (
                          <Button variant="ghost" size="icon" title="Faturar" onClick={() => mudarStatus(p.id, "faturado")}><Truck className="w-4 h-4 text-amber-600"/></Button>
                        )}
                        {p.status !== "cancelado" && p.status !== "entregue" && (
                          <Button variant="ghost" size="icon" title="Cancelar" onClick={() => mudarStatus(p.id, "cancelado")}><XCircle className="w-4 h-4 text-muted-foreground"/></Button>
                        )}
                        <AuditoriaStatusDialog entidade="pedido" entidadeId={p.id} titulo={p.numero ?? p.id.slice(0,8).toUpperCase()} />
                        <Button variant="ghost" size="icon" onClick={() => excluir(p.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button>
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

  // ─── Edição ───
  return (
    <>
      <PageHeader
        title={editing.id ? "Editar pedido" : "Novo pedido"}
        actions={<>
          <Button variant="outline" onClick={() => { setEditing(null); setItens([]); }}><ArrowLeft className="w-4 h-4 mr-1"/>Voltar</Button>
          <Button onClick={salvar} disabled={salvando}><Save className="w-4 h-4 mr-1"/>{salvando ? "Salvando…" : "Salvar"}</Button>
        </>}/>
      <div className="p-4 md:p-6 space-y-4">
        <Card className="p-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
              <Select value={editing.cliente_id ?? ""} onValueChange={v => setEditing({ ...editing, cliente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Representante</label>
              <Select value={editing.representante_id ?? "none"} onValueChange={v => setEditing({ ...editing, representante_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {representantes.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Regional</label>
              <Select value={editing.regional_id ?? "none"} onValueChange={v => setEditing({ ...editing, regional_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Modalidade</label>
              <Select value={editing.modalidade_id ?? "none"} onValueChange={v => setEditing({ ...editing, modalidade_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {modalidades.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data entrega</label>
              <Input type="date" value={editing.data_entrega ?? ""} onChange={e => setEditing({ ...editing, data_entrega: e.target.value || null })}/>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4"/>Itens do pedido</h3>
            <Button size="sm" variant="outline" onClick={adicionarItem}><Plus className="w-4 h-4 mr-1"/>Adicionar item</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Produto</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Embalagem</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Qtd</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Preço un.</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Desc. %</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">Nenhum item — clique em "Adicionar item"</td></tr>
                : itens.map(it => (
                  <tr key={it._key} className="border-b">
                    <td className="px-2 py-1 min-w-[180px]">
                      <Select value={it.produto_id || ""} onValueChange={v => updateItem(it._key!, { produto_id: v })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder={produtos.length === 0 ? "Sem produtos cadastrados" : "Selecionar"}/></SelectTrigger>
                        <SelectContent>
                          {produtos.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground">
                              Nenhum produto cadastrado.{" "}
                              <a href="/app/gestao/produtos" className="text-primary underline">Cadastrar produto →</a>
                            </div>
                          ) : produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1 min-w-[140px]">
                      <Select value={it.embalagem_id ?? "none"} onValueChange={v => updateItem(it._key!, { embalagem_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-8"><SelectValue placeholder={embalagens.length === 0 ? "Sem embalagens" : ""}/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {embalagens.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground">
                              Nenhuma embalagem.{" "}
                              <a href="/app/nutrir/embalagens" className="text-primary underline">Cadastrar →</a>
                            </div>
                          ) : embalagens.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1 w-24"><Input type="number" step="0.01" className="h-8 text-right" value={it.quantidade} onChange={e => updateItem(it._key!, { quantidade: parseFloat(e.target.value) || 0 })}/></td>
                    <td className="px-2 py-1 w-28"><Input type="number" step="0.01" className="h-8 text-right" value={it.preco_unitario} onChange={e => updateItem(it._key!, { preco_unitario: parseFloat(e.target.value) || 0 })}/></td>
                    <td className="px-2 py-1 w-20"><Input type="number" step="0.1" className="h-8 text-right" value={it.desconto_pct} onChange={e => updateItem(it._key!, { desconto_pct: parseFloat(e.target.value) || 0 })}/></td>
                    <td className="px-2 py-1 text-right font-mono">{formatBRL(it.subtotal)}</td>
                    <td className="px-2 py-1"><Button variant="ghost" size="icon" onClick={() => removerItem(it._key!)}><Trash2 className="w-4 h-4 text-destructive"/></Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr><td colSpan={5} className="px-2 py-2 text-right font-medium">Subtotal</td>
                    <td className="px-2 py-2 text-right font-mono">{formatBRL(totais.subtotal)}</td><td/></tr>
                <tr><td colSpan={5} className="px-2 py-2 text-right font-medium">Desconto (R$)</td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" step="0.01" className="h-8 text-right ml-auto w-32" value={editing.desconto ?? 0} onChange={e => setEditing({ ...editing, desconto: parseFloat(e.target.value) || 0 })}/>
                    </td><td/></tr>
                <tr><td colSpan={5} className="px-2 py-2 text-right font-bold text-base">TOTAL</td>
                    <td className="px-2 py-2 text-right font-mono font-bold text-base text-primary">{formatBRL(totais.total)}</td><td/></tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <Textarea rows={3} value={editing.observacoes ?? ""} onChange={e => setEditing({ ...editing, observacoes: e.target.value })}/>
        </Card>
      </div>
    </>
  );
}
