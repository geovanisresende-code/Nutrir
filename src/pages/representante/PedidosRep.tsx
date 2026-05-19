import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, ShoppingCart, FileSignature, FileText as FileIcon, Send, X, CalendarIcon, Download, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import VendedorBadge from "@/components/representante/VendedorBadge";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SignaturePad } from "@/components/representante/SignaturePad";
import { fmtBRL, fmtInt } from "@/lib/nutrir/format";
import { DescontoInput, descontoBloqueado, nivelDesconto, LIMITE_DESCONTO_APROVACAO } from "@/components/nutrir/DescontoInput";
import { cn } from "@/lib/utils";

// ── Tipo de venda fixo ──────────────────────────────────────────
const TIPOS_VENDA = [
  { value: "b2b", label: "B2B" },
  { value: "grupo_compra", label: "Grupo de Compra" },
  { value: "revenda", label: "Revenda" },
  { value: "venda_direta", label: "Venda Direta" },
  { value: "venda_agenciada", label: "Venda Agenciada" },
] as const;

// ── Cálculo de juros de mora ────────────────────────────────────
// Carência: 30 dias após vencimento. Após: 1,9% ao mês (diário).
const JUROS_CARENCIA_DIAS = 30;
const JUROS_MES = 0.019; // 1,9% ao mês
const JUROS_DIA = JUROS_MES / 30;

function calcularJuros(total: number, dataVenc: Date | null | undefined, hoje = new Date()): {
  diasAtraso: number; diasCorridos: number; juros: number; totalComJuros: number;
} | null {
  if (!dataVenc || total <= 0) return null;
  const diffMs = hoje.getTime() - dataVenc.getTime();
  const diasCorridos = Math.floor(diffMs / 86_400_000);
  if (diasCorridos <= 0) return null; // ainda dentro do prazo
  const diasAtraso = Math.max(0, diasCorridos - JUROS_CARENCIA_DIAS);
  const juros = diasAtraso > 0 ? total * JUROS_DIA * diasAtraso : 0;
  return { diasAtraso, diasCorridos, juros, totalComJuros: total + juros };
}

// ── Ordem padrão de embalagens (apenas exibição) ────────────────
// 1L cx12 → 5L cx20 → 10L → 20L → 25L → 50L → IBC 1000L
const ORDEM_EMB = (e: any): number => {
  const v = Number(e.volume ?? 0);
  const nome = (e.nome ?? "").toLowerCase();
  if (nome.startsWith("1 l") || nome === "1l" || (v === 12 && nome.includes("1"))) return 1;
  if (nome.startsWith("5 l") || nome === "5l" || (v === 20 && nome.includes("5"))) return 2;
  if (v === 10) return 3;
  if (v === 20 && !nome.includes("5")) return 4;
  if (v === 25) return 5;
  if (v === 50) return 6;
  if (v >= 1000) return 7;
  return 99;
};

/**
 * Volume unitário de uma embalagem (em litros). Usado como múltiplo da Qtd.
 * Regras pedidas:
 *  1L (cx 12L) → múltiplo de 12
 *  5L (cx 20L) → múltiplo de 20
 *  10L         → múltiplo de 10
 *  20L         → múltiplo de 20
 *  25L         → múltiplo de 25
 *  50L         → múltiplo de 50
 *  IBC 1000L   → múltiplo de 1000
 *
 * Aqui usamos o `volume` cadastrado em nutrir_embalagens (1L→12, 5L→20, 10L→10, etc.).
 */
const multiploEmbalagem = (emb: any | null): number => {
  if (!emb) return 1;
  const v = Number(emb.volume ?? 1);
  return v > 0 ? v : 1;
};

type Item = {
  produto_id: string;
  produto_nome: string;
  embalagem_id: string | null;
  quantidade: number;
  preco_unitario: number; // SEMPRE preço final ao cliente (nunca custo)
  desconto_pct: number;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  enviado: "Enviado",
  faturado: "Faturado",
  cancelado: "Cancelado",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "outline",
  aguardando_assinatura: "secondary",
  assinado: "default",
  enviado: "default",
  faturado: "default",
  cancelado: "destructive",
};

