import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, MapPin, Pencil, Trash2, Search, Map, Upload,
  Layers, ChevronDown, ChevronUp, FlaskConical, ClipboardList, QrCode,
} from "lucide-react";

// Lazy-load do mapa para não quebrar SSR/bundle
const MapaTalhao = lazy(() =>
  import("@/components/nutrir/MapaTalhao").then(m => ({ default: m.MapaTalhao }))
);

// ─── tipos ───────────────────────────────────────────────────────────────────
interface Talhao {
  id: string; nome: string; fazenda_nome: string | null; cliente_id: string | null;
  area_ha: number | null; cultura: string | null; safra: string | null;
  geometria: any | null; centro_lat: number | null; centro_lng: number | null;
  observacoes: string | null; created_at: string;
}

const CULTURAS = ["Soja", "Milho", "Algodão", "Feijão", "Sorgo", "Trigo", "Café", "Cana", "Outra"];

const VAZIO: Partial<Talhao> = {
  nome: "", fazenda_nome: "", cliente_id: "", area_ha: undefined,
  cultura: "", safra: "", observacoes: "",
};

// ─── parse KML simples ───────────────────────────────────────────────────────
function parseKML(text: string): [number, number][] | null {
  const match = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!match) return null;
  const pts = match[1].trim().split(/\s+/).map(p => {
    const [lng, lat] = p.split(",").map(Number);
    return [lat, lng] as [number, number];
  }).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
  return pts.length >= 3 ? pts : null;
}

