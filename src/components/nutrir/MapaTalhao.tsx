import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, Check } from "lucide-react";

// Fix default marker icons (Leaflet + bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = [number, number];

function ClickCollector({ enabled, onClick }: { enabled: boolean; onClick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) { if (enabled) onClick([e.latlng.lat, e.latlng.lng]); },
  });
  return null;
}

function FlyTo({ center }: { center: LatLng | null }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 15); }, [center, map]);
  return null;
}

interface Props {
  /** GeoJSON Polygon ou null */
  geometria?: any;
  centro?: LatLng | null;
  onSave?: (geo: any, centro: LatLng) => void;
  readOnly?: boolean;
  height?: number;
}

export function MapaTalhao({ geometria, centro, onSave, readOnly = false, height = 360 }: Props) {
  const initialPoints: LatLng[] =
    geometria?.coordinates?.[0]
      ?.slice(0, -1)
      ?.map((c: number[]) => [c[1], c[0]] as LatLng) ?? [];
  const [points, setPoints] = useState<LatLng[]>(initialPoints);
  const [drawing, setDrawing] = useState(false);
  const center: LatLng = centro ?? (initialPoints[0] ?? [-15.78, -47.93]); // Brasília fallback
  const mapRef = useRef<L.Map | null>(null);

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: LatLng = [pos.coords.latitude, pos.coords.longitude];
        mapRef.current?.setView(c, 16);
      },
      () => { /* ignore */ },
      { enableHighAccuracy: true },
    );
  };

  const limpar = () => setPoints([]);

  const salvar = () => {
    if (points.length < 3) return;
    const ring = [...points.map(([lat, lng]) => [lng, lat]), [points[0][1], points[0][0]]];
    const geo = { type: "Polygon", coordinates: [ring] };
    const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
    onSave?.(geo, [lat, lng]);
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={drawing ? "default" : "outline"} onClick={() => setDrawing((d) => !d)}>
            <MapPin className="h-4 w-4 mr-1" />
            {drawing ? "Clique no mapa para marcar pontos" : "Iniciar desenho"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={usarMinhaLocalizacao}>
            <MapPin className="h-4 w-4 mr-1" /> Minha localização
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={limpar} disabled={!points.length}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
          <Button type="button" size="sm" onClick={salvar} disabled={points.length < 3} className="bg-gradient-primary">
            <Check className="h-4 w-4 mr-1" /> Salvar talhão
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            {points.length} ponto(s) — mínimo 3 para fechar polígono
          </span>
        </div>
      )}
      <div style={{ height }} className="rounded-md overflow-hidden border">
        <MapContainer
          center={center}
          zoom={initialPoints.length ? 15 : 5}
          style={{ height: "100%", width: "100%" }}
          ref={(m) => { if (m) mapRef.current = m; }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap & Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <ClickCollector enabled={drawing && !readOnly} onClick={(p) => setPoints((arr) => [...arr, p])} />
          {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: "#22c55e", weight: 2, fillOpacity: 0.25 }} />}
          {points.map((p, i) => (
            <Marker key={i} position={p} />
          ))}
          <FlyTo center={initialPoints.length ? initialPoints[0] : null} />
        </MapContainer>
      </div>
    </div>
  );
}
