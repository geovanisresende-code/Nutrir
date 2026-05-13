import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Flame, MapPin, Layers, Satellite } from "lucide-react";

type Layer = "gps" | "analysis" | "ndvi";
type AType = "soil" | "leaf";

const SOIL_NUTS = [
  { k: "ph", l: "pH" },
  { k: "organic_matter", l: "M.O." },
  { k: "phosphorus", l: "P" },
  { k: "potassium", l: "K" },
  { k: "calcium", l: "Ca" },
  { k: "magnesium", l: "Mg" },
  { k: "sulfur", l: "S" },
  { k: "cec", l: "CTC" },
];
const LEAF_NUTS = [
  { k: "n", l: "N" }, { k: "p", l: "P" }, { k: "k", l: "K" },
  { k: "ca", l: "Ca" }, { k: "mg", l: "Mg" }, { k: "s", l: "S" },
  { k: "b", l: "B" }, { k: "cu", l: "Cu" }, { k: "fe", l: "Fe" },
  { k: "mn", l: "Mn" }, { k: "zn", l: "Zn" },
];

const LEVEL_COLOR: Record<string, string> = {
  baixo: "#dc2626",
  medio: "#eab308",
  adequado: "#16a34a",
  alto: "#2563eb",
};

const Heatmap = () => {
  const { current } = useOrg();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const [layer, setLayer] = useState<Layer>("gps");
  const [analysisType, setAnalysisType] = useState<AType>("soil");
  const [nutrient, setNutrient] = useState<string>("ph");
  const [counts, setCounts] = useState({ baixo: 0, medio: 0, adequado: 0, alto: 0, total: 0 });

  // init map
  useEffect(() => {
    if (!current || !mapContainer.current || map.current) return;
    const token = current.mapbox_token;
    if (!token) { setTokenMissing(true); return; }
    setTokenMissing(false);

    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-47.9, -15.78],
      zoom: 4,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => setMapReady(true));

    return () => {
      markers.current.forEach(m => m.remove()); markers.current = [];
      map.current?.remove(); map.current = null; setMapReady(false);
    };
  }, [current]);

  const clearLayers = useCallback(() => {
    markers.current.forEach(m => m.remove()); markers.current = [];
    if (!map.current) return;
    if (map.current.getLayer("heat")) map.current.removeLayer("heat");
    if (map.current.getSource("pts")) map.current.removeSource("pts");
    if (map.current.getLayer("ndvi-fill")) map.current.removeLayer("ndvi-fill");
    if (map.current.getLayer("ndvi-line")) map.current.removeLayer("ndvi-line");
    if (map.current.getSource("ndvi-fields")) map.current.removeSource("ndvi-fields");
  }, []);

  const ndviColor = (v: number | null | undefined) => {
    if (v == null) return "#64748b";
    if (v >= 0.6) return "#16a34a";
    if (v >= 0.4) return "#84cc16";
    if (v >= 0.25) return "#eab308";
    return "#dc2626";
  };

  // load + render data
  const refresh = useCallback(async () => {
    if (!current || !map.current || !mapReady) return;
    clearLayers();

    if (layer === "gps") {
      const { data } = await supabase
        .from("collection_points")
        .select("id, latitude, longitude, kind, notes")
        .eq("organization_id", current.id);
      const pts = (data ?? []).filter(p => p.latitude != null && p.longitude != null);
      if (pts.length === 0) { setCounts({ baixo: 0, medio: 0, adequado: 0, alto: 0, total: 0 }); return; }

      const features = pts.map(p => ({
        type: "Feature" as const,
        properties: { weight: 1, kind: p.kind, notes: p.notes ?? "" },
        geometry: { type: "Point" as const, coordinates: [Number(p.longitude), Number(p.latitude)] },
      }));

      map.current.addSource("pts", { type: "geojson", data: { type: "FeatureCollection", features } });
      map.current.addLayer({
        id: "heat", type: "heatmap", source: "pts",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 15, 40],
          "heatmap-opacity": 0.75,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "#1e3a8a",
            0.4, "#16a34a",
            0.6, "#eab308",
            0.8, "#ea580c",
            1, "#dc2626",
          ],
        },
      });

      // also add point markers
      pts.forEach(p => {
        const el = document.createElement("div");
        el.style.cssText = "width:8px;height:8px;border-radius:9999px;background:#0ea5e9;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.4)";
        const m = new mapboxgl.Marker(el).setLngLat([Number(p.longitude), Number(p.latitude)]).addTo(map.current!);
        markers.current.push(m);
      });

      // fit
      const lngs = pts.map(p => Number(p.longitude));
      const lats = pts.map(p => Number(p.latitude));
      map.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 14 });
      setCounts({ baixo: 0, medio: 0, adequado: 0, alto: 0, total: pts.length });
      return;
    }

    // NDVI layer — color fields by latest NDVI mean
    if (layer === "ndvi") {
      const { data: fieldsData } = await supabase
        .from("fields")
        .select("id, name, geometry")
        .eq("organization_id", current.id);
      const fs = (fieldsData ?? []).filter((f: any) => f.geometry);
      if (fs.length === 0) { setCounts({ baixo: 0, medio: 0, adequado: 0, alto: 0, total: 0 }); return; }

      const { data: ndviData } = await supabase
        .from("ndvi_readings")
        .select("field_id, ndvi_mean, captured_at")
        .eq("organization_id", current.id)
        .order("captured_at", { ascending: false });
      const latest = new Map<string, { mean: number; date: string }>();
      (ndviData ?? []).forEach((r: any) => {
        if (!latest.has(r.field_id) && r.ndvi_mean != null) {
          latest.set(r.field_id, { mean: Number(r.ndvi_mean), date: r.captured_at });
        }
      });

      const features = fs.map((f: any) => {
        const v = latest.get(f.id);
        return {
          type: "Feature" as const,
          properties: {
            name: f.name,
            ndvi: v?.mean ?? null,
            date: v?.date ?? null,
            color: ndviColor(v?.mean),
          },
          geometry: f.geometry,
        };
      });

      map.current.addSource("ndvi-fields", { type: "geojson", data: { type: "FeatureCollection", features } as any });
      map.current.addLayer({
        id: "ndvi-fill", type: "fill", source: "ndvi-fields",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.55 },
      });
      map.current.addLayer({
        id: "ndvi-line", type: "line", source: "ndvi-fields",
        paint: { "line-color": "#fff", "line-width": 1.5 },
      });

      // popup on click
      map.current.on("click", "ndvi-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const p: any = feat.properties;
        new mapboxgl.Popup({ offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font:12px system-ui"><b>${p.name}</b><br/>NDVI: ${p.ndvi ?? "—"}<br/>${p.date ? `Em ${p.date}` : "Sem leitura"}</div>`)
          .addTo(map.current!);
      });

      // bounds
      const allCoords: number[][] = [];
      const walk = (arr: any) => { if (typeof arr[0] === "number") allCoords.push(arr); else arr.forEach(walk); };
      fs.forEach((f: any) => walk(f.geometry.coordinates));
      if (allCoords.length) {
        const lngs = allCoords.map(c => c[0]); const lats = allCoords.map(c => c[1]);
        map.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 14 });
      }

      // counts by NDVI band
      const c = { baixo: 0, medio: 0, adequado: 0, alto: 0, total: fs.length };
      fs.forEach((f: any) => {
        const v = latest.get(f.id)?.mean;
        if (v == null) return;
        if (v >= 0.6) c.alto++;
        else if (v >= 0.4) c.adequado++;
        else if (v >= 0.25) c.medio++;
        else c.baixo++;
      });
      setCounts(c);
      return;
    }

    const table = analysisType === "soil" ? "soil_samples" : "leaf_samples";
    const { data } = await supabase
      .from(table)
      .select(`id, classification, point_id, collection_points!${table}_point_id_fkey(latitude, longitude)`)
      .eq("organization_id", current.id) as any;

    // Note: the FK alias above may not exist; fallback to manual join below if select fails
    let rows: any[] = data ?? [];
    if (!rows.length) {
      // fallback: separate queries
      const { data: samples } = await supabase
        .from(table)
        .select("id, classification, point_id, crop, collected_at")
        .eq("organization_id", current.id)
        .not("point_id", "is", null);
      const ids = (samples ?? []).map((s: any) => s.point_id).filter(Boolean);
      if (ids.length === 0) { setCounts({ baixo: 0, medio: 0, adequado: 0, alto: 0, total: 0 }); return; }
      const { data: pts } = await supabase
        .from("collection_points")
        .select("id, latitude, longitude")
        .in("id", ids);
      const ptMap = new Map((pts ?? []).map((p: any) => [p.id, p]));
      rows = (samples ?? []).map((s: any) => ({ ...s, collection_points: ptMap.get(s.point_id) }));
    }

    const pts = rows
      .map(r => {
        const cp = r.collection_points;
        const cls = (r.classification ?? {})[nutrient];
        if (!cp || !cls) return null;
        return { lat: Number(cp.latitude), lng: Number(cp.longitude), level: cls.level, value: cls.value };
      })
      .filter(Boolean) as { lat: number; lng: number; level: string; value: number }[];

    const c = { baixo: 0, medio: 0, adequado: 0, alto: 0, total: pts.length };
    pts.forEach(p => { if ((c as any)[p.level] != null) (c as any)[p.level]++; });
    setCounts(c);

    if (pts.length === 0) return;

    pts.forEach(p => {
      const color = LEVEL_COLOR[p.level] ?? "#999";
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.5);cursor:pointer`;
      const m = new mapboxgl.Marker(el)
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font:12px system-ui"><b>${nutrient.toUpperCase()}</b>: ${p.value}<br/>Nível: ${p.level}</div>`
        ))
        .addTo(map.current!);
      markers.current.push(m);
    });

    const lngs = pts.map(p => p.lng), lats = pts.map(p => p.lat);
    map.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  }, [current, mapReady, layer, analysisType, nutrient, clearLayers]);

  useEffect(() => { refresh(); }, [refresh]);

  // reset nutrient when type changes
  useEffect(() => { setNutrient(analysisType === "soil" ? "ph" : "n"); }, [analysisType]);

  const nutOpts = analysisType === "soil" ? SOIL_NUTS : LEAF_NUTS;

  return (
    <>
      <PageHeader title="Heatmap" description="Mapa de calor de coletas GPS e classificação de nutrientes" />
      <div className="p-6">
        {tokenMissing ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center space-y-3">
              <Flame className="h-10 w-10 text-primary mx-auto" />
              <div className="font-semibold">Token Mapbox não configurado</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure seu token público Mapbox em Configurações para ativar o heatmap.
              </p>
              <Button asChild className="bg-gradient-primary"><Link to="/app/configuracoes">Ir para Configurações</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-1 shadow-soft">
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Camadas</h3>
                  <Tabs value={layer} onValueChange={v => setLayer(v as Layer)} className="mt-3">
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="gps"><MapPin className="h-3.5 w-3.5 mr-1" />GPS</TabsTrigger>
                      <TabsTrigger value="analysis"><Flame className="h-3.5 w-3.5 mr-1" />Análises</TabsTrigger>
                      <TabsTrigger value="ndvi"><Satellite className="h-3.5 w-3.5 mr-1" />NDVI</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {layer === "analysis" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={analysisType} onValueChange={v => setAnalysisType(v as AType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soil">Solo</SelectItem>
                          <SelectItem value="leaf">Foliar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nutriente</Label>
                      <Select value={nutrient} onValueChange={setNutrient}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {nutOpts.map(n => <SelectItem key={n.k} value={n.k}>{n.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {layer === "gps" ? "Pontos no mapa" : layer === "ndvi" ? "Talhões por NDVI" : "Distribuição"}
                  </div>
                  {layer === "gps" ? (
                    <div className="text-2xl font-bold">{counts.total}</div>
                  ) : layer === "ndvi" ? (
                    <div className="space-y-1.5 text-sm">
                      <LegendRow color="#16a34a" label="Alto (≥0.6)" count={counts.alto} />
                      <LegendRow color="#84cc16" label="Adequado (0.4–0.6)" count={counts.adequado} />
                      <LegendRow color="#eab308" label="Médio (0.25–0.4)" count={counts.medio} />
                      <LegendRow color="#dc2626" label="Estresse (<0.25)" count={counts.baixo} />
                      <div className="text-xs text-muted-foreground pt-1">Talhões: {counts.total}</div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      <LegendRow color={LEVEL_COLOR.baixo} label="Baixo" count={counts.baixo} />
                      <LegendRow color={LEVEL_COLOR.medio} label="Médio" count={counts.medio} />
                      <LegendRow color={LEVEL_COLOR.adequado} label="Adequado" count={counts.adequado} />
                      <LegendRow color={LEVEL_COLOR.alto} label="Alto" count={counts.alto} />
                      <div className="text-xs text-muted-foreground pt-1">Total: {counts.total}</div>
                    </div>
                  )}
                </div>

                {layer === "analysis" && counts.total === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma análise vinculada a um ponto GPS ainda. Vincule um <code>point_id</code> à amostra para que apareça aqui.
                  </p>
                )}
                {layer === "ndvi" && counts.total === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum talhão cadastrado. Crie talhões em "Mapas".
                  </p>
                )}
                {layer === "ndvi" && counts.total > 0 && counts.alto + counts.adequado + counts.medio + counts.baixo === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma leitura NDVI ainda. Vá em <Link to="/app/satelite" className="underline">Satélite</Link> e clique "Buscar histórico".
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-3 rounded-lg overflow-hidden border h-[calc(100vh-200px)] min-h-[500px]">
              <div ref={mapContainer} className="w-full h-full" />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const LegendRow = ({ color, label, count }: { color: string; label: string; count: number }) => (
  <div className="flex items-center gap-2">
    <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
    <span className="flex-1">{label}</span>
    <span className="font-medium tabular-nums">{count}</span>
  </div>
);

export default Heatmap;
