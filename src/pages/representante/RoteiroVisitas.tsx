import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Coordenadas aproximadas das capitais brasileiras (fallback quando cliente não tem lat/lng)
const CIDADE_FALLBACK: Record<string, [number, number]> = {
  "São Paulo/SP": [-23.55, -46.63],
  "Campinas/SP": [-22.91, -47.06],
  "Ribeirão Preto/SP": [-21.18, -47.81],
  "Goiânia/GO": [-16.68, -49.25],
  "Brasília/DF": [-15.78, -47.93],
  "Cuiabá/MT": [-15.6, -56.1],
  "Sorriso/MT": [-12.55, -55.71],
  "Uberlândia/MG": [-18.91, -48.27],
  "Curitiba/PR": [-25.43, -49.27],
  "Londrina/PR": [-23.31, -51.16],
};

interface ClienteRota {
  id: string;
  razao_social: string;
  cidade: string | null;
  uf: string | null;
  ultima_visita: string | null;
  contas_vencendo: number;
  testes_ativos: number;
  lat: number;
  lng: number;
}

const cidadeIcon = (n: number, ativo: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${ativo ? "hsl(var(--primary))" : "#64748b"};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

export default function RoteiroVisitas() {
  const { user } = useAuth();
  const { current: org } = useOrg();
  const [clientes, setClientes] = useState<ClienteRota[]>([]);
  const [loading, setLoading] = useState(true);
  const [origem, setOrigem] = useState<[number, number] | null>(null);
  const [rota, setRota] = useState<{ cliente_id: string; ordem: number; motivo: string }[]>([]);
  const [resumoIA, setResumoIA] = useState<string>("");
  const [iaLoading, setIaLoading] = useState(false);

  useEffect(() => {
    if (!org || !user) return;
    (async () => {
      setLoading(true);
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const em15 = new Date();
      em15.setDate(em15.getDate() + 15);

      const { data: cli } = await supabase
        .from("nutrir_clientes")
        .select("id,razao_social,cidade,uf")
        .eq("organization_id", org.id)
        .eq("ativo", true)
        .limit(60);

      const { data: visitas } = await supabase
        .from("nutrir_visitas")
        .select("cliente_id,data_visita")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .order("data_visita", { ascending: false });

      const { data: contas } = await supabase
        .from("nutrir_contas_receber")
        .select("cliente_id")
        .eq("organization_id", org.id)
        .in("status", ["em_aberto", "vencendo"])
        .lte("data_vencimento", em15.toISOString().slice(0, 10));

      const { data: testes } = await supabase
        .from("nutrir_campos_teste")
        .select("cliente_id,centro_lat,centro_lng,centroid_lat,centroid_lng")
        .eq("organization_id", org.id)
        .eq("status", "em_andamento");

      const ultMap = new Map<string, string>();
      (visitas ?? []).forEach((v: any) => {
        if (v.cliente_id && !ultMap.has(v.cliente_id)) ultMap.set(v.cliente_id, v.data_visita);
      });
      const contasMap = new Map<string, number>();
      (contas ?? []).forEach((c: any) => {
        if (c.cliente_id) contasMap.set(c.cliente_id, (contasMap.get(c.cliente_id) || 0) + 1);
      });
      const testesMap = new Map<string, number>();
      const coordMap = new Map<string, [number, number]>();
      (testes ?? []).forEach((t: any) => {
        if (t.cliente_id) testesMap.set(t.cliente_id, (testesMap.get(t.cliente_id) || 0) + 1);
        const lat = t.centro_lat ?? t.centroid_lat;
        const lng = t.centro_lng ?? t.centroid_lng;
        if (t.cliente_id && lat && lng && !coordMap.has(t.cliente_id)) {
          coordMap.set(t.cliente_id, [Number(lat), Number(lng)]);
        }
      });

      const list: ClienteRota[] = (cli ?? [])
        .map((c: any) => {
          const key = `${c.cidade ?? ""}/${c.uf ?? ""}`;
          const coord =
            coordMap.get(c.id) ??
            CIDADE_FALLBACK[key] ??
            // Espalha levemente para que clientes da mesma cidade não sobreponham
            [-15.78 + (Math.random() - 0.5) * 6, -47.93 + (Math.random() - 0.5) * 8];
          return {
            id: c.id,
            razao_social: c.razao_social,
            cidade: c.cidade,
            uf: c.uf,
            ultima_visita: ultMap.get(c.id) ?? null,
            contas_vencendo: contasMap.get(c.id) ?? 0,
            testes_ativos: testesMap.get(c.id) ?? 0,
            lat: coord[0],
            lng: coord[1],
          };
        })
        .filter(c => c.lat && c.lng);

      setClientes(list);
      setLoading(false);
    })();
  }, [org, user]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigem([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 4000 },
    );
  }, []);

  const center: [number, number] = useMemo(() => {
    if (origem) return origem;
    if (clientes.length) return [clientes[0].lat, clientes[0].lng];
    return [-15.78, -47.93];
  }, [origem, clientes]);

  const sugerirRota = async () => {
    if (clientes.length === 0) {
      toast.error("Nenhum cliente para roteirizar.");
      return;
    }
    setIaLoading(true);
    try {
      const payload = clientes.slice(0, 30).map((c) => ({
        id: c.id,
        razao_social: c.razao_social,
        cidade: c.cidade,
        uf: c.uf,
        ultima_visita: c.ultima_visita,
        pendencias: [
          c.contas_vencendo > 0 ? `${c.contas_vencendo} conta(s) vencendo` : null,
          c.testes_ativos > 0 ? `${c.testes_ativos} teste(s) ativo(s)` : null,
        ].filter(Boolean),
      }));
      const { data, error } = await supabase.functions.invoke("rep-rota-sugerida", {
        body: {
          clientes: payload,
          origem: origem ? { lat: origem[0], lng: origem[1] } : null,
        },
      });
      if (error) throw error;
      const r = (data?.rota ?? []) as { cliente_id: string; ordem: number; motivo: string }[];
      setRota(r.sort((a, b) => a.ordem - b.ordem));
      setResumoIA(data?.resumo ?? "");
      toast.success(`Rota sugerida: ${r.length} parada(s).`);
    } catch (e: any) {
      toast.error(`Falha na IA: ${e?.message ?? e}`);
    } finally {
      setIaLoading(false);
    }
  };

  const rotaClientes = rota
    .map((r) => ({ ...r, cliente: clientes.find((c) => c.id === r.cliente_id) }))
    .filter((r) => r.cliente);
  const rotaPolyline: [number, number][] = [
    ...(origem ? [origem] : []),
    ...rotaClientes.map((r) => [r.cliente!.lat, r.cliente!.lng] as [number, number]),
  ];

  const abrirGoogleMaps = () => {
    if (rotaClientes.length === 0) return;
    const base = "https://www.google.com/maps/dir/?api=1";
    const orig = origem ? `&origin=${origem[0]},${origem[1]}` : "";
    const dest = rotaClientes[rotaClientes.length - 1].cliente!;
    const waypoints = rotaClientes
      .slice(0, -1)
      .map((r) => `${r.cliente!.lat},${r.cliente!.lng}`)
      .join("|");
    const url =
      `${base}${orig}&destination=${dest.lat},${dest.lng}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "");
    window.open(url, "_blank");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Roteiro inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Sugestão de rota do dia gerada por IA com base em proximidade, última visita e pendências.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={sugerirRota} disabled={iaLoading || loading}>
            {iaLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Sugerir rota com IA
          </Button>
          {rotaClientes.length > 0 && (
            <Button variant="outline" onClick={abrirGoogleMaps}>
              <Navigation className="h-4 w-4 mr-2" /> Abrir no Maps
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <div style={{ height: 480 }}>
              <MapContainer center={center} zoom={6} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                {origem && (
                  <Marker position={origem}>
                    <Popup>Sua localização</Popup>
                  </Marker>
                )}
                {clientes.map((c) => {
                  const ord = rotaClientes.find((r) => r.cliente_id === c.id)?.ordem;
                  return (
                    <Marker
                      key={c.id}
                      position={[c.lat, c.lng]}
                      icon={cidadeIcon(ord ?? 0, !!ord)}
                    >
                      <Popup>
                        <div className="text-sm">
                          <div className="font-semibold">{c.razao_social}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.cidade}/{c.uf}
                          </div>
                          {c.ultima_visita && (
                            <div className="text-xs mt-1">
                              Última visita: {new Date(c.ultima_visita).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                          {c.contas_vencendo > 0 && (
                            <div className="text-xs text-amber-700">
                              ⚠️ {c.contas_vencendo} conta(s) vencendo
                            </div>
                          )}
                          {c.testes_ativos > 0 && (
                            <div className="text-xs text-emerald-700">
                              🧪 {c.testes_ativos} teste(s) ativo(s)
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
                {rotaPolyline.length > 1 && (
                  <Polyline positions={rotaPolyline} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />
                )}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ordem sugerida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {resumoIA && (
              <div className="text-xs bg-primary/5 border border-primary/20 rounded p-2 mb-3">
                <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
                {resumoIA}
              </div>
            )}
            {rotaClientes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Clique em <strong>Sugerir rota com IA</strong> para gerar a ordem otimizada de visitas.
              </p>
            )}
            {rotaClientes.map((r) => (
              <div key={r.cliente_id} className="flex gap-2 items-start border-b pb-2 last:border-0">
                <Badge className="mt-0.5">{r.ordem}</Badge>
                <div className="flex-1">
                  <div className="font-medium text-sm">{r.cliente!.razao_social}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.cliente!.cidade}/{r.cliente!.uf}
                  </div>
                  <div className="text-xs italic mt-0.5">{r.motivo}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
