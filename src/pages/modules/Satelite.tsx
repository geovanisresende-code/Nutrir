import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Satellite, Loader2, History } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

type Field = { id: string; name: string; geometry: any };
type Reading = {
  id: string;
  field_id: string;
  captured_at: string;
  ndvi_mean: number | null;
  ndvi_min: number | null;
  ndvi_max: number | null;
  source: string | null;
};

const ndviTone = (v: number | null | undefined) => {
  if (v == null) return { label: "—", variant: "secondary" as const };
  if (v >= 0.6) return { label: "Vigor alto", variant: "default" as const };
  if (v >= 0.4) return { label: "Moderado", variant: "secondary" as const };
  if (v >= 0.25) return { label: "Baixo", variant: "secondary" as const };
  return { label: "Estresse", variant: "destructive" as const };
};

const Satelite = () => {
  const { current } = useOrg();
  const { log } = useAuditLog();
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [allLatest, setAllLatest] = useState<Record<string, Reading>>({});
  const [loading, setLoading] = useState<"latest" | "history" | null>(null);
  const [source, setSource] = useState<string>("demo");

  useEffect(() => {
    if (!current) return;
    supabase
      .from("organizations")
      .select("ndvi_source")
      .eq("id", current.id)
      .maybeSingle()
      .then(({ data }) => setSource((data as any)?.ndvi_source ?? "demo"));

    supabase
      .from("fields")
      .select("id,name,geometry")
      .eq("organization_id", current.id)
      .then(({ data }) => {
        const fs = (data ?? []) as Field[];
        setFields(fs);
        if (fs[0] && !fieldId) setFieldId(fs[0].id);
      });
  }, [current]);

  const loadReadings = async (fid: string) => {
    if (!fid || !current) return;
    const { data } = await supabase
      .from("ndvi_readings")
      .select("*")
      .eq("organization_id", current.id)
      .eq("field_id", fid)
      .order("captured_at");
    setReadings((data ?? []) as Reading[]);
  };

  const loadAllLatest = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("ndvi_readings")
      .select("*")
      .eq("organization_id", current.id)
      .order("captured_at", { ascending: false });
    const map: Record<string, Reading> = {};
    (data ?? []).forEach((r: any) => {
      if (!map[r.field_id]) map[r.field_id] = r;
    });
    setAllLatest(map);
  };

  useEffect(() => { loadReadings(fieldId); }, [fieldId, current]);
  useEffect(() => { loadAllLatest(); }, [current]);

  const fetchNDVI = async (mode: "latest" | "history") => {
    if (!fieldId || !current) return;
    setLoading(mode);
    const { data, error } = await supabase.functions.invoke("ndvi-fetch", {
      body: { field_id: fieldId, mode },
    });
    setLoading(null);
    if (error) { toast.error(error.message); return; }
    if (!data?.count) { toast.warning("Nenhum dado NDVI retornado para o período."); return; }
    toast.success(`${data.count} leitura(s) NDVI registradas`);
    log({ action: mode === "history" ? "ndvi.history" : "ndvi.fetch", entity_type: "ndvi_reading", field_id: fieldId, description: `${data.count} leitura(s) NDVI`, metadata: { mode, count: data.count } });
    await loadReadings(fieldId);
    await loadAllLatest();
  };

  const last = readings[readings.length - 1];
  const lastTone = ndviTone(last?.ndvi_mean);

  return (
    <>
      <PageHeader
        title="Satélite NDVI"
        description={`Índice de vegetação por talhão • Fonte: ${source === "sentinel_hub" ? "Sentinel Hub" : "Demo (simulado)"}`}
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-5 flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 min-w-[260px] flex-1">
              <label className="text-xs text-muted-foreground">Talhão</label>
              <Select value={fieldId} onValueChange={setFieldId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => fetchNDVI("latest")} disabled={!fieldId || !!loading} className="bg-gradient-primary">
              {loading === "latest" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Satellite className="h-4 w-4 mr-2" />}
              Atualizar NDVI
            </Button>
            <Button onClick={() => fetchNDVI("history")} disabled={!fieldId || !!loading} variant="outline">
              {loading === "history" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <History className="h-4 w-4 mr-2" />}
              Buscar histórico (12 meses)
            </Button>
          </CardContent>
        </Card>

        {last && (
          <div className="grid md:grid-cols-4 gap-4">
            <Stat label="NDVI médio" value={last.ndvi_mean?.toFixed(3)} badge={lastTone} />
            <Stat label="NDVI mín" value={last.ndvi_min?.toFixed(3)} />
            <Stat label="NDVI máx" value={last.ndvi_max?.toFixed(3)} />
            <Stat label="Capturado em" value={last.captured_at} />
          </div>
        )}

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Série histórica</h3>
            {readings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma leitura ainda. Clique em "Atualizar NDVI" ou "Buscar histórico".
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={readings}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="captured_at" className="text-xs" />
                  <YAxis domain={[0, 1]} className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <ReferenceLine y={0.6} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: "Vigor alto", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <ReferenceLine y={0.3} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: "Estresse", fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Line type="monotone" dataKey="ndvi_mean" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Talhões — última leitura</h3>
            {fields.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Nenhum talhão cadastrado.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fields.map(f => {
                  const r = allLatest[f.id];
                  const t = ndviTone(r?.ndvi_mean);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFieldId(f.id)}
                      className="text-left p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{f.name}</span>
                        <Badge variant={t.variant}>{t.label}</Badge>
                      </div>
                      <div className="mt-2 text-2xl font-bold">{r?.ndvi_mean?.toFixed(3) ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r?.captured_at ?? "Sem leituras"}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

const Stat = ({ label, value, badge }: { label: string; value: any; badge?: { label: string; variant: any } }) => (
  <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-3xl font-bold mt-1">{value ?? "—"}</div>
    {badge && <Badge className="mt-2" variant={badge.variant}>{badge.label}</Badge>}
  </CardContent></Card>
);

export default Satelite;
