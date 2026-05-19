import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Plus, Trash2, AlertOctagon, AlertTriangle, Info, MapPin, X, Truck, FlaskConical, Cloud, Sun, CloudRain, Wind } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/AppShell";
import { useNavigate } from "react-router-dom";
import VendedorBadge from "@/components/representante/VendedorBadge";

type MotivoEnum =
  | "rotina_relacionamento" | "prospeccao_venda" | "acompanhamento_teste"
  | "entrega_produto" | "acompanhamento_aplicacao" | "geracao_demanda"
  | "dia_de_campo" | "evento_social" | "outro";

const MOTIVOS: { v: MotivoEnum; l: string }[] = [
  { v: "rotina_relacionamento", l: "Visita de Rotina (Relacionamento)" },
  { v: "prospeccao_venda", l: "Prospecção de Venda" },
  { v: "acompanhamento_teste", l: "Acompanhamento de Teste" },
  { v: "entrega_produto", l: "Entrega de Produto" },
  { v: "acompanhamento_aplicacao", l: "Acompanhamento de Aplicação" },
  { v: "geracao_demanda", l: "Geração de Demanda" },
  { v: "dia_de_campo", l: "Dia de Campo" },
  { v: "evento_social", l: "Evento Social" },
  { v: "outro", l: "Outro" },
];

type AlertaNivel = "muito_urgente" | "ponto_atencao" | "relato_rotina";

interface Cliente { id: string; razao_social: string; nome_fantasia: string | null; }
interface ClimaSnapshot {
  temperatura: number;
  descricao: string;
  vento_kmh: number;
  precipitacao_mm: number;
  codigo_wmo: number;
}

interface Visita {
  id: string; data_visita: string; motivo: MotivoEnum; motivo_outro: string | null;
  cliente_id: string | null; cliente_nome_livre: string | null;
  relato: string; observacao: string | null;
  fotos: string[]; alerta_nivel: AlertaNivel | null;
  latitude: number | null; longitude: number | null;
  clima: ClimaSnapshot | null;
  created_at: string;
}

/* ── Open-Meteo helpers ── */
function wmoDescricao(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code <= 3)  return "Parcialmente nublado";
  if (code <= 9)  return "Neblina";
  if (code <= 19) return "Chuva leve";
  if (code <= 29) return "Tempestade passando";
  if (code <= 39) return "Neblina com gelo";
  if (code <= 49) return "Nevoeiro";
  if (code <= 59) return "Garoa";
  if (code <= 67) return "Chuva";
  if (code <= 77) return "Neve";
  if (code <= 82) return "Aguaceiro";
  if (code <= 84) return "Granizo";
  if (code <= 94) return "Neve com granizo";
  return "Tempestade com raios";
}

function wmoIcone(code: number) {
  if (code === 0 || code === 1) return <Sun className="h-4 w-4 text-yellow-500" />;
  if (code <= 3) return <Cloud className="h-4 w-4 text-slate-400" />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className="h-4 w-4 text-blue-500" />;
  return <Cloud className="h-4 w-4 text-slate-500" />;
}

async function fetchClima(lat: number, lng: number): Promise<ClimaSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,precipitation&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const c = json.current;
    return {
      temperatura: Math.round(c.temperature_2m * 10) / 10,
      descricao: wmoDescricao(c.weathercode),
      vento_kmh: Math.round(c.windspeed_10m),
      precipitacao_mm: c.precipitation ?? 0,
      codigo_wmo: c.weathercode,
    };
  } catch {
    return null;
  }
}

const EXEMPLO_OBS =
  "Ex.: Concorrência visitou o cliente e apresentou complexador mais barato (20 L/batida) e o produtor ficou interessado. " +
  "Lavoura apresentou fitotoxidez, adjuvante não funcionou, etc.";

