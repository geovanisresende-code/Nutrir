import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Map as MapIcon, FlaskConical, Brain, Satellite, Sprout, Users,
  AlertTriangle, FileText, ArrowRight, ShoppingCart, TrendingUp,
  FileSpreadsheet, BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const NDVI_COLORS: Record<string, string> = {
  "Alto":        "#16a34a",
  "Adequado":    "#84cc16",
  "Médio":       "#eab308",
  "Estresse":    "#dc2626",
  "Sem leitura": "#94a3b8",
};

const Dashboard = () => {
  const { current } = useOrg();
  const [stats, setStats] = useState({ fields: 0, hectares: 0, samples: 0, ai: 0, ndvi: 0, members: 0, reports: 0 });
  const [usage, setUsage] = useState<{ day: string; ai: number; ndvi: number }[]>([]);
  const [ndviDist, setNdviDist] = useState<{ name: string; value: number }[]>([]);
  const [alerts, setAlerts] = useState<{ field: string; ndvi: number; date: string }[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [deficits, setDeficits] = useState<{ name: string; baixo: number }[]>([]);
  const [nutrir, setNutrir] = useState({ pedidos: 0, faturamento: 0, orcamentos: 0, orcArea: 0, clientes: 0 });

  useEffect(() => {
    if (!current) return;
    (async () => {
      const [f, s, ai, n, m, rep] = await Promise.all([
        supabase.from("fields").select("id, name, hectares").eq("organization_id", current.id),
        supabase.from("soil_samples").select("id, classification", { count: "exact" }).eq("organization_id", current.id),
        supabase.from("ai_recommendations").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
        supabase.from("ndvi_readings").select("field_id, ndvi_mean, captured_at").eq("organization_id", current.id).order("captured_at", { ascending: false }),
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
        supabase.from("reports").select("id, title, kind, created_at", { count: "exact" }).eq("organization_id", current.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const fields = f.data ?? [];
      const ha = fields.reduce((a: number, r: any) => a + Number(r.hectares ?? 0), 0);
      setStats({
        fields: fields.length,
        hectares: Math.round(ha),
        samples: s.count ?? 0,
        ai: ai.count ?? 0,
        ndvi: n.data?.length ?? 0,
        members: m.count ?? 0,
        reports: rep.count ?? 0,
      });
      setRecentReports(rep.data ?? []);

      const latest = new Map<string, { mean: number; date: string }>();
      (n.data ?? []).forEach((r: any) => {
        if (!latest.has(r.field_id) && r.ndvi_mean != null)
          latest.set(r.field_id, { mean: Number(r.ndvi_mean), date: r.captured_at });
      });
      const dist = { Alto: 0, Adequado: 0, Médio: 0, Estresse: 0, "Sem leitura": 0 };
      const lowAlerts: { field: string; ndvi: number; date: string }[] = [];
      fields.forEach((fi: any) => {
        const v = latest.get(fi.id);
        if (!v) { dist["Sem leitura"]++; return; }
        if (v.mean >= 0.6) dist.Alto++;
        else if (v.mean >= 0.4) dist.Adequado++;
        else if (v.mean >= 0.25) dist.Médio++;
        else { dist.Estresse++; lowAlerts.push({ field: fi.name, ndvi: v.mean, date: v.date }); }
      });
      setNdviDist(Object.entries(dist).map(([name, value]) => ({ name, value })).filter(d => d.value > 0));
      setAlerts(lowAlerts.sort((a, b) => a.ndvi - b.ndvi).slice(0, 5));

      const defMap: Record<string, number> = {};
      (s.data ?? []).forEach((row: any) => {
        const cls = row.classification ?? {};
        Object.entries(cls).forEach(([k, v]: [string, any]) => {
          if (v?.level === "baixo") defMap[k] = (defMap[k] ?? 0) + 1;
        });
      });
      setDeficits(
        Object.entries(defMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([k, v]) => ({ name: k.toUpperCase(), baixo: v })),
      );

      const { data: usageRows } = await supabase
        .from("usage_metrics").select("metric, occurred_at, amount")
        .eq("organization_id", current.id)
        .gte("occurred_at", new Date(Date.now() - 30 * 864e5).toISOString());
      const map: Record<string, { ai: number; ndvi: number }> = {};
      (usageRows ?? []).forEach((r: any) => {
        const day = r.occurred_at.slice(0, 10);
        if (!map[day]) map[day] = { ai: 0, ndvi: 0 };
        if (r.metric === "ai_call")  map[day].ai   += Number(r.amount ?? 1);
        if (r.metric === "ndvi_call") map[day].ndvi += Number(r.amount ?? 1);
      });
      setUsage(Object.entries(map).sort().map(([day, v]) => ({ day: day.slice(5), ...v })));

      const [peds, orcs, clisN] = await Promise.all([
        (supabase as any).from("nutrir_pedidos").select("total,status").eq("organization_id", current.id),
        (supabase as any).from("nutrir_orcamentos").select("total_geral,area_total_ha").eq("organization_id", current.id),
        (supabase as any).from("nutrir_clientes").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
      ]);
      const ativos = (peds.data ?? []).filter((p: any) => p.status !== "cancelado");
      setNutrir({
        pedidos: ativos.length,
        faturamento: ativos.reduce((s: number, p: any) => s + Number(p.total || 0), 0),
        orcamentos: (orcs.data ?? []).length,
        orcArea: (orcs.data ?? []).reduce((s: number, o: any) => s + Number(o.area_total_ha || 0), 0),
        clientes: clisN.count ?? 0,
      });
    })();
  }, [current]);

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 };

  return (
    <>
      <PageHeader title={`Olá, ${current?.name}`} description="Visão geral da sua operação" />
      <div className="p-6 space-y-6">

        {/* ── KPI Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat icon={MapIcon}     label="Talhões"    value={stats.fields}                    color="blue"   />
          <Stat icon={Sprout}      label="Hectares"   value={stats.hectares.toLocaleString()} color="green"  />
          <Stat icon={FlaskConical}label="Amostras"   value={stats.samples}                   color="violet" />
          <Stat icon={Brain}       label="Análises IA"value={stats.ai}                         color="orange" />
          <Stat icon={Satellite}   label="NDVI"       value={stats.ndvi}                       color="sky"    />
          <Stat icon={Users}       label="Equipe"     value={stats.members}                    color="indigo" />
          <Stat icon={FileText}    label="Relatórios" value={stats.reports}                    color="slate"  />
        </div>

        {/* ── Alertas NDVI ─────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <Card className="border-destructive/25 bg-destructive/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-destructive/10">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                Alertas de NDVI baixo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <span className="font-medium">{a.field}</span>
                    <span className="text-muted-foreground text-xs">{new Date(a.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">NDVI {a.ndvi.toFixed(3)}</Badge>
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="px-0 text-destructive hover:text-destructive text-xs mt-1">
                <Link to="/app/satelite">Ver módulo NDVI <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Programa Nutrir ──────────────────────────────────────── */}
        <Card className="border-primary/20" style={{ background: "linear-gradient(135deg, hsl(152 65% 22% / 0.04) 0%, transparent 60%)" }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary">
                <Sprout className="h-3.5 w-3.5" />
              </span>
              Programa NUTRIR
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary">
              <Link to="/app/nutrir">Ver hub <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <NutrirStat icon={TrendingUp}    label="Faturamento"   value={nutrir.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent />
              <NutrirStat icon={ShoppingCart}  label="Pedidos"       value={String(nutrir.pedidos)} />
              <NutrirStat icon={FileSpreadsheet}label="Orçamentos"   value={String(nutrir.orcamentos)} />
              <NutrirStat icon={Sprout}         label="Área (ha)"    value={nutrir.orcArea.toFixed(0)} />
              <NutrirStat icon={Users}          label="Clientes"     value={String(nutrir.clientes)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Charts Row ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Uso de plataforma — últimos 30 dias</CardTitle>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <EmptyChart label="Sem atividade nos últimos 30 dias" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={usage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="ai"   name="IA"   stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ndvi" name="NDVI" stroke="#0ea5e9"              strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Vigor dos talhões (NDVI)</CardTitle>
            </CardHeader>
            <CardContent>
              {ndviDist.length === 0 ? (
                <EmptyChart label="Nenhuma leitura NDVI ainda" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ndviDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {ndviDist.map((d) => <Cell key={d.name} fill={NDVI_COLORS[d.name] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom Row ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Deficiências mais frequentes (solo)</CardTitle>
            </CardHeader>
            <CardContent>
              {deficits.length === 0 ? (
                <EmptyChart label="Nenhuma deficiência detectada ainda" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deficits} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="baixo" name="Nível baixo" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Relatórios recentes</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                <Link to="/app/relatorios">Ver todos <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nenhum relatório gerado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Link to="/app/relatorios" className="text-primary underline">Criar o primeiro relatório</Link>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentReports.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{r.title}</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">{r.kind}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </>
  );
};

/* ── Componentes visuais ──────────────────────────────────────────────── */

const ICON_COLORS: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "bg-blue-50",    text: "text-blue-600"   },
  green:  { bg: "bg-emerald-50", text: "text-emerald-600" },
  violet: { bg: "bg-violet-50",  text: "text-violet-600" },
  orange: { bg: "bg-orange-50",  text: "text-orange-600" },
  sky:    { bg: "bg-sky-50",     text: "text-sky-600"    },
  indigo: { bg: "bg-indigo-50",  text: "text-indigo-600" },
  slate:  { bg: "bg-slate-100",  text: "text-slate-500"  },
};

const Stat = ({ icon: I, label, value, color = "blue" }: { icon: any; label: string; value: any; color?: string }) => {
  const c = ICON_COLORS[color] ?? ICON_COLORS.blue;
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${c.bg} ${c.text} mb-3`}>
          <I className="h-4 w-4" />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</div>
      </CardContent>
    </Card>
  );
};

const NutrirStat = ({ icon: I, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
  <div className="rounded-lg border border-border/60 bg-card p-3.5 flex flex-col gap-2">
    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
      <I className="h-3.5 w-3.5 shrink-0" />
      {label}
    </div>
    <div className={`text-xl font-bold tracking-tight leading-none ${accent ? "text-primary" : "text-foreground"}`}>
      {value}
    </div>
  </div>
);

const EmptyChart = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center h-[220px] gap-3">
    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
      <BarChart2 className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

export default Dashboard;