// ─── parse coordenadas texto (lat,lng por linha) ──────────────────────────────
function parseCoordsText(text: string): [number, number][] | null {
  const lines = text.trim().split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
  const pts: [number, number][] = [];
  for (const line of lines) {
    const nums = line.replace(/[°'"]/g, "").split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
    if (nums.length >= 2) pts.push([nums[0], nums[1]]);
  }
  return pts.length >= 3 ? pts : null;
}

function calcArea(pts: [number, number][]): number {
  // Shoelace approximation em graus → ha (1° lat ≈ 111 km)
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [y1, x1] = pts[i];
    const [y2, x2] = pts[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const areaGraus = Math.abs(area) / 2;
  return areaGraus * 111 * 111 * 10000; // m² → ha
}

export default function Talhoes() {
  const { current } = useOrg();
  const [talhoes, setTalhoes]     = useState<Talhao[]>([]);
  const [clientes, setClientes]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busca, setBusca]         = useState("");
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");

  // dialog
  const [open, setOpen]           = useState(false);
  const [edit, setEdit]           = useState<Partial<Talhao>>(VAZIO);
  const [saving, setSaving]       = useState(false);

  // mapa
  const [mostrarMapa, setMostrarMapa] = useState<string | null>(null);
  const [editandoMapa, setEditandoMapa] = useState(false);

  // import
  const [importTxt, setImportTxt]   = useState("");
  const [importErro, setImportErro] = useState("");
  const [importGeo, setImportGeo]   = useState<{ geo: any; centro: [number, number]; area: number } | null>(null);

  // coletas
  const [coletaOpen, setColetaOpen] = useState(false);
  const [coletaTalhaoId, setColetaTalhaoId] = useState<string | null>(null);
  const [coletas, setColetas] = useState<any[]>([]);
  const [novaColeta, setNovaColeta] = useState({ data: new Date().toISOString().slice(0,10), tipo: "solo", profundidade: "0-20 cm", laboratorio: "", observacoes: "" });
  const [savingColeta, setSavingColeta] = useState(false);

  // ─── load ─────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [{ data: t }, { data: c }] = await Promise.all([
      (supabase as any).from("nutrir_talhoes").select("*").eq("organization_id", current.id).order("created_at", { ascending: false }),
      (supabase as any).from("nutrir_clientes").select("id,razao_social,nome_fantasia").eq("organization_id", current.id).limit(500),
    ]);
    setTalhoes(t ?? []);
    setClientes(c ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  // ─── import coords ────────────────────────────────────────────────────────
  const processarImport = () => {
    setImportErro("");
    setImportGeo(null);
    const txt = importTxt.trim();
    if (!txt) return;

    let pts: [number, number][] | null = null;
    if (txt.toLowerCase().includes("<coordinates>")) {
      pts = parseKML(txt);
    } else {
      pts = parseCoordsText(txt);
    }

    if (!pts) {
      setImportErro("Não foi possível interpretar as coordenadas. Use formato: lat,lng (uma por linha) ou KML."); return;
    }

    const ring = [...pts.map(([lat, lng]) => [lng, lat]), [pts[0][1], pts[0][0]]];
    const geo = { type: "Polygon", coordinates: [ring] };
    const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const area = calcArea(pts);

    setImportGeo({ geo, centro: [lat, lng], area: parseFloat((area / 10000).toFixed(2)) });
    setEdit(e => ({ ...e, area_ha: parseFloat((area / 10000).toFixed(2)) }));
    toast({ title: `${pts.length} pontos importados`, description: `Área estimada: ${(area / 10000).toFixed(2)} ha` });
  };

  // ─── salvar ───────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!current || !edit.nome) {
      toast({ title: "Nome obrigatório", variant: "destructive" }); return;
    }
    setSaving(true);
    const geoFinal = importGeo?.geo ?? edit.geometria ?? null;
    const centroFinal = importGeo?.centro ?? (edit.centro_lat && edit.centro_lng ? [edit.centro_lat, edit.centro_lng] as [number, number] : null);

    const payload: any = {
      organization_id: current.id,
      nome: edit.nome,
      fazenda_nome: edit.fazenda_nome || null,
      cliente_id: edit.cliente_id || null,
      area_ha: edit.area_ha ? Number(edit.area_ha) : null,
      cultura: edit.cultura || null,
      safra: edit.safra || null,
      observacoes: edit.observacoes || null,
      geometria: geoFinal,
      centro_lat: centroFinal?.[0] ?? null,
      centro_lng: centroFinal?.[1] ?? null,
    };

    if (edit.id) {
      await (supabase as any).from("nutrir_talhoes").update(payload).eq("id", edit.id);
    } else {
      await (supabase as any).from("nutrir_talhoes").insert(payload);
    }

    toast({ title: "Talhão salvo" });
    setOpen(false); setEdit(VAZIO); setImportTxt(""); setImportGeo(null);
    setSaving(false); load();
  };

  const deletar = async (id: string) => {
    if (!confirm("Excluir talhão?")) return;
    await (supabase as any).from("nutrir_talhoes").delete().eq("id", id);
    setTalhoes(ts => ts.filter(t => t.id !== id));
    toast({ title: "Talhão excluído" });
  };

  // ─── coletas ──────────────────────────────────────────────────────────────
  const abrirColetas = async (talhaoId: string) => {
    setColetaTalhaoId(talhaoId);
    const { data } = await (supabase as any)
      .from("nutrir_talhao_coletas")
      .select("*")
      .eq("talhao_id", talhaoId)
      .order("data", { ascending: false });
    setColetas((data as any[]) ?? []);
    setColetaOpen(true);
  };

  const gerarCodigo = (talhaoId: string, seq: number): string => {
    const ano = new Date().getFullYear();
    const seqStr = String(seq).padStart(3, "0");
    return `COL-${ano}-${talhaoId.slice(0, 4).toUpperCase()}-${seqStr}`;
  };

  const salvarColeta = async () => {
    if (!coletaTalhaoId || !current) return;
    setSavingColeta(true);
    try {
      const codigo = gerarCodigo(coletaTalhaoId, coletas.length + 1);
      const { data, error } = await (supabase as any)
        .from("nutrir_talhao_coletas")
        .insert({
          organization_id: current.id,
          talhao_id: coletaTalhaoId,
          codigo,
          data: novaColeta.data,
          tipo: novaColeta.tipo,
          profundidade: novaColeta.profundidade || null,
          laboratorio: novaColeta.laboratorio || null,
          observacoes: novaColeta.observacoes || null,
          status: "pendente",
        })
        .select()
        .single();
      if (error) throw error;
      setColetas(prev => [data, ...prev]);
      setNovaColeta({ data: new Date().toISOString().slice(0,10), tipo: "solo", profundidade: "0-20 cm", laboratorio: "", observacoes: "" });
      toast({ title: `Coleta ${codigo} registrada` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar coleta", description: e.message, variant: "destructive" });
    } finally { setSavingColeta(false); }
  };

  // ─── filtros ──────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let list = talhoes;
    if (clienteFiltro !== "todos") list = list.filter(t => t.cliente_id === clienteFiltro);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      list = list.filter(t =>
        t.nome.toLowerCase().includes(b) ||
        (t.fazenda_nome ?? "").toLowerCase().includes(b) ||
        (t.cultura ?? "").toLowerCase().includes(b)
      );
    }
    return list;
  }, [talhoes, clienteFiltro, busca]);

  const totalArea = filtrados.reduce((s, t) => s + Number(t.area_ha ?? 0), 0);
  const comMapa = filtrados.filter(t => t.geometria).length;

  const nomeCliente = (id: string | null) => {
    if (!id) return null;
    const c = clientes.find(c => c.id === id);
    return c?.nome_fantasia || c?.razao_social || null;
  };

  return (
    <>
      <PageHeader
        title="Talhões"
        description="Gestão de áreas agrícolas com delimitação GPS"
        actions={
          <Button size="sm" onClick={() => { setEdit(VAZIO); setImportTxt(""); setImportGeo(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo talhão
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Layers,  label: "Talhões",        value: filtrados.length },
            { icon: MapPin,  label: "Com mapa GPS",    value: comMapa },
            { icon: Map,     label: "Área total (ha)", value: totalArea.toFixed(1) },
            { icon: Search,  label: "Culturas únicas", value: new Set(filtrados.map(t => t.cultura).filter(Boolean)).size },
          ].map(k => (
            <Card key={k.label}><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <div className="text-2xl font-bold">{k.value}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar talhão…" className="pl-8 h-8 w-52" />
          </div>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos clientes</SelectItem>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground self-center">{filtrados.length} talhão(ões)</span>
        </div>

        {/* Grade de talhões */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtrados.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Map className="h-12 w-12 mx-auto opacity-20 mb-3" />
            <p>Nenhum talhão encontrado.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEdit(VAZIO); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Cadastrar primeiro talhão
            </Button>
          </CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map(t => (
              <Card key={t.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{t.nome}</CardTitle>
                      {t.fazenda_nome && <p className="text-xs text-muted-foreground">{t.fazenda_nome}</p>}
                      {nomeCliente(t.cliente_id) && (
                        <p className="text-xs text-muted-foreground">{nomeCliente(t.cliente_id)}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEdit(t); setImportTxt(""); setImportGeo(null); setOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletar(t.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {t.area_ha && <Badge variant="outline">{Number(t.area_ha).toFixed(1)} ha</Badge>}
                    {t.cultura  && <Badge variant="secondary">{t.cultura}</Badge>}
                    {t.safra    && <Badge variant="outline" className="text-muted-foreground">{t.safra}</Badge>}
                    {t.geometria
                      ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200"><MapPin className="w-3 h-3 mr-1" />GPS</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Sem mapa</Badge>
                    }
                  </div>
                  {t.observacoes && <p className="text-xs text-muted-foreground italic">{t.observacoes}</p>}

                  {/* Ações do talhão */}
                  <div className="flex gap-1.5">
                    {t.geometria && (
                      <Button
                        variant="outline" size="sm" className="flex-1 text-xs"
                        onClick={() => setMostrarMapa(mostrarMapa === t.id ? null : t.id)}
                      >
                        <Map className="w-3.5 h-3.5 mr-1" />
                        {mostrarMapa === t.id ? "Ocultar" : "Mapa"}
                        {mostrarMapa === t.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </Button>
                    )}
                    <Button
                      variant="outline" size="sm" className="flex-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => abrirColetas(t.id)}
                    >
                      <FlaskConical className="w-3.5 h-3.5 mr-1" /> Coletas
                    </Button>
                  </div>

                  {mostrarMapa === t.id && (
                    <Suspense fallback={<div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Carregando mapa…</div>}>
                      <MapaTalhao
                        geometria={t.geometria}
                        centro={t.centro_lat && t.centro_lng ? [t.centro_lat, t.centro_lng] : undefined}
                        readOnly
                        height={220}
                      />
                    </Suspense>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog coletas */}
      <Dialog open={coletaOpen} onOpenChange={setColetaOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-amber-600" />
              Coletas de Solo — {talhoes.find(t => t.id === coletaTalhaoId)?.nome ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Nova coleta */}
            <div className="border rounded-lg p-4 space-y-3 bg-amber-50/40">
              <div className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Nova coleta
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Data</label>
                  <Input type="date" value={novaColeta.data}
                    onChange={e => setNovaColeta(x => ({ ...x, data: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Tipo</label>
                  <Select value={novaColeta.tipo} onValueChange={v => setNovaColeta(x => ({ ...x, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Solo</SelectItem>
                      <SelectItem value="foliar">Foliar</SelectItem>
                      <SelectItem value="agua">Água</SelectItem>
                      <SelectItem value="raiz">Raiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Profundidade</label>
                  <Select value={novaColeta.profundidade} onValueChange={v => setNovaColeta(x => ({ ...x, profundidade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-20 cm">0–20 cm</SelectItem>
                      <SelectItem value="20-40 cm">20–40 cm</SelectItem>
                      <SelectItem value="0-40 cm">0–40 cm (composta)</SelectItem>
                      <SelectItem value="Foliar">Foliar (n/a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Laboratório</label>
                  <Input value={novaColeta.laboratorio}
                    onChange={e => setNovaColeta(x => ({ ...x, laboratorio: e.target.value }))}
                    placeholder="Ex.: Embrapa, IAC, Fertbio" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium">Observações</label>
                  <Input value={novaColeta.observacoes}
                    onChange={e => setNovaColeta(x => ({ ...x, observacoes: e.target.value }))}
                    placeholder="Ponto de coleta, condições, etc." />
                </div>
              </div>
              <Button size="sm" onClick={salvarColeta} disabled={savingColeta} className="bg-gradient-primary">
                {savingColeta ? "Salvando…" : "Registrar coleta + gerar código"}
              </Button>
            </div>

            {/* Lista de coletas */}
            <div className="space-y-2">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-muted-foreground" /> Histórico de coletas ({coletas.length})
              </div>
              {coletas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma coleta registrada para este talhão.</p>
              ) : (
                <div className="space-y-2">
                  {coletas.map(c => (
                    <div key={c.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm font-bold text-primary">{c.codigo}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>📅 {c.data}</span>
                        <span>🧪 {c.tipo}</span>
                        {c.profundidade && <span>📏 {c.profundidade}</span>}
                        {c.laboratorio && <span>🔬 {c.laboratorio}</span>}
                      </div>
                      {c.observacoes && <p className="text-xs text-muted-foreground italic">{c.observacoes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog novo/editar talhão */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEdit(VAZIO); setImportTxt(""); setImportGeo(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Novo"} talhão</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium">Nome do talhão *</label>
                <Input value={edit.nome ?? ""} onChange={e => setEdit(x => ({ ...x, nome: e.target.value }))} placeholder="Ex.: Talhão A – Gleba Norte" />
              </div>
              <div>
                <label className="text-xs font-medium">Fazenda</label>
                <Input value={edit.fazenda_nome ?? ""} onChange={e => setEdit(x => ({ ...x, fazenda_nome: e.target.value }))} placeholder="Nome da fazenda" />
              </div>
              <div>
                <label className="text-xs font-medium">Cliente</label>
                <Select value={edit.cliente_id ?? "none"} onValueChange={v => setEdit(x => ({ ...x, cliente_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem cliente —</SelectItem>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Área (ha)</label>
                <Input type="number" step="0.1" value={edit.area_ha ?? ""} onChange={e => setEdit(x => ({ ...x, area_ha: parseFloat(e.target.value) || undefined }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Cultura</label>
                <Select value={edit.cultura ?? "none"} onValueChange={v => setEdit(x => ({ ...x, cultura: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecione —</SelectItem>
                    {CULTURAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Safra</label>
                <Input value={edit.safra ?? ""} onChange={e => setEdit(x => ({ ...x, safra: e.target.value }))} placeholder="Ex.: 2024/25" />
              </div>
              <div>
                <label className="text-xs font-medium">Observações</label>
                <Textarea value={edit.observacoes ?? ""} onChange={e => setEdit(x => ({ ...x, observacoes: e.target.value }))} rows={2} />
              </div>
            </div>

            {/* Import GPS */}
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import de coordenadas GPS
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cole coordenadas (lat,lng por linha), ou o conteúdo de um arquivo KML.
              </p>
              <Textarea
                value={importTxt}
                onChange={e => { setImportTxt(e.target.value); setImportErro(""); setImportGeo(null); }}
                rows={4}
                placeholder={`-15.7801, -47.9292\n-15.7810, -47.9300\n-15.7820, -47.9285\n...`}
                className="font-mono text-xs"
              />
              {importErro && <p className="text-xs text-destructive">{importErro}</p>}
              {importGeo && (
                <div className="text-xs text-emerald-700 font-medium">
                  ✓ Polígono importado — área estimada: {importGeo.area} ha
                </div>
              )}
              <Button variant="outline" size="sm" onClick={processarImport} disabled={!importTxt.trim()}>
                <MapPin className="w-3.5 h-3.5 mr-1" /> Processar coordenadas
              </Button>
            </div>

            {/* Mapa interativo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium">Mapa interativo (opcional)</p>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditandoMapa(e => !e)}>
                  {editandoMapa ? "Ocultar mapa" : "Desenhar no mapa"}
                </Button>
              </div>
              {editandoMapa && (
                <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Carregando mapa…</div>}>
                  <MapaTalhao
                    geometria={importGeo?.geo ?? edit.geometria}
                    centro={importGeo?.centro ?? (edit.centro_lat && edit.centro_lng ? [edit.centro_lat, edit.centro_lng] : undefined)}
                    height={300}
                    onSave={(geo, centro) => {
                      const ring: [number, number][] = (geo.coordinates[0] as number[][]).slice(0, -1).map(([lng, lat]) => [lat, lng]);
                      const area = calcArea(ring);
                      setImportGeo({ geo, centro, area: parseFloat((area / 10000).toFixed(2)) });
                      setEdit(e => ({ ...e, area_ha: parseFloat((area / 10000).toFixed(2)) }));
                      toast({ title: "Talhão desenhado", description: `Área: ${(area / 10000).toFixed(2)} ha` });
                    }}
                  />
                </Suspense>
              )}
            </div>

            <Button className="w-full" onClick={salvar} disabled={saving}>
              {saving ? "Salvando…" : "Salvar talhão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
