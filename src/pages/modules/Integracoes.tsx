import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/layout/AppShell";
import { Cloud, TrendingUp, TrendingDown, Webhook, Copy, Plus, Trash2, RefreshCw, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Field { id: string; name: string; centroid_lat: number | null; centroid_lng: number | null; }
interface Quote { id: string; commodity: string; price_brl: number; unit: string; variation_pct: number | null; source: string; reference_date: string; fetched_at: string; }
interface ErpWebhook { id: string; label: string; token: string; enabled: boolean; total_calls: number; last_used_at: string | null; created_at: string; }

const COMMODITY_LABELS: Record<string, string> = {
  "soja": "Soja", "milho": "Milho", "cafe-arabica": "Café Arábica",
  "trigo": "Trigo", "algodao": "Algodão", "boi-gordo": "Boi Gordo",
};

export default function Integracoes() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Integrações" description="Clima, commodities e ERPs externos." />
      <div className="p-6 flex-1 min-w-0">
        <Tabs defaultValue="weather" className="w-full">
          <TabsList>
            <TabsTrigger value="weather"><Cloud className="w-4 h-4 mr-2" />Clima</TabsTrigger>
            <TabsTrigger value="commodities"><TrendingUp className="w-4 h-4 mr-2" />Commodities</TabsTrigger>
            <TabsTrigger value="erp"><Webhook className="w-4 h-4 mr-2" />ERP</TabsTrigger>
          </TabsList>
          <TabsContent value="weather" className="mt-4"><WeatherTab /></TabsContent>
          <TabsContent value="commodities" className="mt-4"><CommoditiesTab /></TabsContent>
          <TabsContent value="erp" className="mt-4"><ErpTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------- Weather ----------
function WeatherTab() {
  const { current } = useOrg();
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!current) return;
    supabase.from("fields").select("id, name, centroid_lat, centroid_lng").eq("organization_id", current.id)
      .then(({ data }) => {
        const list = (data ?? []).filter(f => f.centroid_lat && f.centroid_lng) as Field[];
        setFields(list);
        if (list[0]) setSelected(list[0].id);
      });
  }, [current]);

  const fetchForecast = async () => {
    if (!selected) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("weather-forecast", {
      method: "GET" as any,
      body: undefined,
      headers: {},
    } as any).catch(() => ({ data: null, error: "fail" } as any));
    // invoke doesn't support querystring well; fallback to direct fetch
    try {
      const sess = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weather-forecast?field_id=${selected}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${sess.data.session?.access_token}` } });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error ?? "Falha ao buscar"); return; }
      setForecast(j);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (selected) fetchForecast(); }, [selected]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Cloud className="w-5 h-5 text-primary" />Previsão do tempo</CardTitle>
            <CardDescription>Open-Meteo · Atualizada em tempo real, sem chave de API.</CardDescription>
          </div>
          <Button onClick={fetchForecast} variant="outline" size="sm" disabled={loading || !selected}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum talhão com coordenadas. Cadastre talhões com geometria no módulo Mapas.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <select className="bg-background border rounded-md px-3 py-1.5 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {forecast?.current && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Stat label="Temperatura" value={`${forecast.current.temperature_2m}°C`} />
                <Stat label="Umidade" value={`${forecast.current.relative_humidity_2m}%`} />
                <Stat label="Chuva" value={`${forecast.current.precipitation} mm`} />
                <Stat label="Vento" value={`${forecast.current.wind_speed_10m} km/h`} />
              </div>
            )}
            {forecast?.daily && (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr><th className="text-left p-2">Data</th><th className="text-right p-2">Mín</th><th className="text-right p-2">Máx</th><th className="text-right p-2">Chuva</th><th className="text-right p-2">Prob.</th></tr>
                  </thead>
                  <tbody>
                    {forecast.daily.time.map((d: string, i: number) => (
                      <tr key={d} className="border-t">
                        <td className="p-2">{format(new Date(d), "EEE dd/MM", { locale: ptBR })}</td>
                        <td className="p-2 text-right">{forecast.daily.temperature_2m_min[i]}°</td>
                        <td className="p-2 text-right font-medium">{forecast.daily.temperature_2m_max[i]}°</td>
                        <td className="p-2 text-right">{forecast.daily.precipitation_sum[i]} mm</td>
                        <td className="p-2 text-right text-muted-foreground">{forecast.daily.precipitation_probability_max[i]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Commodities ----------
function CommoditiesTab() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("commodities-quotes", { body: {} });
    if (error) toast.error(error.message);
    else setQuotes(data?.quotes ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Cotações de commodities</CardTitle>
            <CardDescription>CEPEA / B3 · Cache de 1 hora.</CardDescription>
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map(q => {
            const up = (q.variation_pct ?? 0) >= 0;
            return (
              <div key={q.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{COMMODITY_LABELS[q.commodity] ?? q.commodity}</div>
                  <Badge variant={up ? "default" : "destructive"} className="gap-1 text-xs">
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {(q.variation_pct ?? 0).toFixed(2)}%
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-2">R$ {q.price_brl.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">{q.unit} · {q.source}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- ERP ----------
function ErpTab() {
  const { current } = useOrg();
  const [items, setItems] = useState<ErpWebhook[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!current) return;
    const { data } = await supabase.from("erp_webhooks").select("*").eq("organization_id", current.id).order("created_at", { ascending: false });
    setItems((data ?? []) as ErpWebhook[]);
  };

  useEffect(() => { load(); }, [current?.id]);

  const create = async () => {
    if (!current || !label.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("erp_webhooks").insert({ organization_id: current.id, label: label.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setLabel("");
    toast.success("Webhook criado");
    load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("erp_webhooks").update({ enabled }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este webhook? Sistemas externos pararão de sincronizar.")) return;
    await supabase.from("erp_webhooks").delete().eq("id", id);
    load();
  };

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-webhook`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5 text-primary" />Webhooks de ERP</CardTitle>
          <CardDescription>
            Receba amostras automaticamente do seu ERP enviando POST com JSON para a URL gerada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nome (ex: ERP Fazenda Sul)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button onClick={create} disabled={busy || !label.trim()}><Plus className="w-4 h-4 mr-2" />Gerar token</Button>
          </div>

          <details className="text-sm border rounded-lg p-3 bg-muted/30">
            <summary className="cursor-pointer font-medium">Como integrar (exemplo)</summary>
            <pre className="text-xs bg-background p-3 rounded mt-2 overflow-x-auto">{`POST ${baseUrl}?token=<SEU_TOKEN>
Content-Type: application/json

{
  "type": "soil_sample",
  "field_id": "<uuid_do_talhao>",
  "collected_at": "2026-04-30",
  "crop": "soja",
  "data": {
    "ph": 6.2, "n": 22, "p": 18, "k": 145,
    "ca": 4.5, "mg": 1.2, "organic_matter": 3.4
  }
}`}</pre>
          </details>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum webhook criado ainda.</p>}
        {items.map(w => {
          const url = `${baseUrl}?token=${w.token}`;
          return (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{w.label}</span>
                      <Badge variant={w.enabled ? "default" : "secondary"} className="text-xs">
                        {w.enabled ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Input readOnly value={url} className="text-xs font-mono" />
                      <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado!"); }}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {w.total_calls} chamada{w.total_calls === 1 ? "" : "s"} ·{" "}
                      {w.last_used_at ? `última: ${format(new Date(w.last_used_at), "dd/MM HH:mm", { locale: ptBR })}` : "nunca usado"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={w.enabled} onCheckedChange={(v) => toggle(w.id, v)} />
                    <Button size="icon" variant="ghost" onClick={() => remove(w.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="border rounded-lg p-3 bg-card">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-xl font-semibold mt-1">{value}</div>
  </div>
);
