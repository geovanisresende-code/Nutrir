import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History, FlaskConical, Leaf, Brain, Image as ImageIcon,
  Satellite, FileText, MapPin, User as UserIcon, Filter, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EventType =
  | "soil_sample" | "leaf_sample" | "ai_recommendation" | "ai_image_diagnosis"
  | "ndvi_reading" | "report" | "collection_route" | "audit";

interface TimelineEvent {
  id: string;
  type: EventType;
  date: string; // ISO
  title: string;
  subtitle?: string;
  client_id?: string | null;
  field_id?: string | null;
  client_name?: string;
  field_name?: string;
  meta?: Record<string, any>;
  user_email?: string;
}

const ICONS: Record<EventType, any> = {
  soil_sample: FlaskConical,
  leaf_sample: Leaf,
  ai_recommendation: Brain,
  ai_image_diagnosis: ImageIcon,
  ndvi_reading: Satellite,
  report: FileText,
  collection_route: MapPin,
  audit: History,
};

const COLORS: Record<EventType, string> = {
  soil_sample: "bg-amber-500/15 text-amber-700 border-amber-200",
  leaf_sample: "bg-[#d4a843]/15 text-emerald-700 border-emerald-200",
  ai_recommendation: "bg-violet-500/15 text-violet-700 border-violet-200",
  ai_image_diagnosis: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-200",
  ndvi_reading: "bg-green-500/15 text-green-700 border-green-200",
  report: "bg-blue-500/15 text-blue-700 border-blue-200",
  collection_route: "bg-orange-500/15 text-orange-700 border-orange-200",
  audit: "bg-slate-500/15 text-slate-700 border-slate-200",
};

const TYPE_LABEL: Record<EventType, string> = {
  soil_sample: "Análise de solo",
  leaf_sample: "Análise foliar",
  ai_recommendation: "Recomendação IA",
  ai_image_diagnosis: "Diagnóstico (imagem)",
  ndvi_reading: "Leitura NDVI",
  report: "Relatório",
  collection_route: "Coleta",
  audit: "Auditoria",
};

