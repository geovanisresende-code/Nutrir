import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Camera, Sparkles, FileText, Trash2, FlaskConical, ImagePlus, X, Map as MapIcon, Satellite } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MapaTalhao } from "@/components/nutrir/MapaTalhao";

type Produto = {
  produto_id: string | null;
  nome: string;
  area_ha: number;
  dose: string;
  estagio: string;
  observacao: string;
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  em_andamento: "default", finalizado: "secondary", cancelado: "destructive",
};

export default function CamposTeste() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const clienteFiltroDaUrl = searchParams.get("cliente");
  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtosDB, setProdutosDB] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [openRel, setOpenRel] = useState(false);
  const [genIA, setGenIA] = useState(false);
  const [ndviSerie, setNdviSerie] = useState<any[]>([]);
  const [ndviLoading, setNdviLoading] = useState(false);

  // form principal
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [cultura, setCultura] = useState("");
  const [variedade, setVariedade] = useState("");
  const [dataPlantio, setDataPlantio] = useState("");
  const [areaTotal, setAreaTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([
    { produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" },
  ]);
  const [novaGeo, setNovaGeo] = useState<any | null>(null);
  const [novoCentro, setNovoCentro] = useState<[number, number] | null>(null);
  const [showMapaNovo, setShowMapaNovo] = useState(false);

  // form relatório
  const [relData, setRelData] = useState(new Date().toISOString().slice(0, 10));
  const [relEstagio, setRelEstagio] = useState("");
  const [relObs, setRelObs] = useState("");
  const [relNdvi, setRelNdvi] = useState("");
  const [relFotos, setRelFotos] = useState<File[]>([]);

  const load = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("nutrir_campos_teste" as any)
      .select("*")
      .eq("organization_id", current.id)
      .order("created_at", { ascending: false });
    setItems((data as any[]) ?? []);
    const { data: cli } = await supabase
      .from("nutrir_clientes")
      .select("id, razao_social")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("razao_social");
    setClientes(cli ?? []);
    const { data: prods } = await supabase
      .from("nutrir_produtos")
      .select("id, nome")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("nome");
    setProdutosDB((prods as any[]) ?? []);
  };
  useEffect(() => { load(); }, [current?.id]);

  // Auto-seleciona o teste do cliente quando vier via query param (?cliente=ID)
  useEffect(() => {
    if (!clienteFiltroDaUrl || items.length === 0) return;
    const ativo = items.find(
      (i) => i.cliente_id === clienteFiltroDaUrl && i.status === "em_andamento"
    ) ?? items.find((i) => i.cliente_id === clienteFiltroDaUrl);
    if (ativo) {
      setSelected(ativo);
      loadRelatorios(ativo.id);
      loadNdvi(ativo.id);
      toast.info(`Teste do cliente carregado automaticamente`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteFiltroDaUrl, items.length]);

  const loadRelatorios = async (campoId: string) => {
    const { data } = await supabase
      .from("nutrir_campos_teste_relatorios" as any)
      .select("*")
      .eq("campo_teste_id", campoId)
      .order("data", { ascending: true });
    setRelatorios((data as any[]) ?? []);
  };

  const loadNdvi = async (campoId: string) => {
    const { data } = await supabase
      .from("nutrir_campos_teste_ndvi" as any)
      .select("*")
      .eq("campo_teste_id", campoId)
      .order("data", { ascending: true });
    setNdviSerie((data as any[]) ?? []);
  };

  const salvarGeometria = async (geo: any, centro: [number, number]) => {
    if (!selected) return;
    const { error } = await supabase
      .from("nutrir_campos_teste" as any)
      .update({ geometria: geo, centro_lat: centro[0], centro_lng: centro[1] })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Talhão salvo!");
    const { data } = await supabase.from("nutrir_campos_teste" as any).select("*").eq("id", selected.id).single();
    setSelected(data);
    load();
  };

  const gerarNdvi = async (mode: "latest" | "history") => {
    if (!selected) return;
    if (!selected.geometria) return toast.error("Desenhe e salve o talhão antes.");
    setNdviLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("campo-teste-ndvi", {
        body: { campo_teste_id: selected.id, mode },
      });
      if (error) throw error;
      toast.success(`NDVI atualizado (${data?.count ?? 0} pontos)`);
      loadNdvi(selected.id);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao buscar NDVI");
    } finally { setNdviLoading(false); }
  };

  const reset = () => {
    setTitulo(""); setClienteId(""); setCultura(""); setVariedade(""); setDataPlantio("");
    setAreaTotal(""); setObservacoes("");
    setProdutos([{ produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" }]);
    setNovaGeo(null); setNovoCentro(null); setShowMapaNovo(false);
  };

  const addProduto = () => setProdutos([...produtos, { produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" }]);
  const rmProduto = (i: number) => setProdutos(produtos.filter((_, k) => k !== i));
  const updProduto = (i: number, p: Partial<Produto>) =>
    setProdutos(produtos.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        organization_id: current.id,
        user_id: user.id,
        cliente_id: clienteId,
        titulo,
        cultura: cultura || null,
        variedade: variedade || null,
        data_plantio: dataPlantio || null,
        area_total_ha: Number(areaTotal.replace(",", ".")) || 0,
        produtos,
        observacoes: observacoes || null,
        status: "em_andamento" as const,
      };
      if (novaGeo && novoCentro) {
        payload.geometria = novaGeo;
        payload.centro_lat = novoCentro[0];
        payload.centro_lng = novoCentro[1];
      }
      const { error } = await supabase.from("nutrir_campos_teste" as any).insert(payload);
      if (error) throw error;
      toast.success("Campo de teste criado");
      setOpen(false); reset(); load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const submitRelatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user || !selected) return;
    setSaving(true);
    try {
      const fotos: { path: string; legenda: string }[] = [];
      for (const f of relFotos) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${selected.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("campos-teste-fotos").upload(path, f);
        if (upErr) throw upErr;
        fotos.push({ path, legenda: f.name });
      }
      const { error } = await supabase.from("nutrir_campos_teste_relatorios" as any).insert({
        organization_id: current.id,
        campo_teste_id: selected.id,
        user_id: user.id,
        data: relData,
        estagio: relEstagio || null,
        observacoes: relObs || null,
        ndvi_medio: relNdvi ? Number(relNdvi.replace(",", ".")) : null,
        fotos,
      });
      if (error) throw error;
      toast.success("Acompanhamento salvo");
      setOpenRel(false);
      setRelEstagio(""); setRelObs(""); setRelNdvi(""); setRelFotos([]);
      loadRelatorios(selected.id);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar relatório");
    } finally { setSaving(false); }
  };

  const finalizarComIA = async () => {
    if (!selected) return;
    if (!confirm("Gerar relatório final com IA e finalizar este teste?")) return;
    setGenIA(true);
    try {
      const { error } = await supabase.functions.invoke("campo-teste-relatorio", {
        body: { campo_teste_id: selected.id },
      });
      if (error) throw error;
      toast.success("Relatório IA gerado! Gerando PDF…");

      // Recarrega o registro com o relatório IA salvo
      const { data: refreshed } = await supabase
        .from("nutrir_campos_teste" as any).select("*").eq("id", selected.id).single();
      setSelected(refreshed);

      // Carrega dados auxiliares pra o PDF
      const { data: cli } = await supabase
        .from("nutrir_clientes" as any).select("razao_social, cidade, uf")
        .eq("id", (refreshed as any)?.cliente_id).maybeSingle();
      const { data: rels } = await supabase
        .from("nutrir_campos_teste_relatorios" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { data: ndvi } = await supabase
        .from("nutrir_campos_teste_ndvi" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });

      // Gera PDF Canva-style e baixa
      const { gerarCampoTestePDF, baixarBlob } = await import("@/lib/nutrir/campo-teste-pdf");
      const blob = await gerarCampoTestePDF({
        campo: refreshed,
        cliente: cli as any,
        relatorios: (rels as any[]) ?? [],
        ndvi_serie: (ndvi as any[]) ?? [],
      });
      const nomeArq = `campo-teste-${((refreshed as any)?.titulo ?? "relatorio").replace(/\s+/g, "_").toLowerCase()}.pdf`;
      baixarBlob(blob, nomeArq);
      toast.success("PDF baixado!");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar relatório");
    } finally { setGenIA(false); }
  };

  // Permite baixar PDF de novo se o relatório já existir
  const baixarRelatorioPDF = async () => {
    if (!selected) return;
    try {
      toast.info("Gerando PDF…");
      const { data: cli } = await supabase
        .from("nutrir_clientes" as any).select("razao_social, cidade, uf")
        .eq("id", (selected as any)?.cliente_id).maybeSingle();
      const { data: rels } = await supabase
        .from("nutrir_campos_teste_relatorios" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { data: ndvi } = await supabase
        .from("nutrir_campos_teste_ndvi" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { gerarCampoTestePDF, baixarBlob } = await import("@/lib/nutrir/campo-teste-pdf");
      const blob = await gerarCampoTestePDF({
        campo: selected,
        cliente: cli as any,
        relatorios: (rels as any[]) ?? [],
        ndvi_serie: (ndvi as any[]) ?? [],
      });
      baixarBlob(blob, `campo-teste-${((selected as any)?.titulo ?? "relatorio").replace(/\s+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF baixado!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar PDF");
    }
  };

  const removerTeste = async (id: string) => {
    if (!confirm("Excluir este campo de teste?")) return;
    const { error } = await supabase.from("nutrir_campos_teste" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const verFoto = async (path: string) => {
    const { data } = await supabase.storage.from("campos-teste-fotos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const total = items.length;
  const ativos = useMemo(() => items.filter((i) => i.status === "em_andamento").length, [items]);

  return (
    <>
      <PageHeader
        title="Campos de Teste"
        description="Acompanhe testes em campo com fotos e relatório final por IA"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Novo teste</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Novo campo de teste</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                <div className="space-y-1.5"><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Teste foliar — Soja Fazenda Boa Vista" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId} required>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Cultura</Label><Input value={cultura} onChange={(e) => setCultura(e.target.value)} placeholder="Soja, Milho…" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Variedade / Material plantado</Label><Input value={variedade} onChange={(e) => setVariedade(e.target.value)} placeholder="Ex.: TMG 7062 IPRO" /></div>
                  <div className="space-y-1.5"><Label>Data de plantio</Label><Input type="date" value={dataPlantio} onChange={(e) => setDataPlantio(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Área total de teste</Label>
                    <div className="relative">
                      <Input
                        inputMode="decimal"
                        className="pr-10"
                        value={areaTotal}
                        onChange={(e) => setAreaTotal(e.target.value.replace(/^0+(?=\d)/, ""))}
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ha</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Produtos testados</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addProduto}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                  </div>
                  {produtos.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={p.produto_id ?? (p.nome ? "__outro__" : "")}
                          onValueChange={(v) => {
                            if (v === "__outro__") {
                              updProduto(i, { produto_id: null, nome: "" });
                            } else {
                              const prod = produtosDB.find((x) => x.id === v);
                              updProduto(i, { produto_id: v, nome: prod?.nome ?? "" });
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent className="max-h-64">
                            {produtosDB.map((pp) => <SelectItem key={pp.id} value={pp.id}>{pp.nome}</SelectItem>)}
                            <SelectItem value="__outro__">Outro (digitar)</SelectItem>
                          </SelectContent>
                        </Select>
                        {p.produto_id === null && (
                          <Input
                            className="mt-1"
                            placeholder="Nome do produto"
                            value={p.nome}
                            onChange={(e) => updProduto(i, { nome: e.target.value })}
                            required
                          />
                        )}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Área</Label>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="pr-8"
                            value={p.area_ha ? String(p.area_ha) : ""}
                            onChange={(e) => updProduto(i, { area_ha: Number(e.target.value.replace(",", ".")) || 0 })}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">ha</span>
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Dose/ha</Label>
                        <Input value={p.dose} onChange={(e) => updProduto(i, { dose: e.target.value })} placeholder="L/ha" />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Estágio fenológico de aplicação</Label>
                        <Input value={p.estagio} onChange={(e) => updProduto(i, { estagio: e.target.value })} placeholder="Ex.: V4, R1…" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {produtos.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => rmProduto(i)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="col-span-12 space-y-1">
                        <Label className="text-xs">Observação</Label>
                        <Input value={p.observacao} onChange={(e) => updProduto(i, { observacao: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5"><Label>Observações gerais</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

                <div className="space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Área de teste no mapa</Label>
                      <div className="text-xs text-muted-foreground">
                        {novaGeo ? "Talhão definido ✔" : "Opcional — desenhe a área do teste"}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowMapaNovo((v) => !v)}>
                      <MapIcon className="h-4 w-4 mr-1" /> {showMapaNovo ? "Ocultar mapa" : "Selecionar área"}
                    </Button>
                  </div>
                  {showMapaNovo && (
                    <MapaTalhao
                      geometria={novaGeo}
                      centro={novoCentro}
                      onSave={(geo, centro) => {
                        setNovaGeo(geo);
                        setNovoCentro(centro);
                        toast.success("Área definida — será salva ao criar o teste");
                      }}
                      height={320}
                    />
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={saving} className="bg-gradient-primary">{saving ? "Salvando…" : "Criar teste"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total de testes</div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em andamento</div><div className="text-2xl font-bold">{ativos}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Finalizados</div><div className="text-2xl font-bold">{total - ativos}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista */}
          <Card className="lg:col-span-1">
            <CardContent className="p-0 divide-y max-h-[70vh] overflow-y-auto">
              {items.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">Nenhum teste cadastrado.</div>
              )}
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => { setSelected(i); loadRelatorios(i.id); loadNdvi(i.id); }}
                  className={`w-full text-left p-3 hover:bg-muted/40 transition ${selected?.id === i.id ? "bg-muted/60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{i.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {i.cultura ?? "—"} · {Number(i.area_total_ha).toLocaleString("pt-BR")} ha
                      </div>
                    </div>
                    <Badge variant={STATUS_COLORS[i.status]} className="text-[10px]">{i.status.replace("_", " ")}</Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Detalhe */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              {!selected ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FlaskConical className="h-10 w-10 mb-3 opacity-40" />
                  <div className="text-sm">Selecione um teste à esquerda</div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{selected.titulo}</h3>
                      <div className="text-xs text-muted-foreground">
                        {selected.cultura ?? "—"} · {Number(selected.area_total_ha).toLocaleString("pt-BR")} ha · plantio {selected.data_plantio ?? "—"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {selected.status === "em_andamento" && (
                        <Button size="sm" onClick={finalizarComIA} disabled={genIA} className="bg-gradient-primary">
                          <Sparkles className="h-4 w-4 mr-1" /> {genIA ? "Gerando…" : "Finalizar com IA"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removerTeste(selected.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue="acomp">
                    <TabsList>
                      <TabsTrigger value="acomp">Acompanhamentos ({relatorios.length})</TabsTrigger>
                      <TabsTrigger value="mapa"><MapIcon className="h-3.5 w-3.5 mr-1" />Mapa/NDVI</TabsTrigger>
                      <TabsTrigger value="produtos">Produtos</TabsTrigger>
                      <TabsTrigger value="relatorio">Relatório IA</TabsTrigger>
                    </TabsList>

                    <TabsContent value="acomp" className="space-y-3 mt-3">
                      <Dialog open={openRel} onOpenChange={setOpenRel}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Novo acompanhamento</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader><DialogTitle>Acompanhamento</DialogTitle></DialogHeader>
                          <form onSubmit={submitRelatorio} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={relData} onChange={(e) => setRelData(e.target.value)} required /></div>
                              <div className="space-y-1.5"><Label>Estágio fenológico</Label><Input value={relEstagio} onChange={(e) => setRelEstagio(e.target.value)} placeholder="V4, R1…" /></div>
                            </div>
                            <div className="space-y-1.5"><Label>NDVI médio (opcional)</Label><Input inputMode="decimal" value={relNdvi} onChange={(e) => setRelNdvi(e.target.value)} placeholder="0.78" /></div>
                            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={relObs} onChange={(e) => setRelObs(e.target.value)} /></div>
                            <div className="space-y-1.5">
                              <Label className="flex items-center gap-1.5"><Camera className="h-4 w-4" /> Fotos</Label>
                              <Input type="file" multiple accept="image/*" capture="environment" onChange={(e) => setRelFotos(Array.from(e.target.files ?? []))} />
                              {relFotos.length > 0 && (
                                <div className="text-xs text-muted-foreground">{relFotos.length} foto(s) selecionada(s)</div>
                              )}
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={saving} className="bg-gradient-primary">{saving ? "Salvando…" : "Salvar"}</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {relatorios.length === 0 && (
                        <div className="text-sm text-muted-foreground py-6 text-center">Nenhum acompanhamento ainda.</div>
                      )}
                      {relatorios.map((r) => (
                        <div key={r.id} className="border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{r.data} {r.estagio && <span className="text-xs text-muted-foreground">· {r.estagio}</span>}</div>
                            {r.ndvi_medio != null && <Badge variant="outline">NDVI {Number(r.ndvi_medio).toFixed(2)}</Badge>}
                          </div>
                          {r.observacoes && <div className="text-sm text-muted-foreground">{r.observacoes}</div>}
                          {Array.isArray(r.fotos) && r.fotos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {r.fotos.map((f: any, i: number) => (
                                <button key={i} onClick={() => verFoto(f.path)} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/70">
                                  <ImagePlus className="h-3 w-3" /> Foto {i + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="mapa" className="mt-3 space-y-3">
                      <MapaTalhao
                        geometria={selected.geometria}
                        centro={selected.centro_lat && selected.centro_lng ? [Number(selected.centro_lat), Number(selected.centro_lng)] : null}
                        onSave={salvarGeometria}
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button size="sm" variant="outline" disabled={ndviLoading || !selected.geometria} onClick={() => gerarNdvi("latest")}>
                          <Satellite className="h-4 w-4 mr-1" /> NDVI atual
                        </Button>
                        <Button size="sm" disabled={ndviLoading || !selected.geometria} onClick={() => gerarNdvi("history")} className="bg-gradient-primary">
                          <Satellite className="h-4 w-4 mr-1" /> {ndviLoading ? "Carregando…" : "Série 12 meses"}
                        </Button>
                        {!selected.geometria && (
                          <span className="text-xs text-muted-foreground">Desenhe e salve o talhão para liberar NDVI.</span>
                        )}
                      </div>
                      {ndviSerie.length > 0 && (
                        <div className="border rounded-md p-3">
                          <div className="text-sm font-medium mb-2">Histórico NDVI ({ndviSerie[0]?.fonte})</div>
                          <div className="space-y-1">
                            {ndviSerie.map((n) => (
                              <div key={n.id} className="flex items-center gap-2 text-xs">
                                <span className="w-20 text-muted-foreground">{n.data}</span>
                                <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 via-lime-500 to-emerald-600"
                                    style={{ width: `${Math.max(5, Math.min(100, Number(n.ndvi_mean) * 100))}%` }}
                                  />
                                </div>
                                <span className="w-12 text-right font-mono">{Number(n.ndvi_mean).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="produtos" className="mt-3">
                      <div className="space-y-2">
                        {(selected.produtos ?? []).map((p: any, i: number) => (
                          <div key={i} className="border rounded-md p-3">
                            <div className="font-medium text-sm">{p.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.area_ha} ha · dose {p.dose || "—"} {p.observacao && `· ${p.observacao}`}
                            </div>
                          </div>
                        ))}
                        {(selected.observacoes) && (
                          <div className="text-sm pt-2"><span className="text-muted-foreground">Obs.: </span>{selected.observacoes}</div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="relatorio" className="mt-3">
                      {selected.relatorio_final_resumo ? (
                        <div className="space-y-3">
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={baixarRelatorioPDF}>
                              <FileText className="h-4 w-4 mr-1.5" />Baixar PDF
                            </Button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{selected.relatorio_final_resumo}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          Nenhum relatório gerado ainda. Use "Finalizar com IA".
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