// ── À vista = vencimento ≤ último dia do mês seguinte ao pedido ──
function isAVista(dataPedido: Date, dataVenc: Date | undefined): boolean {
  if (!dataVenc) return true;
  const limite = new Date(dataPedido.getFullYear(), dataPedido.getMonth() + 2, 0); // último dia do mês seguinte
  return dataVenc.getTime() <= limite.getTime();
}

export default function PedidosRep() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [precos, setPrecos] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [openAssinar, setOpenAssinar] = useState(false);
  const [nomeAssinante, setNomeAssinante] = useState("");

  // form
  const [clienteId, setClienteId] = useState("");
  const [tipoVenda, setTipoVenda] = useState<string>("b2b");
  const [nomeAgenciador, setNomeAgenciador] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(undefined);
  const [dataEntrega, setDataEntrega] = useState<Date | undefined>(undefined);
  const [orcamentoOrigemId, setOrcamentoOrigemId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [descontoPct, setDescontoPct] = useState(0);
  const [itens, setItens] = useState<Item[]>([]);

  // cascade linha → produto
  const [linhaFiltro, setLinhaFiltro] = useState<Record<number, string>>({}); // index → linha

  const reset = () => {
    setClienteId(""); setTipoVenda("b2b"); setNomeAgenciador(""); setDataVencimento(undefined); setDataEntrega(undefined);
    setOrcamentoOrigemId(""); setObservacoes(""); setDescontoPct(0); setItens([]); setLinhaFiltro({});
  };

  const load = async () => {
    if (!current) return;
    const [ped, cli, prods, emb, prs, orc] = await Promise.all([
      supabase.from("nutrir_pedidos" as any).select("*").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("nutrir_clientes").select("id,razao_social,nome_fantasia,regional_id").eq("organization_id", current.id).eq("ativo", true).order("razao_social"),
      supabase.from("nutrir_produtos").select("id,nome,categoria,linha").eq("organization_id", current.id).eq("ativo", true).order("nome"),
      supabase.from("nutrir_embalagens").select("id,nome,unidade,volume,multiplicador").eq("organization_id", current.id).eq("ativo", true),
      supabase.from("nutrir_precos" as any).select("produto_id,embalagem_id,regional_id,modalidade_id,preco").eq("organization_id", current.id).eq("ativo", true),
      supabase.from("nutrir_orcamentos" as any).select("id,titulo,cliente_id,total_geral,parametros,created_at").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setPedidos((ped.data as any[]) ?? []);
    setClientes((cli.data as any[]) ?? []);
    setProdutos((prods.data as any[]) ?? []);
    const ordenadas = ((emb.data as any[]) ?? []).slice().sort((a, b) => ORDEM_EMB(a) - ORDEM_EMB(b));
    setEmbalagens(ordenadas);
    setPrecos((prs.data as any[]) ?? []);
    setOrcamentos((orc.data as any[]) ?? []);
  };

  useEffect(() => { load(); }, [current?.id]);

  // Pré-seleciona cliente via ?cliente= na URL (vindo da Ficha do Cliente)
  useEffect(() => {
    const cId = searchParams.get("cliente");
    if (cId && clientes.length) {
      const match = clientes.find(c => c.id === cId);
      if (match) { setClienteId(cId); setOpen(true); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, searchParams]);

  // Lê draft vindo da calculadora (Foliar ou NPK)
  const [draftBanner, setDraftBanner] = useState<string | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("nutrir.pedido_draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      sessionStorage.removeItem("nutrir.pedido_draft");
      // Preenche observações e itens do draft
      if (draft.observacoes) setObservacoes(draft.observacoes);
      if (draft.itens?.length) {
        const novosItens: Item[] = draft.itens.map((it: any) => ({
          produto_id: "",
          produto_nome: it.produto_nome ?? "",
          embalagem_id: null,
          quantidade: Number(it.quantidade) || 0,
          preco_unitario: Number(it.preco_unitario) || 0,
          desconto_pct: 0,
        }));
        setItens(novosItens);
      }
      // Tenta encontrar cliente pelo nome
      if (draft.cliente_nome && clientes.length) {
        const nome = (draft.cliente_nome as string).toLowerCase();
        const match = clientes.find(c =>
          (c.razao_social ?? "").toLowerCase().includes(nome) ||
          (c.nome_fantasia ?? "").toLowerCase().includes(nome)
        );
        if (match) setClienteId(match.id);
      }
      setDraftBanner(`📋 Pedido pré-preenchido: ${draft.titulo ?? draft.origem}`);
      setOpen(true);
    } catch { /* ignora */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes]);

  const clienteAtivo = useMemo(() => clientes.find(c => c.id === clienteId), [clientes, clienteId]);

  // linhas únicas extraídas dos produtos
  const linhasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach(p => { if (p.linha) set.add(p.linha); });
    return Array.from(set).sort();
  }, [produtos]);

  // produtos filtrados pela linha selecionada (por índice do item)
  const produtosFiltradosPorLinha = (idx: number) => {
    const l = linhaFiltro[idx];
    if (!l) return produtos;
    return produtos.filter(p => p.linha === l);
  };
  const dataPedido = useMemo(() => new Date(), []);
  const condicaoPagamento: "a_vista" | "a_prazo" = isAVista(dataPedido, dataVencimento) ? "a_vista" : "a_prazo";

  /**
   * Preço final ao cliente conforme produto, embalagem, regional do cliente e tipo de venda.
   * Nunca expõe custo de produção.
   */
  const precoFinal = (produto_id: string, embalagem_id: string | null): number => {
    if (!produto_id) return 0;
    const regId = clienteAtivo?.regional_id ?? null;
    // 1) match exato (produto+embalagem+regional+modalidade equivalente ao tipo_venda)
    let p = precos.find(x => x.produto_id === produto_id && x.embalagem_id === embalagem_id && x.regional_id === regId);
    if (!p) p = precos.find(x => x.produto_id === produto_id && x.embalagem_id === embalagem_id);
    if (!p) p = precos.find(x => x.produto_id === produto_id && x.embalagem_id === null);
    return p ? Number(p.preco) : 0;
  };

  const addItem = () =>
    setItens([...itens, { produto_id: "", produto_nome: "", embalagem_id: null, quantidade: 0, preco_unitario: 0, desconto_pct: 0 }]);
  const rmItem = (i: number) => setItens(itens.filter((_, k) => k !== i));

  const updItem = (i: number, p: Partial<Item>) =>
    setItens(itens.map((x, k) => {
      if (k !== i) return x;
      const merged = { ...x, ...p };
      if (p.produto_id !== undefined || p.embalagem_id !== undefined) {
        const prod = produtos.find((q) => q.id === merged.produto_id);
        merged.produto_nome = prod?.nome ?? "";
        merged.preco_unitario = precoFinal(merged.produto_id, merged.embalagem_id);
        // ao trocar embalagem, ajusta qtd para o múltiplo mais próximo
        const emb = embalagens.find(e => e.id === merged.embalagem_id) ?? null;
        const mult = multiploEmbalagem(emb);
        if (merged.quantidade > 0 && mult > 1) {
          merged.quantidade = Math.max(mult, Math.round(merged.quantidade / mult) * mult);
        }
      }
      return merged;
    }));

  const importarOrcamento = async (orcId: string) => {
    setOrcamentoOrigemId(orcId);
    if (!orcId) return;
    const orc = orcamentos.find(o => o.id === orcId);
    if (orc?.cliente_id && !clienteId) setClienteId(orc.cliente_id);

    // Buscar produtos do orçamento NPK/Foliar (quando existirem) — aqui importamos
    // do orçamento de Consultoria: o valor total entra como item "Consultoria".
    const novosItens: Item[] = [];

    // 1) Custo da consultoria (orçamento de consultoria tem total_geral)
    const totalConsultoria = Number(orc?.total_geral ?? 0);
    if (totalConsultoria > 0) {
      novosItens.push({
        produto_id: "",
        produto_nome: `Consultoria — ${orc.titulo ?? "Orçamento"}`,
        embalagem_id: null,
        quantidade: 1,
        preco_unitario: totalConsultoria,
        desconto_pct: 0,
      });
    }

    // 2) Tentar trazer recomendações de produto/complexador associadas
    const { data: recomendacoes } = await supabase
      .from("ai_recommendations" as any)
      .select("metadata")
      .eq("organization_id", current!.id)
      .order("created_at", { ascending: false })
      .limit(5);
    const meta: any[] = (recomendacoes as any[])?.flatMap(r => Array.isArray(r.metadata?.produtos) ? r.metadata.produtos : []) ?? [];
    for (const linha of meta) {
      const prod = produtos.find(p => p.id === linha.produto_id || (p.nome && linha.nome && p.nome.toLowerCase() === String(linha.nome).toLowerCase()));
      if (!prod) continue;
      // Nunca importa sais ou adubos puros (heurística por linha/categoria)
      const linhaTxt = `${prod.linha ?? ""} ${prod.categoria ?? ""}`.toLowerCase();
      if (linhaTxt.includes("sal") || linhaTxt.includes("adubo")) continue;
      const emb = embalagens[0] ?? null;
      novosItens.push({
        produto_id: prod.id,
        produto_nome: prod.nome,
        embalagem_id: emb?.id ?? null,
        quantidade: multiploEmbalagem(emb),
        preco_unitario: precoFinal(prod.id, emb?.id ?? null),
        desconto_pct: 0,
      });
    }

    setItens(prev => [...prev, ...novosItens]);
    toast.success(`Orçamento importado: ${novosItens.length} item(ns)`);
  };

  const subtotal = useMemo(
    () => itens.reduce((s, it) => s + it.quantidade * it.preco_unitario * (1 - (it.desconto_pct || 0) / 100), 0),
    [itens]
  );
  const valorDesconto = subtotal * (descontoPct / 100);
  const total = Math.max(0, subtotal - valorDesconto);
  const bloqueadoDesc = descontoBloqueado(descontoPct);
  const exigeAprovacao = !bloqueadoDesc && descontoPct > LIMITE_DESCONTO_APROVACAO;

  const validarMultiplos = (): string | null => {
    for (const it of itens) {
      if (!it.embalagem_id) continue; // item livre (ex.: consultoria)
      const emb = embalagens.find(e => e.id === it.embalagem_id);
      const mult = multiploEmbalagem(emb);
      if (mult > 1 && it.quantidade % mult !== 0) {
        return `Item "${it.produto_nome || "—"}": quantidade deve ser múltiplo de ${mult} ${emb?.unidade ?? "L"} (embalagem ${emb?.nome ?? ""}).`;
      }
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    if (!clienteId) return toast.error("Selecione um cliente");
    if (itens.length === 0) return toast.error("Adicione ao menos um item");
    if (itens.some((i) => !i.produto_nome || i.quantidade <= 0))
      return toast.error("Verifique produtos e quantidades");
    if (bloqueadoDesc) return toast.error("Desconto acima de 15% — não permitido");
    const erro = validarMultiplos();
    if (erro) return toast.error(erro);

    setSaving(true);
    try {
      // Numeração sequencial por organização
      const { count: totalPedidos } = await supabase
        .from("nutrir_pedidos" as any)
        .select("*", { count: "exact", head: true })
        .eq("organization_id", current.id);
      const numero = `R-${String((totalPedidos ?? 0) + 1).padStart(4, "0")}`;
      const { data: pedido, error } = await supabase
        .from("nutrir_pedidos" as any)
        .insert({
          organization_id: current.id,
          created_by: user.id,
          cliente_id: clienteId,
          tipo_venda: tipoVenda,
          nome_agenciador: tipoVenda === "venda_agenciada" ? (nomeAgenciador || null) : null,
          condicao_pagamento: condicaoPagamento,
          data_vencimento: dataVencimento ? format(dataVencimento, "yyyy-MM-dd") : null,
          data_entrega: dataEntrega ? format(dataEntrega, "yyyy-MM-dd") : null,
          orcamento_origem_id: orcamentoOrigemId || null,
          observacoes: observacoes || null,
          subtotal,
          desconto: valorDesconto,
          total,
          status: exigeAprovacao ? "rascunho" : "aguardando_assinatura",
          numero,
        })
        .select()
        .single();
      if (error) throw error;
      const itensPayload = itens
        .filter(it => it.produto_id) // só itens com produto vão para nutrir_pedido_itens (consultoria fica no observacoes/total)
        .map((it, idx) => ({
          pedido_id: (pedido as any).id,
          produto_id: it.produto_id,
          embalagem_id: it.embalagem_id,
          quantidade: it.quantidade,
          preco_unitario: it.preco_unitario,
          desconto_pct: it.desconto_pct || null,
          subtotal: it.quantidade * it.preco_unitario * (1 - (it.desconto_pct || 0) / 100),
          ordem: idx,
        }));
      if (itensPayload.length) {
        const { error: e2 } = await supabase.from("nutrir_pedido_itens" as any).insert(itensPayload);
        if (e2) throw e2;
      }
      if (exigeAprovacao) {
        toast.warning(`Pedido ${numero} salvo como rascunho — aprovação do gerente exigida (desconto ${descontoPct}%)`);
      } else {
        toast.success(`Pedido ${numero} criado — aguardando assinatura`);
      }
      setOpen(false); reset(); load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  // ── Assinatura/envio (mantido) ────────────────────────────────
  const dataUrlToBlob = (dataUrl: string) => {
    const [head, b64] = dataUrl.split(",");
    const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const confirmarAssinatura = async (dataUrl: string) => {
    if (!selected || !user) return;
    if (!nomeAssinante.trim()) return toast.error("Informe o nome de quem assinou");
    try {
      const blob = dataUrlToBlob(dataUrl);
      const path = `${user.id}/${selected.id}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("pedidos-assinaturas")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("nutrir_pedidos" as any)
        .update({
          assinatura_path: path,
          assinatura_nome: nomeAssinante,
          assinatura_em: new Date().toISOString(),
          status: "assinado",
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Pedido assinado!");
      setOpenAssinar(false);
      setNomeAssinante("");
      const { data } = await supabase.from("nutrir_pedidos" as any).select("*").eq("id", selected.id).single();
      setSelected(data);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar assinatura");
    }
  };

  const enviarParaCentral = async () => {
    if (!selected) return;
    if (selected.status !== "assinado") return toast.error("Assine o pedido antes de enviar");
    const { error } = await supabase
      .from("nutrir_pedidos" as any)
      .update({ status: "enviado" })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado para a central");
    const { data } = await supabase.from("nutrir_pedidos" as any).select("*").eq("id", selected.id).single();
    setSelected(data);
    load();
  };

  const verAssinatura = async (path: string) => {
    const { data } = await supabase.storage.from("pedidos-assinaturas").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const clienteLabel = (id: string | null) =>
    id ? clientes.find((c) => c.id === id)?.razao_social ?? "—" : "—";

  return (
    <>
      <div className="px-3 md:px-6 pt-3"><VendedorBadge /></div>
      <PageHeader
        title="Pedidos"
        description="Crie pedidos no campo, colha assinatura digital e envie para a central"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Novo pedido</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3 max-h-[78vh] overflow-y-auto pr-1">

                {/* Banner de draft vindo da calculadora */}
                {draftBanner && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                    <ShoppingCart className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{draftBanner}</span>
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setDraftBanner(null)}>✕</button>
                  </div>
                )}

                {/* Cabeçalho */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.razao_social}{c.nome_fantasia ? ` (${c.nome_fantasia})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de venda</Label>
                    <Select value={tipoVenda} onValueChange={setTipoVenda}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_VENDA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Alerta B2B: cotação sem preços expostos */}
                {tipoVenda === "b2b" && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800">
                      <strong>Modo Cotação B2B:</strong> Os preços <strong>não serão exibidos</strong> ao cliente no PDF — apenas quantidades e produtos. O gerente/administrador receberá notificação para aprovação antes do envio.
                    </div>
                  </div>
                )}
                {tipoVenda === "venda_agenciada" && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-800">
                        <strong>Venda Agenciada:</strong> Pedido intermediado. Faturamento direto empresa↔cliente final.
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nome do agenciador / consultor <span className="text-destructive">*</span></Label>
                      <Input
                        value={nomeAgenciador}
                        onChange={(e) => setNomeAgenciador(e.target.value)}
                        placeholder="Ex.: João Silva — Consultor Externo"
                        required={tipoVenda === "venda_agenciada"}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data de vencimento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !dataVencimento && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecionar data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <p className="text-[11px] text-muted-foreground">
                      Condição: <strong className={condicaoPagamento === "a_vista" ? "text-[#b08826]" : "text-amber-600"}>
                        {condicaoPagamento === "a_vista" ? "À vista" : "A prazo"}
                      </strong>
                      {" "}(à vista até último dia do mês seguinte ao pedido)
                    </p>
                    {/* Resumo das regras de juros */}
                    <div className="rounded-md bg-blue-50 border border-blue-100 p-2 text-[10px] text-blue-800 space-y-0.5">
                      <div className="font-semibold text-[11px] flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Regras de juros de mora</div>
                      <div>• Carência: {JUROS_CARENCIA_DIAS} dias após vencimento sem juros</div>
                      <div>• Após carência: {(JUROS_MES * 100).toFixed(1)}% ao mês ({(JUROS_DIA * 100).toFixed(4)}% ao dia) sobre o saldo devedor</div>
                      {condicaoPagamento === "a_vista" && (
                        <div className="text-emerald-700 font-medium">✓ Pagamento à vista — sem juros em caso de pontualidade</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Previsão de entrega</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !dataEntrega && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataEntrega ? format(dataEntrega, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecionar data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dataEntrega} onSelect={setDataEntrega} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Importar de orçamento</Label>
                    <Select value={orcamentoOrigemId || "none"} onValueChange={(v) => importarOrcamento(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {orcamentos.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.titulo ?? "Orçamento"} · {fmtBRL(Number(o.total_geral ?? 0))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Importa produtos, complexantes e custo da consultoria (não importa sais/adubos).
                    </p>
                  </div>
                </div>

                {/* Itens do pedido */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label>Itens do pedido</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addItem}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar linha
                    </Button>
                  </div>
                  {itens.length === 0 && (
                    <div className="text-xs text-muted-foreground border rounded-md p-3 text-center">
                      Nenhum item — clique em <strong>Adicionar linha</strong>.
                    </div>
                  )}

                  {itens.map((it, i) => {
                    const emb = embalagens.find(e => e.id === it.embalagem_id) ?? null;
                    const mult = multiploEmbalagem(emb);
                    const qtdInvalida = it.embalagem_id != null && mult > 1 && it.quantidade > 0 && it.quantidade % mult !== 0;
                    const subtotalLinha = it.quantidade * it.preco_unitario * (1 - (it.desconto_pct || 0) / 100);
                    const isConsultoria = !it.produto_id && it.produto_nome.startsWith("Consultoria");
                    const prodsFiltrados = produtosFiltradosPorLinha(i);
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                        {/* Filtro de linha (cascade) */}
                        {!isConsultoria && linhasDisponiveis.length > 0 && (
                          <div className="col-span-12 md:col-span-3 space-y-1">
                            <Label className="text-xs">Linha</Label>
                            <Select
                              value={linhaFiltro[i] ?? ""}
                              onValueChange={(v) => {
                                setLinhaFiltro(prev => ({ ...prev, [i]: v === "__todas__" ? "" : v }));
                                updItem(i, { produto_id: "", produto_nome: "", embalagem_id: null, preco_unitario: 0 });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__todas__">Todas as linhas</SelectItem>
                                {linhasDisponiveis.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className={`${!isConsultoria && linhasDisponiveis.length > 0 ? "col-span-12 md:col-span-4" : "col-span-12 md:col-span-4"} space-y-1`}>
                          <Label className="text-xs">Produto</Label>
                          {isConsultoria ? (
                            <Input value={it.produto_nome} disabled />
                          ) : (
                            <Select value={it.produto_id} onValueChange={(v) => updItem(i, { produto_id: v })}>
                              <SelectTrigger><SelectValue placeholder={produtos.length === 0 ? "Sem produtos cadastrados" : "Selecionar"} /></SelectTrigger>
                              <SelectContent className="max-h-64">
                                {produtos.length === 0 ? (
                                  <div className="px-3 py-3 text-xs text-muted-foreground">
                                    Nenhum produto cadastrado.{" "}
                                    <a href="/app/gestao/produtos" className="text-primary underline">Cadastrar →</a>
                                  </div>
                                ) : prodsFiltrados.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs">Embalagem</Label>
                          <Select
                            value={it.embalagem_id ?? "none"}
                            onValueChange={(v) => updItem(i, { embalagem_id: v === "none" ? null : v })}
                            disabled={isConsultoria}
                          >
                            <SelectTrigger><SelectValue placeholder={embalagens.length === 0 ? "Sem embalagens" : "—"} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {embalagens.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-muted-foreground">
                                  Nenhuma embalagem.{" "}
                                  <a href="/app/nutrir/embalagens" className="text-primary underline">Cadastrar →</a>
                                </div>
                              ) : embalagens.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.nome} · múltiplo de {fmtInt(Number(e.volume ?? 1))} {e.unidade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3 md:col-span-2 space-y-1">
                          <Label className="text-xs">Qtd. ({emb?.unidade ?? "un"})</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step={mult}
                              min={0}
                              value={it.quantidade || ""}
                              onChange={(e) => updItem(i, { quantidade: Number(e.target.value) || 0 })}
                              onBlur={(e) => {
                                if (mult > 1 && it.quantidade > 0) {
                                  const ajustada = Math.max(mult, Math.round(it.quantidade / mult) * mult);
                                  if (ajustada !== it.quantidade) updItem(i, { quantidade: ajustada });
                                }
                              }}
                              className={cn(qtdInvalida && "border-red-500")}
                              disabled={isConsultoria}
                            />
                          </div>
                          {qtdInvalida && (
                            <p className="text-[10px] text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> múltiplo de {mult}
                            </p>
                          )}
                        </div>
                        {tipoVenda !== "b2b" && (
                          <div className="col-span-3 md:col-span-2 space-y-1">
                            <Label className="text-xs">Preço final</Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                              <Input
                                className="pl-7 font-mono"
                                value={it.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                disabled
                                title="Preço final calculado (regional + tipo de venda + embalagem). Não editável."
                              />
                            </div>
                          </div>
                        )}
                        <div className="col-span-12 md:col-span-1 flex justify-end">
                          <Button type="button" size="icon" variant="ghost" onClick={() => rmItem(i)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        {tipoVenda !== "b2b" && (
                          <div className="col-span-12 text-right text-sm">
                            Subtotal: <strong className="font-mono">{fmtBRL(subtotalLinha)}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desconto + totais */}
                {tipoVenda === "b2b" ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 text-center">
                    <strong>Cotação B2B</strong> — preços internos, não exibidos no documento do cliente.
                    Qtd. de itens: <strong>{itens.length}</strong>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="md:col-span-1">
                      <DescontoInput value={descontoPct} onChange={setDescontoPct} />
                    </div>
                    <div className="md:col-span-2 rounded-md border p-3 space-y-1 bg-muted/30">
                      <div className="flex justify-between text-sm"><span>Subtotal</span><strong className="font-mono">{fmtBRL(subtotal)}</strong></div>
                      <div className="flex justify-between text-sm"><span>Desconto ({descontoPct.toFixed(1)}%)</span><strong className="font-mono text-destructive">− {fmtBRL(valorDesconto)}</strong></div>
                      <div className="flex justify-between text-base"><span>Total</span><strong className="font-mono text-primary">{fmtBRL(total)}</strong></div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="submit" disabled={saving || (tipoVenda !== "b2b" && bloqueadoDesc)} className="bg-gradient-primary">
                    {saving ? "Salvando…"
                      : tipoVenda === "b2b" ? "Enviar cotação B2B"
                      : bloqueadoDesc ? "Desconto bloqueado"
                      : "Salvar pedido"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-0 divide-y max-h-[75vh] overflow-y-auto">
            {pedidos.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nenhum pedido ainda.
              </div>
            )}
            {pedidos.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 hover:bg-muted/40 transition ${selected?.id === p.id ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.numero ?? p.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {clienteLabel(p.cliente_id)} · <span className="font-mono">{fmtBRL(Number(p.total))}</span>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "outline"} className="text-[10px]">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {!selected ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-40" />
                <div className="text-sm">Selecione um pedido à esquerda</div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-lg">{selected.numero ?? selected.id.slice(0, 8)}</h3>
                    <div className="text-xs text-muted-foreground">
                      {clienteLabel(selected.cliente_id)} · {selected.data_pedido ? new Date(selected.data_pedido).toLocaleDateString("pt-BR") : ""}
                      {selected.tipo_venda ? ` · ${TIPOS_VENDA.find(t => t.value === selected.tipo_venda)?.label}` : ""}
                      {selected.condicao_pagamento ? ` · ${selected.condicao_pagamento === "a_vista" ? "À vista" : "A prazo"}` : ""}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[selected.status] ?? "outline"}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </Badge>
                </div>

                <div className="rounded-md border p-3 space-y-1 bg-muted/30 mb-4">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><strong className="font-mono">{fmtBRL(Number(selected.subtotal))}</strong></div>
                  <div className="flex justify-between text-sm"><span>Desconto</span><strong className="font-mono text-destructive">− {fmtBRL(Number(selected.desconto))}</strong></div>
                  <div className="flex justify-between text-base"><span>Total</span><strong className="font-mono text-primary">{fmtBRL(Number(selected.total))}</strong></div>
                  {/* Juros de mora */}
                  {(() => {
                    const venc = selected.data_vencimento ? new Date(selected.data_vencimento + "T00:00:00") : null;
                    const juros = calcularJuros(Number(selected.total), venc);
                    if (!juros || juros.juros === 0) return null;
                    return (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" /> Juros de mora (1,9%/mês · após 30d de carência)
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Dias em atraso: {juros.diasCorridos}d ({juros.diasAtraso}d com juros)</span>
                          <span className="text-amber-700 font-mono">+ {fmtBRL(juros.juros)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total com juros</span>
                          <strong className="font-mono text-amber-700">{fmtBRL(juros.totalComJuros)}</strong>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Vencimento e condição */}
                  {selected.data_vencimento && (
                    <div className="text-xs text-muted-foreground pt-1 flex gap-3">
                      <span>Vencimento: {new Date(selected.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      <span>Cond.: {selected.condicao_pagamento === "a_vista" ? "À vista" : "A prazo"}</span>
                    </div>
                  )}
                </div>

                {selected.observacoes && (
                  <div className="text-sm mb-3">
                    <div className="text-xs text-muted-foreground">Observações</div>
                    <p className="whitespace-pre-wrap">{selected.observacoes}</p>
                  </div>
                )}

                {selected.assinatura_path ? (
                  <div className="text-sm rounded-md border p-3 mb-3 bg-[#d4a843]/5">
                    <div className="text-xs text-muted-foreground mb-1">Assinatura</div>
                    <div>
                      <strong>{selected.assinatura_nome}</strong> em{" "}
                      {new Date(selected.assinatura_em).toLocaleString("pt-BR")}
                    </div>
                    <Button size="sm" variant="link" className="px-0" onClick={() => verAssinatura(selected.assinatura_path)}>
                      Ver assinatura
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selected.status === "aguardando_assinatura" && (
                    <Dialog open={openAssinar} onOpenChange={setOpenAssinar}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-gradient-primary">
                          <FileSignature className="h-4 w-4 mr-1" /> Coletar assinatura
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xl">
                        <DialogHeader><DialogTitle>Assinatura do cliente</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label>Nome de quem está assinando</Label>
                            <Input
                              value={nomeAssinante}
                              onChange={(e) => setNomeAssinante(e.target.value)}
                              placeholder="Ex.: João da Silva"
                            />
                          </div>
                          <SignaturePad onConfirm={confirmarAssinatura} />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {selected.status === "assinado" && (
                    <Button size="sm" onClick={enviarParaCentral} className="bg-gradient-primary">
                      <Send className="h-4 w-4 mr-1" /> Enviar à central
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const { pdfPedido, savePdf } = await import("@/lib/pdfReports");
                      const { data: itens } = await supabase.from("nutrir_pedido_itens" as any).select("*").eq("pedido_id", selected.id);
                      const { data: cli } = await supabase.from("nutrir_clientes").select("*").eq("id", selected.cliente_id).maybeSingle();
                      const doc = pdfPedido(selected, (itens as any[]) ?? [], cli, current?.name);
                      savePdf(doc, `pedido-${selected.numero ?? selected.id.slice(0,8)}.pdf`);
                    }}
                  >
                    <FileIcon className="h-4 w-4 mr-1" /> Baixar PDF
                  </Button>
                  {selected.status !== "cancelado" && selected.status !== "faturado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm("Cancelar este pedido?")) return;
                        await supabase.from("nutrir_pedidos" as any).update({ status: "cancelado" }).eq("id", selected.id);
                        toast.success("Pedido cancelado");
                        const { data } = await supabase.from("nutrir_pedidos" as any).select("*").eq("id", selected.id).single();
                        setSelected(data); load();
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