export default function Historico() {
  const { current } = useOrg();
  const orgId = current?.id;

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [fields, setFields] = useState<{ id: string; name: string; client_id: string | null }[]>([]);

  // Filters
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<string>("90");

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [c, f] = await Promise.all([
        supabase.from("clients").select("id,name").eq("organization_id", orgId).order("name"),
        supabase.from("fields").select("id,name,client_id").eq("organization_id", orgId).order("name"),
      ]);
      setClients(c.data ?? []);
      setFields(f.data ?? []);
    })();
  }, [orgId]);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();

    const [soil, leaf, rec, diag, ndvi, rep, route, audit] = await Promise.all([
      supabase.from("soil_samples").select("id,collected_at,created_at,crop,client_id,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("leaf_samples").select("id,collected_at,created_at,crop,client_id,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("ai_recommendations").select("id,created_at,model,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("ai_image_diagnoses").select("id,created_at,crop,severity,diagnosis,client_id,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("ndvi_readings").select("id,created_at,captured_at,ndvi_mean,source,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("reports").select("id,created_at,title,kind,client_id,field_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("collection_routes").select("id,created_at,name,status,field_id,client_id,hectares").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
      supabase.from("audit_log").select("id,created_at,action,entity_type,entity_id,client_id,field_id,description,metadata,user_id").eq("organization_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    ]);

    const fieldMap = new Map(fields.map(f => [f.id, f.name]));
    const clientMap = new Map(clients.map(c => [c.id, c.name]));

    const all: TimelineEvent[] = [];

    (soil.data ?? []).forEach((s: any) => all.push({
      id: `soil-${s.id}`, type: "soil_sample", date: s.created_at,
      title: `Análise de solo${s.crop ? ` · ${s.crop}` : ""}`,
      subtitle: `Coletado em ${s.collected_at}`,
      client_id: s.client_id, field_id: s.field_id,
      client_name: clientMap.get(s.client_id), field_name: fieldMap.get(s.field_id),
    }));
    (leaf.data ?? []).forEach((s: any) => all.push({
      id: `leaf-${s.id}`, type: "leaf_sample", date: s.created_at,
      title: `Análise foliar${s.crop ? ` · ${s.crop}` : ""}`,
      subtitle: `Coletado em ${s.collected_at}`,
      client_id: s.client_id, field_id: s.field_id,
      client_name: clientMap.get(s.client_id), field_name: fieldMap.get(s.field_id),
    }));
    (rec.data ?? []).forEach((r: any) => all.push({
      id: `rec-${r.id}`, type: "ai_recommendation", date: r.created_at,
      title: "Recomendação IA gerada",
      subtitle: r.model,
      field_id: r.field_id, field_name: fieldMap.get(r.field_id),
    }));
    (diag.data ?? []).forEach((d: any) => all.push({
      id: `diag-${d.id}`, type: "ai_image_diagnosis", date: d.created_at,
      title: d.diagnosis ? d.diagnosis.slice(0, 80) : "Diagnóstico por imagem",
      subtitle: [d.crop, d.severity].filter(Boolean).join(" · "),
      client_id: d.client_id, field_id: d.field_id,
      client_name: clientMap.get(d.client_id), field_name: fieldMap.get(d.field_id),
    }));
    (ndvi.data ?? []).forEach((n: any) => all.push({
      id: `ndvi-${n.id}`, type: "ndvi_reading", date: n.created_at,
      title: `NDVI ${Number(n.ndvi_mean ?? 0).toFixed(2)}`,
      subtitle: `${n.captured_at} · ${n.source}`,
      field_id: n.field_id, field_name: fieldMap.get(n.field_id),
    }));
    (rep.data ?? []).forEach((r: any) => all.push({
      id: `rep-${r.id}`, type: "report", date: r.created_at,
      title: r.title, subtitle: r.kind,
      client_id: r.client_id, field_id: r.field_id,
      client_name: clientMap.get(r.client_id), field_name: fieldMap.get(r.field_id),
    }));
    (route.data ?? []).forEach((r: any) => all.push({
      id: `route-${r.id}`, type: "collection_route", date: r.created_at,
      title: `Rota de coleta · ${r.name}`,
      subtitle: `${r.status}${r.hectares ? ` · ${r.hectares} ha` : ""}`,
      client_id: r.client_id, field_id: r.field_id,
      client_name: clientMap.get(r.client_id), field_name: fieldMap.get(r.field_id),
    }));
    (audit.data ?? []).forEach((a: any) => all.push({
      id: `audit-${a.id}`, type: "audit", date: a.created_at,
      title: `${a.action} · ${a.entity_type}`,
      subtitle: a.description ?? undefined,
      client_id: a.client_id, field_id: a.field_id,
      client_name: clientMap.get(a.client_id), field_name: fieldMap.get(a.field_id),
      meta: a.metadata,
    }));

    all.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    setEvents(all);
    setLoading(false);
  };

  useEffect(() => {
    if (orgId && clients.length >= 0 && fields.length >= 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, days, clients, fields]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (clientFilter !== "all" && e.client_id !== clientFilter) return false;
      if (fieldFilter !== "all" && e.field_id !== fieldFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [e.title, e.subtitle, e.client_name, e.field_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, clientFilter, fieldFilter, typeFilter, search]);

  const fieldsForClient = clientFilter === "all" ? fields : fields.filter(f => f.client_id === clientFilter);

  // Counters
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1; });
    return c;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><History className="h-6 w-6" /> Histórico & Auditoria</h1>
          <p className="text-sm text-muted-foreground">Linha do tempo de tudo que aconteceu na sua organização.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setFieldFilter("all"); }}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fieldFilter} onValueChange={setFieldFilter}>
            <SelectTrigger><SelectValue placeholder="Talhão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os talhões</SelectItem>
              {fieldsForClient.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar texto..." value={search} onChange={e => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Linha do tempo ({filtered.length})</TabsTrigger>
          <TabsTrigger value="summary">Resumo por tipo</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {!loading && filtered.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum evento encontrado.</CardContent></Card>
          )}
          <div className="space-y-2">
            {filtered.map(e => {
              const Icon = ICONS[e.type];
              return (
                <Card key={e.id} className="hover:shadow-soft transition-shadow">
                  <CardContent className="py-3 flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-full grid place-items-center border ${COLORS[e.type]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{e.title}</span>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[e.type]}</Badge>
                        {e.client_name && <Badge variant="secondary" className="text-[10px] gap-1"><UserIcon className="h-3 w-3" />{e.client_name}</Badge>}
                        {e.field_name && <Badge variant="secondary" className="text-[10px] gap-1"><MapPin className="h-3 w-3" />{e.field_name}</Badge>}
                      </div>
                      {e.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{e.subtitle}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(e.date), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(TYPE_LABEL) as EventType[]).map(t => {
              const Icon = ICONS[t];
              return (
                <Card key={t}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full grid place-items-center border ${COLORS[t]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{counts[t] ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
