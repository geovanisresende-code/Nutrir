import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Layers, Satellite, FlaskConical, Building2 } from "lucide-react";

type Farm = {
  id: string;
  name: string;
  location: string | null;
  client_id?: string | null;
  cliente_nome?: string | null;
  hectares: number;
  talhoes: number;
  culturas: string[];
};

export default function Fazendas() {
  const { current } = useOrg();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!current) return;
    (async () => {
      setLoading(true);
      const { data: fs } = await (supabase as any)
        .from("farms").select("id,name,location,client_id")
        .eq("organization_id", current.id).order("name");
      const farmIds = (fs ?? []).map((f: any) => f.id);
      const clientIds = Array.from(new Set((fs ?? []).map((f: any) => f.client_id).filter(Boolean)));

      const [fields, clientes] = await Promise.all([
        farmIds.length
          ? (supabase as any).from("fields").select("farm_id,hectares,cultura").in("farm_id", farmIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? (supabase as any).from("nutrir_clientes").select("id,razao_social").in("id", clientIds)
          : Promise.resolve({ data: [] }),
      ]);

      const cliMap = new Map((clientes.data ?? []).map((c: any) => [c.id, c.razao_social]));
      const list: Farm[] = (fs ?? []).map((f: any) => {
        const tlh = (fields.data ?? []).filter((x: any) => x.farm_id === f.id);
        return {
          id: f.id,
          name: f.name,
          location: f.location,
          client_id: f.client_id,
          cliente_nome: f.client_id ? (cliMap.get(f.client_id) as string) ?? null : null,
          hectares: tlh.reduce((s: number, t: any) => s + Number(t.hectares ?? 0), 0),
          talhoes: tlh.length,
          culturas: Array.from(new Set(tlh.map((t: any) => t.cultura).filter(Boolean))) as string[],
        };
      });
      setFarms(list);
      setLoading(false);
    })();
  }, [current?.id]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.cliente_nome ?? "").toLowerCase().includes(q) ||
      (f.location ?? "").toLowerCase().includes(q) ||
      f.culturas.some(c => c.toLowerCase().includes(q))
    );
  }, [farms, busca]);

  const totalHa = filtradas.reduce((s, f) => s + f.hectares, 0);
  const totalTalhoes = filtradas.reduce((s, f) => s + f.talhoes, 0);

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary"/>Fazendas</h1>
        <p className="text-muted-foreground text-sm">Catálogo consolidado de fazendas e talhões</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Fazendas</p><p className="text-2xl font-bold">{filtradas.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Talhões</p><p className="text-2xl font-bold">{totalTalhoes}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Hectares</p><p className="text-2xl font-bold">{totalHa.toFixed(1)}</p></CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
        <Input className="pl-9" placeholder="Buscar fazenda, cliente, cidade ou cultura..." value={busca} onChange={(e)=>setBusca(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma fazenda cadastrada. Cadastre uma em <Link to="/app/nutrir/clientes" className="text-primary underline">Clientes</Link>.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtradas.map(f => (
            <Card key={f.id} className="hover:shadow-md transition">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary"/>{f.name}
                </CardTitle>
                {f.cliente_nome && <p className="text-xs text-muted-foreground">{f.cliente_nome}</p>}
                {f.location && <p className="text-xs text-muted-foreground">{f.location}</p>}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{f.talhoes} talhões</Badge>
                  <Badge variant="outline">{f.hectares.toFixed(1)} ha</Badge>
                  {f.culturas.slice(0,3).map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
                </div>
                <div className="flex gap-1 pt-2">
                  <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/app/mapas"><Layers className="w-3 h-3 mr-1"/>Mapa</Link></Button>
                  <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/app/nutrir/ndvi"><Satellite className="w-3 h-3 mr-1"/>NDVI</Link></Button>
                  <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/app/nutrir/coleta"><FlaskConical className="w-3 h-3 mr-1"/>Coleta</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
