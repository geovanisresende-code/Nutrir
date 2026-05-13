import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// PageHeader não usado — mapa em fullscreen
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Play, Square, MapPin, Crosshair, Pencil, Save, Trash2, Layers, Navigation, Loader2, Plus, X,
  PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Field { id: string; name: string; cultura: string|null; hectares: number|null; geometry: any; centroid_lat: number|null; centroid_lng: number|null; client_id: string|null; }
interface Client { id: string; name: string; }
interface Route { id: string; name: string; status: string; started_at: string; finished_at: string|null; hectares: number|null; client_id: string|null; field_id: string|null; }

const Mapas = () => {
  const { current } = useOrg();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const trackLayerId = "live-track";
  const pointMarkers = useRef<mapboxgl.Marker[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const [fields, setFields] = useState<Field[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  // Coleta em tempo real
  const [collecting, setCollecting] = useState(false);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [trackCoords, setTrackCoords] = useState<[number, number][]>([]);
  const watchIdRef = useRef<number | null>(null);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  // UI
  const [tab, setTab] = useState<"draw" | "collect" | "manual">("draw");
  const [panelOpen, setPanelOpen] = useState(true);
  const [startOpen, setStartOpen] = useState(false);
  const [startForm, setStartForm] = useState({ name: "", client_id: "", field_id: "" });
  const [savePolyOpen, setSavePolyOpen] = useState(false);
  const [polyForm, setPolyForm] = useState({ name: "", cultura: "", client_id: "" });
  const [pendingPolygon, setPendingPolygon] = useState<any>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ lat: "", lng: "", notes: "" });

  // === Inicializa Mapbox ===
  useEffect(() => {
    if (!current || !mapContainer.current) return;
    const token = current.mapbox_token;
    if (!token) { setTokenMissing(true); return; }
    setTokenMissing(false);

    mapboxgl.accessToken = token;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-47.93, -15.78],
      zoom: 4.5,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.NavigationControl(), "top-right");
    m.addControl(new mapboxgl.AttributionControl({ compact: true }));
    m.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");

    const d = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, line_string: true, point: true, trash: true },
      defaultMode: "simple_select",
      styles: drawStyles,
    });
    m.addControl(d as any, "top-left");

    m.on("load", () => {
      m.addSource(trackLayerId, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} } });
      m.addLayer({ id: trackLayerId, type: "line", source: trackLayerId, paint: { "line-color": "#facc15", "line-width": 4, "line-opacity": 0.95 } });
      setMapReady(true);
    });

    // Desenho concluído → abre dialog para salvar como talhão
    m.on("draw.create" as any, (e: any) => {
      const feat = e.features?.[0];
      if (!feat) return;
      if (feat.geometry.type === "Polygon") {
        setPendingPolygon(feat);
        setSavePolyOpen(true);
      }
    });

    // Click no mapa em modo manual = adiciona ponto rapidamente
    m.on("click", (e) => {
      if (tab !== "manual" || !collecting) return;
      addPoint(e.lngLat.lng, e.lngLat.lat, "manual");
    });

    map.current = m;
    draw.current = d;
    return () => { m.remove(); map.current = null; draw.current = null; setMapReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.mapbox_token]);

  // === Carrega dados ===
  const reload = useCallback(async () => {
    if (!current) return;
    const [f, c, r] = await Promise.all([
      supabase.from("fields").select("*").eq("organization_id", current.id),
      supabase.from("clients").select("id,name").eq("organization_id", current.id).order("name"),
      supabase.from("collection_routes").select("*").eq("organization_id", current.id).order("started_at", { ascending: false }).limit(20),
    ]);
    setFields((f.data ?? []) as Field[]);
    setClients((c.data ?? []) as Client[]);
    setRoutes((r.data ?? []) as Route[]);
  }, [current]);
  useEffect(() => { reload(); }, [reload]);

  // === Renderiza talhões existentes no mapa ===
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const m = map.current;
    const sourceId = "fields-src";
    if (m.getLayer("fields-fill")) m.removeLayer("fields-fill");
    if (m.getLayer("fields-outline")) m.removeLayer("fields-outline");
    if (m.getSource(sourceId)) m.removeSource(sourceId);

    const fc = {
      type: "FeatureCollection" as const,
      features: fields.filter(f => f.geometry).map(f => ({
        type: "Feature" as const, geometry: f.geometry, properties: { id: f.id, name: f.name, cultura: f.cultura },
      })),
    };
    m.addSource(sourceId, { type: "geojson", data: fc });
    m.addLayer({ id: "fields-fill", type: "fill", source: sourceId, paint: { "fill-color": "#22c55e", "fill-opacity": 0.18 } });
    m.addLayer({ id: "fields-outline", type: "line", source: sourceId, paint: { "line-color": "#16a34a", "line-width": 2 } });

    // Bounding box fit
    if (fc.features.length) {
      const bbox = turf.bbox(fc as any);
      m.fitBounds(bbox as any, { padding: 60, maxZoom: 14, duration: 800 });
    }
  }, [fields, mapReady]);

  // === GPS tracking ===
  const startGPS = () => {
    if (!navigator.geolocation) { toast.error("GPS não suportado neste dispositivo"); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentPos({ lat: latitude, lng: longitude, acc: accuracy });
        if (map.current) {
          if (!userMarker.current) {
            const el = document.createElement("div");
            el.className = "h-4 w-4 rounded-full bg-yellow-400 border-2 border-white shadow-lg animate-pulse";
            userMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map.current);
            map.current.flyTo({ center: [longitude, latitude], zoom: 17, duration: 1200 });
          } else {
            userMarker.current.setLngLat([longitude, latitude]);
          }
          // Atualiza trilha
          setTrackCoords(prev => {
            const next: [number, number][] = [...prev, [longitude, latitude]];
            const src = map.current!.getSource(trackLayerId) as mapboxgl.GeoJSONSource | undefined;
            src?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: next }, properties: {} } as any);
            return next;
          });
        }
      },
      (err) => toast.error("GPS: " + err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    watchIdRef.current = id;
  };
  const stopGPS = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  };
  useEffect(() => () => stopGPS(), []);

  // === Iniciar coleta ===
  const startCollection = async () => {
    if (!current || !startForm.name) { toast.error("Dê um nome à coleta"); return; }
    const { data, error } = await supabase.from("collection_routes").insert({
      organization_id: current.id,
      name: startForm.name,
      client_id: startForm.client_id || null,
      field_id: startForm.field_id || null,
      status: "in_progress",
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setActiveRoute(data as Route);
    setCollecting(true);
    setStartOpen(false);
    setStartForm({ name: "", client_id: "", field_id: "" });
    setTrackCoords([]);
    pointMarkers.current.forEach(m => m.remove());
    pointMarkers.current = [];
    startGPS();
    toast.success("Coleta iniciada — GPS ativo");
  };

  // === Adicionar ponto ===
  const addPoint = async (lng: number, lat: number, kind: "manual" | "gps" | "sample", notes?: string) => {
    if (!current || !activeRoute) return;
    const { data, error } = await supabase.from("collection_points").insert({
      organization_id: current.id,
      route_id: activeRoute.id,
      client_id: activeRoute.client_id,
      field_id: activeRoute.field_id,
      latitude: lat, longitude: lng,
      accuracy_m: currentPos?.acc ?? null,
      kind, notes: notes ?? null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (map.current) {
      const el = document.createElement("div");
      el.className = `h-3 w-3 rounded-full border-2 border-white shadow-md ${kind === "gps" ? "bg-yellow-400" : kind === "sample" ? "bg-emerald-500" : "bg-sky-500"}`;
      const mk = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<strong>${kind}</strong><br/>${lat.toFixed(5)}, ${lng.toFixed(5)}${notes ? `<br/>${notes}` : ""}`))
        .addTo(map.current);
      pointMarkers.current.push(mk);
    }
    toast.success("Ponto registrado");
    return data;
  };

  const markCurrentGPS = () => {
    if (!currentPos) { toast.error("Aguardando GPS…"); return; }
    addPoint(currentPos.lng, currentPos.lat, "gps");
  };

  const addManual = async () => {
    const lat = parseFloat(manualForm.lat), lng = parseFloat(manualForm.lng);
    if (isNaN(lat) || isNaN(lng)) { toast.error("Lat/Lng inválidos"); return; }
    await addPoint(lng, lat, "manual", manualForm.notes);
    setManualOpen(false); setManualForm({ lat: "", lng: "", notes: "" });
  };

  // === Finalizar área (cria polígono a partir do trajeto) ===
  const finishArea = async () => {
    if (!activeRoute) return;
    let areaGeom: any = null;
    let hectares: number | null = null;
    if (trackCoords.length >= 3) {
      // Fecha polígono
      const closed = [...trackCoords, trackCoords[0]];
      const poly = turf.polygon([closed]);
      areaGeom = poly.geometry;
      hectares = +(turf.area(poly) / 10000).toFixed(2);
    }
    const { error } = await supabase.from("collection_routes").update({
      status: "finished",
      finished_at: new Date().toISOString(),
      path: { type: "LineString", coordinates: trackCoords },
      area_geometry: areaGeom,
      hectares,
    }).eq("id", activeRoute.id);
    if (error) { toast.error(error.message); return; }
    stopGPS();
    setCollecting(false);
    toast.success(hectares ? `Coleta finalizada · ${hectares} ha` : "Coleta finalizada");
    if (areaGeom && current && activeRoute) {
      // Pergunta se quer salvar como talhão
      if (confirm(`Área calculada: ${hectares} ha. Salvar como talhão "${activeRoute.name}"?`)) {
        const center = turf.centroid(areaGeom as any);
        await supabase.from("fields").insert({
          organization_id: current.id,
          client_id: activeRoute.client_id,
          name: activeRoute.name,
          hectares,
          geometry: areaGeom,
          centroid_lng: center.geometry.coordinates[0],
          centroid_lat: center.geometry.coordinates[1],
        });
      }
    }
    setActiveRoute(null);
    setTrackCoords([]);
    reload();
  };

  // === Salvar polígono desenhado como talhão ===
  const savePolygonAsField = async () => {
    if (!current || !pendingPolygon) return;
    const poly = pendingPolygon;
    const ha = +(turf.area(poly) / 10000).toFixed(2);
    const center = turf.centroid(poly as any);
    const { error } = await supabase.from("fields").insert({
      organization_id: current.id,
      client_id: polyForm.client_id || null,
      name: polyForm.name,
      cultura: polyForm.cultura || null,
      hectares: ha,
      geometry: poly.geometry,
      centroid_lng: center.geometry.coordinates[0],
      centroid_lat: center.geometry.coordinates[1],
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Talhão criado · ${ha} ha`);
    draw.current?.deleteAll();
    setSavePolyOpen(false);
    setPolyForm({ name: "", cultura: "", client_id: "" });
    setPendingPolygon(null);
    reload();
  };

  const cancelPolygon = () => {
    draw.current?.deleteAll();
    setSavePolyOpen(false);
    setPendingPolygon(null);
  };

  // === Recenter ===
  const recenter = () => {
    if (currentPos && map.current) map.current.flyTo({ center: [currentPos.lng, currentPos.lat], zoom: 17 });
    else if (!currentPos) startGPS();
  };

  // === No token: tela de configuração ===
  if (tokenMissing) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <Card className="max-w-2xl"><CardContent className="p-8 text-center">
          <Layers className="h-10 w-10 mx-auto mb-4 text-primary" />
          <h3 className="font-semibold text-lg">Token Mapbox não configurado</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-5">
            Para usar o mapa interativo, o desenho de talhões e o GPS em tempo real, configure seu token público Mapbox.
          </p>
          <Button asChild className="bg-gradient-primary"><Link to="/app/configuracoes">Configurar agora</Link></Button>
          <p className="text-xs text-muted-foreground mt-5">
            Crie uma conta gratuita em <a href="https://account.mapbox.com" target="_blank" rel="noreferrer" className="text-primary underline">mapbox.com</a> e copie o <code>Default public token</code>.
          </p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <>
      {/* Mapa em tela cheia (AppShell já dá fullscreen para /app/mapas) */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Barra superior flutuante */}
      <div className="absolute top-3 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:right-auto z-10 flex items-center gap-2 pointer-events-none">
        <div className="bg-card/95 backdrop-blur shadow-elegant border rounded-full px-4 py-1.5 flex items-center gap-3 pointer-events-auto">
          <Layers className="h-4 w-4 text-primary"/>
          <span className="font-semibold text-sm">Mapas & Coleta</span>
          <Badge variant="outline" className="text-[10px]">{fields.length} talhões</Badge>
        </div>
        <div className="ml-auto pointer-events-auto">
          {collecting ? (
            <Button onClick={finishArea} variant="destructive" size="sm" className="shadow-elegant"><Square className="h-4 w-4 mr-1"/>Finalizar</Button>
          ) : (
            <Button onClick={() => setStartOpen(true)} size="sm" className="bg-gradient-primary shadow-elegant"><Play className="h-4 w-4 mr-1"/>Iniciar coleta</Button>
          )}
        </div>
      </div>

      {/* Status overlay durante coleta */}
      {collecting && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-card/95 backdrop-blur shadow-elegant border rounded-full px-4 py-1.5 flex items-center gap-3 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <span className="font-medium">{activeRoute?.name}</span>
          <Badge variant="secondary" className="text-[10px]">{trackCoords.length} pts GPS</Badge>
          {currentPos && <span className="text-xs text-muted-foreground">±{Math.round(currentPos.acc)}m</span>}
        </div>
      )}

      {/* FAB GPS recenter */}
      <Button onClick={recenter} size="icon" className="absolute bottom-6 right-6 z-10 rounded-full h-12 w-12 shadow-elegant bg-gradient-primary">
        <Crosshair className="h-5 w-5" />
      </Button>

      {/* Botão para abrir/fechar painel */}
      <Button
        onClick={() => setPanelOpen(o => !o)}
        size="icon"
        variant="secondary"
        className={`absolute top-3 z-20 shadow-elegant transition-all ${panelOpen ? "right-[360px]" : "right-3"}`}
      >
        {panelOpen ? <PanelRightClose className="h-4 w-4"/> : <PanelRightOpen className="h-4 w-4"/>}
      </Button>

      {/* Painel lateral flutuante */}
      <aside className={`absolute top-0 right-0 bottom-0 z-10 w-[360px] border-l bg-card/95 backdrop-blur overflow-y-auto transition-transform ${panelOpen ? "translate-x-0" : "translate-x-full"}`}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="p-4 pt-14">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="draw"><Pencil className="h-3.5 w-3.5 mr-1" />Desenhar</TabsTrigger>
            <TabsTrigger value="collect"><Navigation className="h-3.5 w-3.5 mr-1" />Coletar</TabsTrigger>
            <TabsTrigger value="manual"><MapPin className="h-3.5 w-3.5 mr-1" />Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Use as ferramentas no canto superior esquerdo do mapa para desenhar polígonos (talhões), linhas (rotas) ou pontos.
              Ao finalizar um polígono, será calculada a área e oferecido para salvar como talhão.
            </p>
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-semibold">Atalhos do desenho</div>
              <div>● Clique nos cantos para definir vértices</div>
              <div>● Duplo-clique para finalizar</div>
              <div>● Selecione e arraste para editar</div>
            </div>
          </TabsContent>

          <TabsContent value="collect" className="space-y-3 mt-4">
            {!collecting ? (
              <div className="text-sm text-muted-foreground">
                Inicie uma coleta para gravar trajeto GPS, marcar pontos e calcular a área percorrida.
              </div>
            ) : (
              <>
                <div className="rounded-md border p-3 space-y-1.5 text-sm">
                  <div className="font-medium">{activeRoute?.name}</div>
                  {currentPos ? (
                    <>
                      <div className="text-xs text-muted-foreground">Lat: {currentPos.lat.toFixed(6)}</div>
                      <div className="text-xs text-muted-foreground">Lng: {currentPos.lng.toFixed(6)}</div>
                      <div className="text-xs text-muted-foreground">Precisão: ±{Math.round(currentPos.acc)} m</div>
                    </>
                  ) : <div className="text-xs flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin"/>Aguardando sinal GPS…</div>}
                </div>
                <Button onClick={markCurrentGPS} disabled={!currentPos} className="w-full bg-gradient-primary">
                  <MapPin className="h-4 w-4 mr-1.5" />Marcar ponto aqui (GPS)
                </Button>
                <Button onClick={finishArea} variant="destructive" className="w-full">
                  <Square className="h-4 w-4 mr-1.5" />Finalizar área
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 mt-4">
            {collecting ? (
              <>
                <p className="text-xs text-muted-foreground">Clique em qualquer lugar do mapa para registrar um ponto, ou insira coordenadas:</p>
                <Button onClick={() => setManualOpen(true)} variant="outline" className="w-full"><Plus className="h-4 w-4 mr-1"/>Por coordenadas</Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Inicie uma coleta para registrar pontos manuais.</p>
            )}
          </TabsContent>
        </Tabs>

        {/* Lista de talhões */}
        <div className="px-4 pb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Talhões ({fields.length})</span>
          </h4>
          <div className="space-y-1.5">
            {fields.length === 0 && <div className="text-xs text-muted-foreground italic">Nenhum talhão. Desenhe um no mapa.</div>}
            {fields.map(f => (
              <button
                key={f.id}
                onClick={() => f.centroid_lat && f.centroid_lng && map.current?.flyTo({ center: [Number(f.centroid_lng), Number(f.centroid_lat)], zoom: 15 })}
                className="w-full text-left p-2 rounded-md hover:bg-muted text-sm flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-[10px] text-muted-foreground">{f.hectares ?? "?"} ha {f.cultura && `· ${f.cultura}`}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={async (e) => { e.stopPropagation(); if (confirm(`Excluir ${f.name}?`)) { await supabase.from("fields").delete().eq("id", f.id); reload(); } }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive"/>
                </Button>
              </button>
            ))}
          </div>
        </div>

        {/* Coletas recentes */}
        <div className="px-4 pb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coletas recentes</h4>
          <div className="space-y-1.5">
            {routes.slice(0, 5).map(r => (
              <div key={r.id} className="text-sm p-2 rounded-md bg-muted/40 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(r.started_at).toLocaleString("pt-BR")} {r.hectares && `· ${r.hectares} ha`}</div>
                </div>
                <Badge variant={r.status === "finished" ? "secondary" : "default"} className="text-[10px]">{r.status === "finished" ? "concluída" : "ativa"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Dialog: Iniciar coleta */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Iniciar nova coleta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome / referência</Label><Input value={startForm.name} onChange={e => setStartForm({ ...startForm, name: e.target.value })} placeholder="Ex: Talhão norte – fazenda São José"/></div>
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={startForm.client_id} onValueChange={v => setStartForm({ ...startForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem cliente"/></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Talhão existente (opcional)</Label>
              <Select value={startForm.field_id} onValueChange={v => setStartForm({ ...startForm, field_id: v })}>
                <SelectTrigger><SelectValue placeholder="Novo / sem talhão"/></SelectTrigger>
                <SelectContent>{fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={startCollection} className="bg-gradient-primary"><Play className="h-4 w-4 mr-1"/>Iniciar GPS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Salvar polígono desenhado */}
      <Dialog open={savePolyOpen} onOpenChange={(o) => !o && cancelPolygon()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como talhão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {pendingPolygon && (
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                Área calculada: <strong>{(turf.area(pendingPolygon) / 10000).toFixed(2)} ha</strong>
              </div>
            )}
            <div><Label>Nome do talhão</Label><Input value={polyForm.name} onChange={e => setPolyForm({ ...polyForm, name: e.target.value })} required/></div>
            <div><Label>Cultura</Label><Input value={polyForm.cultura} onChange={e => setPolyForm({ ...polyForm, cultura: e.target.value })} placeholder="Soja, Milho..."/></div>
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={polyForm.client_id} onValueChange={v => setPolyForm({ ...polyForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem cliente"/></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelPolygon}><X className="h-4 w-4 mr-1"/>Descartar</Button>
            <Button onClick={savePolygonAsField} disabled={!polyForm.name} className="bg-gradient-primary"><Save className="h-4 w-4 mr-1"/>Salvar talhão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ponto manual por coordenadas */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ponto por coordenadas</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Latitude</Label><Input type="number" step="0.000001" value={manualForm.lat} onChange={e => setManualForm({ ...manualForm, lat: e.target.value })}/></div>
            <div><Label>Longitude</Label><Input type="number" step="0.000001" value={manualForm.lng} onChange={e => setManualForm({ ...manualForm, lng: e.target.value })}/></div>
          </div>
          <div><Label>Observação</Label><Input value={manualForm.notes} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}/></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={addManual} className="bg-gradient-primary">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Estilos do MapboxDraw consistentes com a marca
const drawStyles: any[] = [
  { id: "gl-draw-polygon-fill", type: "fill", filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]], paint: { "fill-color": "#facc15", "fill-opacity": 0.18 } },
  { id: "gl-draw-polygon-stroke-active", type: "line", filter: ["all", ["==", "$type", "Polygon"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#eab308", "line-width": 3 } },
  { id: "gl-draw-line", type: "line", filter: ["all", ["==", "$type", "LineString"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#22c55e", "line-width": 3 } },
  { id: "gl-draw-polygon-and-line-vertex-halo-active", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]], paint: { "circle-radius": 6, "circle-color": "#fff" } },
  { id: "gl-draw-polygon-and-line-vertex-active", type: "circle", filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]], paint: { "circle-radius": 4, "circle-color": "#eab308" } },
  { id: "gl-draw-point", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]], paint: { "circle-radius": 6, "circle-color": "#22c55e", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
];

export default Mapas;