export default function Visitas() {
  const { current } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [produtosDB, setProdutosDB] = useState<{ id: string; nome: string }[]>([]);

  // form state
  const [clienteId, setClienteId] = useState<string>("livre");
  const [clienteLivre, setClienteLivre] = useState("");
  const [motivo, setMotivo] = useState<MotivoEnum>("rotina_relacionamento");
  const [motivoOutro, setMotivoOutro] = useState("");
  const [relato, setRelato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<string[]>([]); // storage paths
  const [uploading, setUploading] = useState(false);
  const [alerta, setAlerta] = useState<AlertaNivel | null>(null);
  const [alertaTitulo, setAlertaTitulo] = useState("");
  const [geo, setGeo] = useState<{lat: number; lng: number} | null>(null);
  const [saving, setSaving] = useState(false);
  const [clima, setClima] = useState<ClimaSnapshot | null>(null);
  const [climaLoading, setClimaLoading] = useState(false);

  // Entregas (quando motivo = entrega_produto)
  type Entrega = { produto_id: string | null; produto_nome: string; unidade: string; quantidade: string; custo: string };
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [c, v, p] = await Promise.all([
      supabase.from("nutrir_clientes").select("id,razao_social,nome_fantasia")
        .eq("organization_id", current.id).eq("ativo", true).order("razao_social"),
      (supabase as any).from("nutrir_visitas").select("*")
        .eq("organization_id", current.id).order("data_visita", { ascending: false }).limit(100),
      supabase.from("nutrir_produtos").select("id,nome")
        .eq("organization_id", current.id).eq("ativo", true).order("nome"),
    ]);
    setClientes((c.data ?? []) as Cliente[]);
    setVisitas((v.data ?? []) as Visita[]);
    setProdutosDB((p.data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  const reset = () => {
    setClienteId("livre"); setClienteLivre(""); setMotivo("rotina_relacionamento");
    setMotivoOutro(""); setRelato(""); setObservacao(""); setFotos([]);
    setAlerta(null); setAlertaTitulo(""); setGeo(null); setClima(null);
    setEntregas([]);
  };

  useEffect(() => {
    if (motivo === "entrega_produto" && entregas.length === 0) {
      setEntregas([{ produto_id: null, produto_nome: "", unidade: "L", quantidade: "", custo: "" }]);
    } else if (motivo !== "entrega_produto" && entregas.length > 0) {
      setEntregas([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivo]);

  const addEntrega = () => setEntregas([...entregas, { produto_id: null, produto_nome: "", unidade: "L", quantidade: "", custo: "" }]);
  const rmEntrega = (i: number) => setEntregas(entregas.filter((_, k) => k !== i));
  const updEntrega = (i: number, patch: Partial<Entrega>) =>
    setEntregas(entregas.map((e, k) => (k === i ? { ...e, ...patch } : e)));


  const captureGeo = () => {
    if (!navigator.geolocation) { toast({ title: "GPS indisponível", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setGeo(pos);
        toast({ title: "Localização capturada" });
        setClimaLoading(true);
        const c = await fetchClima(pos.lat, pos.lng);
        setClima(c);
        setClimaLoading(false);
        if (c) toast({ title: `Clima: ${c.temperatura}°C — ${c.descricao}` });
      },
      () => toast({ title: "Não foi possível obter localização", variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    const newPaths: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) { toast({ title: `${file.name} > 8MB`, variant: "destructive" }); continue; }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error } = await supabase.storage.from("visitas-fotos").upload(path, file, { upsert: false });
      if (error) { toast({ title: "Falha no upload", description: error.message, variant: "destructive" }); continue; }
      newPaths.push(path);
    }
    setFotos(f => [...f, ...newPaths]);
    setUploading(false);
  };

  const removerFoto = async (path: string) => {
    await supabase.storage.from("visitas-fotos").remove([path]);
    setFotos(f => f.filter(p => p !== path));
  };

  const fotoUrl = (path: string) => {
    const { data } = supabase.storage.from("visitas-fotos").getPublicUrl(path);
    // bucket é privado: usa signed url
    return data.publicUrl;
  };
  const [signed, setSigned] = useState<Record<string,string>>({});
  useEffect(() => {
    (async () => {
      const map: Record<string,string> = {};
      for (const p of fotos) {
        const { data } = await supabase.storage.from("visitas-fotos").createSignedUrl(p, 3600);
        if (data?.signedUrl) map[p] = data.signedUrl;
      }
      setSigned(map);
    })();
  }, [fotos]);

  const salvar = async () => {
    if (!current || !user) return;
    if (clienteId === "livre" && !clienteLivre.trim()) { toast({ title: "Informe o cliente", variant: "destructive" }); return; }
    if (!relato.trim()) { toast({ title: "Relato é obrigatório", variant: "destructive" }); return; }
    if (motivo === "outro" && !motivoOutro.trim()) { toast({ title: "Descreva o motivo", variant: "destructive" }); return; }
    if (alerta && !alertaTitulo.trim()) { toast({ title: "Dê um título ao alerta", variant: "destructive" }); return; }

    setSaving(true);
    let ouvidoriaId: string | null = null;

    // 1) cria ouvidoria se houver alerta
    if (alerta) {
      const { data: ouv, error: ouvErr } = await (supabase as any).from("nutrir_ouvidoria").insert({
        organization_id: current.id, user_id: user.id,
        cliente_id: clienteId === "livre" ? null : clienteId,
        cliente_nome_livre: clienteId === "livre" ? clienteLivre : null,
        nivel: alerta,
        titulo: alertaTitulo,
        mensagem: relato + (observacao ? `\n\nObservação: ${observacao}` : ""),
      }).select("id").single();
      if (ouvErr) { toast({ title: "Erro ao criar alerta", description: ouvErr.message, variant: "destructive" }); setSaving(false); return; }
      ouvidoriaId = ouv?.id ?? null;
    }

    // 2) cria visita
    const { error } = await (supabase as any).from("nutrir_visitas").insert({
      organization_id: current.id, user_id: user.id,
      cliente_id: clienteId === "livre" ? null : clienteId,
      cliente_nome_livre: clienteId === "livre" ? clienteLivre : null,
      motivo, motivo_outro: motivo === "outro" ? motivoOutro : null,
      relato, observacao: observacao || null,
      fotos, alerta_nivel: alerta, ouvidoria_id: ouvidoriaId,
      latitude: geo?.lat ?? null, longitude: geo?.lng ?? null,
      clima: clima ?? null,
    });
    if (error) { setSaving(false); toast({ title: "Erro ao salvar visita", description: error.message, variant: "destructive" }); return; }

    // 3) Integração Estoque (se motivo = entrega_produto)
    let entregasOk = 0, entregasErr = 0;
    if (motivo === "entrega_produto" && clienteId !== "livre" && entregas.length > 0) {
      for (const en of entregas) {
        const nome = en.produto_nome || produtosDB.find((p) => p.id === en.produto_id)?.nome;
        const q = Number(en.quantidade.replace(",", ".")) || 0;
        if (!nome || q <= 0) continue;
        const { error: rpcErr } = await (supabase as any).rpc("estoque_movimentar", {
          _org: current.id,
          _cliente: clienteId,
          _produto_nome: nome,
          _unidade: en.unidade,
          _tipo: "entrada",
          _quantidade: q,
          _custo: en.custo ? Number(en.custo.replace(",", ".")) : null,
          _origem: "visita",
          _origem_id: null,
          _obs: `Entrega registrada na visita de ${new Date().toLocaleDateString("pt-BR")}`,
        });
        if (rpcErr) entregasErr++; else entregasOk++;
      }
    }
    setSaving(false);

    let msg = "Visita registrada";
    if (alerta) msg += " · alerta enviado à Ouvidoria";
    if (entregasOk > 0) msg += ` · ${entregasOk} entrada(s) no estoque do cliente`;
    if (entregasErr > 0) msg += ` · ${entregasErr} entrega(s) com erro`;
    toast({ title: msg });

    // 4) Ações pós-visita — botões contextuais
    const cId = clienteId !== "livre" ? clienteId : null;
    toast({
      title: "✅ Visita salva! O que fazer agora?",
      description: "Escolha a próxima ação:",
      action: (
        <div className="flex flex-col gap-1 mt-1">
          <button
            className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
            onClick={() => navigate("/app/nutrir")}
          >🧮 Fazer Cálculo</button>
          <button
            className="text-xs border px-2 py-1 rounded"
            onClick={() => navigate(cId ? `/app/rep/pedidos?cliente=${cId}` : "/app/rep/pedidos")}
          >🛒 Gerar Pedido</button>
          {cId && (
            <button
              className="text-xs border px-2 py-1 rounded"
              onClick={() => navigate(`/app/rep/clientes/${cId}`)}
            >👤 Ver Ficha do Cliente</button>
          )}
        </div>
      ) as any,
    });

    setOpen(false); reset(); load();
  };

  const motivoLabel = (m: MotivoEnum) => MOTIVOS.find(x => x.v === m)?.l ?? m;
  const clienteLabel = (v: Visita) =>
    v.cliente_id ? (clientes.find(c => c.id === v.cliente_id)?.razao_social ?? "Cliente") : (v.cliente_nome_livre || "—");

  return (
    <div className="space-y-6">
      <VendedorBadge />
      <PageHeader
        title="Relatório de Visitas"
        description="Registre suas visitas, fotos e alertas para a Ouvidoria"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />Nova visita</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova visita</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="livre">— Digitar nome manualmente —</SelectItem>
                        {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}{c.nome_fantasia ? ` (${c.nome_fantasia})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {clienteId === "livre" && (
                      <Input className="mt-2" placeholder="Nome do cliente" value={clienteLivre} onChange={e => setClienteLivre(e.target.value)} />
                    )}
                  </div>
                  <div>
                    <Label>Motivo da visita</Label>
                    <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoEnum)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{MOTIVOS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                    </Select>
                    {motivo === "outro" && (
                      <Input className="mt-2" placeholder="Descreva o motivo" value={motivoOutro} onChange={e => setMotivoOutro(e.target.value)} />
                    )}
                  </div>
                </div>

                {motivo === "entrega_produto" && (
                  <div className="border rounded-md p-3 space-y-2 bg-[#d4a843]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-[#b08826]" />
                        <Label className="text-sm font-semibold">Produtos entregues (entram no estoque do cliente)</Label></div>
                      <Button type="button" size="sm" variant="outline" onClick={addEntrega}><Plus className="w-3 h-3 mr-1" /> Item</Button>
                    </div>
                    {clienteId === "livre" && <div className="text-xs text-amber-700 dark:text-amber-400">Selecione um cliente cadastrado para registrar entrada no estoque.</div>}
                    {entregas.map((en, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-background">
                        <div className="col-span-12 md:col-span-5 space-y-1">
                          <Label className="text-xs">Produto</Label>
                          <Select value={en.produto_id ?? (en.produto_nome ? "__outro__" : "")} onValueChange={(v) => {
                            if (v === "__outro__") updEntrega(i, { produto_id: null, produto_nome: "" });
                            else { const p = produtosDB.find((x) => x.id === v); updEntrega(i, { produto_id: v, produto_nome: p?.nome ?? "" }); }
                          }}>
                            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent className="max-h-64">
                              {produtosDB.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                              <SelectItem value="__outro__">Outro (digitar)</SelectItem>
                            </SelectContent>
                          </Select>
                          {en.produto_id === null && <Input className="mt-1" placeholder="Nome do produto" value={en.produto_nome} onChange={(e) => updEntrega(i, { produto_nome: e.target.value })} />}
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1"><Label className="text-xs">Unidade</Label>
                          <Select value={en.unidade} onValueChange={(v) => updEntrega(i, { unidade: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="L">L</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="un">un</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1"><Label className="text-xs">Quantidade</Label>
                          <Input inputMode="decimal" value={en.quantidade} onChange={(e) => updEntrega(i, { quantidade: e.target.value.replace(/^0+(?=\d)/, "") })} /></div>
                        <div className="col-span-3 md:col-span-2 space-y-1"><Label className="text-xs">Custo un.</Label>
                          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                            <Input className="pl-7" inputMode="decimal" value={en.custo} onChange={(e) => updEntrega(i, { custo: e.target.value.replace(/^0+(?=\d)/, "") })} /></div></div>
                        <div className="col-span-1 flex justify-end">
                          {entregas.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => rmEntrega(i)}><X className="w-4 h-4 text-destructive" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {motivo === "acompanhamento_teste" && clienteId !== "livre" && (
                  <div className="border rounded-md p-3 bg-blue-500/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm"><FlaskConical className="w-4 h-4 text-blue-600" />
                      <span>Após salvar, abra <strong>Campos de Teste deste cliente</strong> para registrar o acompanhamento.</span></div>
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate(`/app/rep/campos-teste?cliente=${clienteId}`)}>Abrir teste do cliente</Button>
                  </div>
                )}

                <div>
                  <Label>Relato da visita *</Label>
                  <Textarea rows={4} placeholder="Descreva o que foi feito na visita…"
                    value={relato} onChange={e => setRelato(e.target.value)} />
                </div>

                <div>
                  <Label>Observação</Label>
                  <Textarea rows={3} placeholder={EXEMPLO_OBS} value={observacao} onChange={e => setObservacao(e.target.value)} />
                </div>

                <div>
                  <Label>Fotos da visita</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fotos.map(p => (
                      <div key={p} className="relative w-24 h-24 rounded border overflow-hidden">
                        {signed[p] ? <img src={signed[p]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted animate-pulse" />}
                        <button onClick={() => removerFoto(p)} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl px-1">
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                    <label className="w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-muted-foreground">
                      <Camera className="w-6 h-6"/>
                      <span className="text-xs mt-1">{uploading ? "Enviando..." : "Foto"}</span>
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                        onChange={e => onUpload(e.target.files)} />
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Localização &amp; Clima</Label>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={captureGeo} disabled={climaLoading}>
                      <MapPin className="w-4 h-4 mr-1"/>
                      {climaLoading ? "Buscando clima…" : "Capturar GPS + Clima"}
                    </Button>
                    {geo && <span className="text-xs text-muted-foreground">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</span>}
                  </div>
                  {clima && (
                    <div className="mt-2 flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-md px-3 py-2 text-sm">
                      {wmoIcone(clima.codigo_wmo)}
                      <span className="font-semibold text-sky-900">{clima.temperatura}°C</span>
                      <span className="text-sky-700">{clima.descricao}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                        <Wind className="h-3 w-3" />{clima.vento_kmh} km/h
                        {clima.precipitacao_mm > 0 && (
                          <><CloudRain className="h-3 w-3 ml-2" />{clima.precipitacao_mm} mm</>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Alerta para a Ouvidoria (opcional)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <Button type="button" variant={alerta === "muito_urgente" ? "destructive" : "outline"}
                      onClick={() => setAlerta(alerta === "muito_urgente" ? null : "muito_urgente")}>
                      <AlertOctagon className="w-4 h-4 mr-1"/>Muito Urgente
                    </Button>
                    <Button type="button" variant={alerta === "ponto_atencao" ? "default" : "outline"}
                      className={alerta === "ponto_atencao" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}
                      onClick={() => setAlerta(alerta === "ponto_atencao" ? null : "ponto_atencao")}>
                      <AlertTriangle className="w-4 h-4 mr-1"/>Ponto de Atenção
                    </Button>
                    <Button type="button" variant={alerta === "relato_rotina" ? "secondary" : "outline"}
                      onClick={() => setAlerta(alerta === "relato_rotina" ? null : "relato_rotina")}>
                      <Info className="w-4 h-4 mr-1"/>Relato de Rotina
                    </Button>
                  </div>
                  {alerta && (
                    <Input className="mt-2" placeholder="Título do alerta (ex.: Concorrência ofereceu desconto agressivo)"
                      value={alertaTitulo} onChange={e => setAlertaTitulo(e.target.value)} />
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Registrar visita"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : visitas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma visita registrada ainda. Clique em <strong>Nova visita</strong>.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {visitas.map(v => (
            <Card key={v.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{clienteLabel(v)}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(v.data_visita).toLocaleDateString("pt-BR")} · {motivoLabel(v.motivo)}
                      {v.motivo === "outro" && v.motivo_outro ? ` — ${v.motivo_outro}` : ""}
                    </div>
                  </div>
                  {v.alerta_nivel && (
                    <Badge variant={
                      v.alerta_nivel === "muito_urgente" ? "destructive" :
                      v.alerta_nivel === "ponto_atencao" ? "default" : "secondary"
                    }>
                      {v.alerta_nivel === "muito_urgente" ? "Muito Urgente" :
                       v.alerta_nivel === "ponto_atencao" ? "Atenção" : "Rotina"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {v.clima && (
                  <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded px-2 py-1">
                    {wmoIcone(v.clima.codigo_wmo)}
                    <span className="font-semibold">{v.clima.temperatura}°C</span>
                    <span>{v.clima.descricao}</span>
                    <span className="flex items-center gap-1 ml-auto text-muted-foreground">
                      <Wind className="h-3 w-3" />{v.clima.vento_kmh} km/h
                      {v.clima.precipitacao_mm > 0 && <><CloudRain className="h-3 w-3 ml-1" />{v.clima.precipitacao_mm} mm</>}
                    </span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{v.relato}</p>
                {v.observacao && <p className="text-muted-foreground italic"><strong>Obs.:</strong> {v.observacao}</p>}
                {v.fotos?.length > 0 && (
                  <div className="text-xs text-muted-foreground">{v.fotos.length} foto(s) anexada(s)</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
