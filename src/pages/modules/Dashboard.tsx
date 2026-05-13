import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Map as MapIcon, FlaskConical, Brain, Satellite, Sprout, Users, AlertTriangle, FileText, ArrowRight, ShoppingCart, TrendingUp, FileSpreadsheet } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const NDVI_COLORS: Record<string, string> = {
  "Alto": "#16a34a",
  "Adequado": "#84cc16",
  "Médio": "#eab308",
  "Estresse": "#dc2626",
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

      // NDVI distribution + alerts (latest per field)
      const latest = new Map<string, { mean: number; date: string }>();
      (n.data ?? []).forEach((r: any) => {
        if (!latest.has(r.field_id) && r.ndvi_mean != null) {
          latest.set(r.field_id, { mean: Number(r.ndvi_mean), date: r.captured_at });
        }
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

      // Soil deficits (count of "baixo" per nutrient)
      const defMap: Record<string, number> = {};
      (s.data ?? []).forEach((row: any) => {
        const cls = row.classification ?? {};
        Object.entries(cls).forEach(([k, v]: [string, any]) => {
          if (v?.level === "baixo") defMap[k] = (defMap[k] ?? 0) + 1;
        });
      });
      setDeficits(
        Object.entries(defMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, v]) => ({ name: k.toUpperCase(), baixo: v })),
      );

      // Usage 30d
      const { data: usageRows } = await supabase
        .from("usage_metrics")
        .select("metric, occurred_at, amount")
        .eq("organization_id", current.id)
        .gte("occurred_at", new Date(Date.now() - 30 * 864e5).toISOString());
      const map: Record<string, { ai: number; ndvi: number }> = {};
      (usageRows ?? []).forEach((r: any) => {
        const day = r.occurred_at.slice(0, 10);
        if (!map[day]) map[day] = { ai: 0, ndvi: 0 };
        if (r.metric === "ai_call") map[day].ai += Number(r.amount ?? 1);
        if (r.metric === "ndvi_call") map[day].ndvi += Number(r.amount ?? 1);
      });
      setUsage(Object.entries(map).sort().map(([day, v]) => ({ day: day.slice(5), ...v })));

      // Bloco Nutrir
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

  return (
    <>
      <PageHeader title={`Olá, ${current?.name}`} description="Visão geral da sua operação" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <Stat icon={MapIcon} label="Talhões" value={stats.fields} />
          <Stat icon={Sprout} label="Hectares" value={stats.hectares.toLocaleString()} />
          <Stat icon={FlaskConical} label="Amostras" value={stats.samples} />
          <Stat icon={Brain} label="Análises IA" value={stats.ai} />
          <Stat icon={Satellite} label="NDVI" value={stats.ndvi} />
          <Stat icon={Users} label="Equipe" value={stats.members} />
          <Stat icon={FileText} label="Relatórios" value={stats.reports} />
        </div>

        {alerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />Alertas de NDVI baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                      <span className="font-medium">{a.field}</span>
                      <span className="text-muted-foreground text-xs">• {new Date(a.date).toLocaleDateString("pt-BR")}</span>
        </div>

        {/* Programa Nutrir */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sprout className="h-4 w-4 text-primary" />Programa NUTRIR
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/nutrir">Ver hub<ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <NutrirStat icon={TrendingUp} label="Faturamento" value={nutrir.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} accent />
              <NutrirStat icon={ShoppingCart} label="Pedidos" value={String(nutrir.pedidos)} />
              <NutrirStat icon={FileSpreadsheet} label="Orçamentos" value={String(nutrir.orcamentos)} />
              <NutrirStat icon={Sprout} label="Área orçada (ha)" value={nutrir.orcArea.toFixed(0)} />
              <NutrirStat icon={Users} label="Clientes" value={String(nutrir.clientes)} />
            </div>
          </CardContent>
        </Card>
                    <Badge variant="destructive">NDVI {a.ndvi.toFixed(3)}</Badge>
                  </div>
                ))}
              </div>
              <Button asChild variant="link" size="sm" className="px-0 mt-1">
                <Link to="/app/satelite">Ver módulo NDVI <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Uso de plataforma (30 dias)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={usage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ai" name="IA" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ndvi" name="NDVI" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Vigor dos talhões (NDVI)</CardTitle></CardHeader>
            <CardContent>
              {ndviDist.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">Sem dados NDVI ainda.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={ndviDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                      {ndviDist.map((d) => <Cell key={d.name} fill={NDVI_COLORS[d.name] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Deficiências mais frequentes (solo)</CardTitle></CardHeader>
            <CardContent>
              {deficits.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">Nenhuma deficiência detectada — ou ainda sem análises classificadas.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={deficits}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="baixo" name="Amostras com nível baixo" fill="hsl(var(--destructive))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Relatórios recentes</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/relatorios">Ver todos<ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">
                  Nenhum relatório gerado.{" "}
                  <Link to="/app/relatorios" className="text-primary underline">Criar agora</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentReports.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{r.kind}</Badge>
                          <span className="font-medium text-sm truncate">{r.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                      </div>
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

const Stat = ({ icon: I, label, value }: any) => (
  <Card className="shadow-soft">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs"><I className="h-4 w-4" />{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </CardContent>
  </Card>
);

const NutrirStat = ({ icon: I, label, value, accent }: any) => (
  <div className="rounded-lg border bg-card/60 p-3">
    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]"><I className="h-3.5 w-3.5" />{label}</div>
    <div className={`text-lg font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
  </div>
);

export default Dashboard;
