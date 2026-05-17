import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Target,
  AlertTriangle, Award, BarChart3, Download, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const BRL = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt0 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);

const COLORS = ["hsl(var(--primary))", "#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

function Kpi({ icon: Icon, label, value, sub, delta, accent }: {
  icon: any; label: string; value: string; sub?: string; delta?: number; accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs mt-1 font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs mês anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PainelDiretoria() {
  const { current } = useOrg();
  const [pedidos, setPedidos]         = useState<any[]>([]);
  const [representantes, setRep]      = useState<any[]>([]);
  const [colaboradores, setColabs]    = useState<any[]>([]);
  const [regionais, setRegionais]     = useState<any[]>([]);
  const [clientes, setClientes]       = useState<any[]>([]);
  const [rdvs, setRdvs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    if (!current) return;
    setLoading(true);
    const [ped, rep, col, reg, cli, rdv] = await Promise.all([
      (supabase as any).from("nutrir_pedidos").select("id,total,status,created_at,representante_id,regional_id,cliente_id,custo_total").eq("organization_id", current.id).order("created_at"),
      (supabase as any).from("nutrir_representantes").select("id,nome").eq("organization_id", current.id),
      (supabase as any).from("nutrir_colaboradores").select("id,nome,meta_mensal,regional_id").eq("organization_id", current.id),
      (supabase as any).from("nutrir_regionais").select("id,nome").eq("organization_id", current.id),
      (supabase as any).from("nutrir_clientes").select("id,razao_social").eq("organization_id", current.id),
      (supabase as any).from("nutrir_rdv").select("id,valor,data,status,categoria").eq("organization_id", current.id),
    ]);
    setPedidos(ped.data ?? []);
    setRep(rep.data ?? []);
    setColabs(col.data ?? []);
    setRegionais(reg.data ?? []);
    setClientes(cli.data ?? []);
    setRdvs(rdv.data ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  // ─── cálculos ─────────────────────────────────────────────────────────────
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth();

  const pedAtivos = useMemo(() => pedidos.filter(p => p.status !== "cancelado"), [pedidos]);

  // YTD
  const pedYTD = useMemo(() => pedAtivos.filter(p => new Date(p.created_at).getFullYear() === anoAtual), [pedAtivos]);
  const faturYTD = pedYTD.reduce((s, p) => s + Number(p.total || 0), 0);
  const metaYTD = colaboradores.reduce((s, c) => s + Number(c.meta_mensal || 0), 0) * (mesAtual + 1);
  const pctYTD = pct(faturYTD, metaYTD);

  // Mês atual vs anterior
  const pedMesAtual = useMemo(() => pedAtivos.filter(p => {
    const d = new Date(p.created_at);
    return d.getFullYear() === anoAtual && d.getMonth() === mesAtual;
  }), [pedAtivos]);
  const pedMesAnterior = useMemo(() => pedAtivos.filter(p => {
    const d = new Date(p.created_at);
    const prev = mesAtual === 0 ? { m: 11, y: anoAtual - 1 } : { m: mesAtual - 1, y: anoAtual };
    return d.getFullYear() === prev.y && d.getMonth() === prev.m;
  }), [pedAtivos]);

  const faturMes   = pedMesAtual.reduce((s, p) => s + Number(p.total || 0), 0);
  const faturPrev  = pedMesAnterior.reduce((s, p) => s + Number(p.total || 0), 0);
  const deltaMes   = faturPrev > 0 ? ((faturMes - faturPrev) / faturPrev) * 100 : 0;

  // Margem (se custo_total existir)
  const custoMes  = pedMesAtual.reduce((s, p) => s + Number(p.custo_total || 0), 0);
  const margemMes = faturMes > 0 ? ((faturMes - custoMes) / faturMes) * 100 : 0;

  // Ticket médio
  const ticketMes = pedMesAtual.length > 0 ? faturMes / pedMesAtual.length : 0;

  // Clientes únicos no mês
  const clientesMes = new Set(pedMesAtual.map(p => p.cliente_id).filter(Boolean)).size;

  // Evolução últimos 12 meses
  const evolucao = useMemo(() => {
    const map = new Map<string, { fat: number; qtd: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtual - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, { fat: 0, qtd: 0 });
    }
    pedAtivos.forEach(p => {
      const d = new Date(p.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (map.has(k)) {
        const cur = map.get(k)!;
        cur.fat += Number(p.total || 0);
        cur.qtd += 1;
      }
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      mes: k.slice(5) + "/" + k.slice(2, 4),
      faturamento: v.fat,
      pedidos: v.qtd,
    }));
  }, [pedAtivos]);

  // Por regional
  const porRegional = useMemo(() => {
    const map = new Map<string, number>();
    pedYTD.forEach(p => {
      const k = p.regional_id ?? "_sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, value]) => ({
      name: id === "_sem" ? "Sem regional" : regionais.find(r => r.id === id)?.nome ?? "—",
      value,
    })).sort((a, b) => b.value - a.value);
  }, [pedYTD, regionais]);

  // Top representantes
  const topRep = useMemo(() => {
    const map = new Map<string, number>();
    pedYTD.forEach(p => {
      const k = p.representante_id ?? "_sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, total]) => {
      const r = representantes.find(r => r.id === id);
      const c = colaboradores.find(c => c.id === id || c.user_id === id);
      const meta = Number(c?.meta_mensal ?? 0) * (mesAtual + 1);
      return { nome: r?.nome ?? "—", total, meta, pct: pct(total, meta) };
    }).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [pedYTD, representantes, colaboradores]);

  // Alertas críticos
  const alertas = useMemo(() => {
    const list: { label: string; tipo: "error" | "warn" }[] = [];
    const urgentes = pedidos.filter(p => p.status === "rascunho").length;
    if (urgentes > 5) list.push({ label: `${urgentes} pedidos em rascunho aguardando aprovação`, tipo: "warn" });
    const rdvPend = rdvs.filter(r => r.status === "enviado").length;
    if (rdvPend > 0) list.push({ label: `${rdvPend} RDV(s) aguardando revisão`, tipo: "warn" });
    if (deltaMes < -20) list.push({ label: `Queda de ${Math.abs(deltaMes).toFixed(0)}% no faturamento vs mês anterior`, tipo: "error" });
    if (pctYTD < 70) list.push({ label: `Meta YTD em ${pctYTD.toFixed(0)}% — abaixo de 70%`, tipo: "error" });
    return list;
  }, [pedidos, rdvs, deltaMes, pctYTD]);

  // Exportar CSV
  const exportarCSV = () => {
    const header = ["Mês", "Faturamento", "Pedidos"];
    const rows = evolucao.map(e => [e.mes, e.faturamento.toFixed(2), e.pedidos]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "relatorio-diretoria.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Painel da Diretoria"
        description="Visão estratégica consolidada — desempenho, metas e alertas"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-6">

        <p className="text-xs text-muted-foreground">
          Última atualização: {lastRefresh.toLocaleString("pt-BR")}
        </p>

        {/* Alertas críticos */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${a.tipo === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {a.label}
              </div>
            ))}
          </div>
        )}

        {/* KPIs principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={DollarSign}   label="Faturamento mês"     value={BRL(faturMes)}    delta={deltaMes}  accent="text-primary" />
          <Kpi icon={TrendingUp}   label="Faturamento YTD"     value={BRL(faturYTD)}    sub={`${pctYTD.toFixed(0)}% da meta`} />
          <Kpi icon={ShoppingCart} label="Pedidos no mês"      value={fmt0(pedMesAtual.length)} sub={`${pedidos.filter(p => p.status === "cancelado" && new Date(p.created_at).getMonth() === mesAtual).length} cancelados`} />
          <Kpi icon={Users}        label="Clientes ativos/mês" value={fmt0(clientesMes)} />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <Kpi icon={BarChart3} label="Ticket médio"   value={BRL(ticketMes)} />
          <Kpi icon={Target}    label="Margem bruta"   value={`${margemMes.toFixed(1)}%`} accent={margemMes >= 30 ? "text-emerald-600" : margemMes >= 15 ? "text-amber-600" : "text-red-500"} />
          <Kpi icon={Award}     label="Meta YTD"       value={`${pctYTD.toFixed(0)}%`}  sub={`${BRL(faturYTD)} / ${BRL(metaYTD)}`} accent={pctYTD >= 100 ? "text-emerald-600" : pctYTD >= 70 ? "text-amber-600" : "text-red-500"} />
        </div>

        {/* Barra de progresso YTD */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso YTD vs Meta acumulada</span>
              <Badge variant={pctYTD >= 100 ? "default" : "outline"} className={pctYTD >= 100 ? "bg-emerald-600" : pctYTD >= 70 ? "border-amber-400 text-amber-700" : "border-red-400 text-red-600"}>
                {pctYTD.toFixed(1)}%
              </Badge>
            </div>
            <Progress value={Math.min(100, pctYTD)} className={`h-3 ${pctYTD >= 100 ? "[&>div]:bg-emerald-500" : pctYTD >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{BRL(faturYTD)} realizado</span>
              <span>{BRL(metaYTD)} meta</span>
            </div>
          </CardContent>
        </Card>

        {/* Evolução 12 meses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Evolução — últimos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={evolucao}>
                <defs>
                  <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => BRL(v)} />
                <Area type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" fill="url(#gradFat)" strokeWidth={2} name="Faturamento" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Regional + Representantes */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento por regional — YTD</CardTitle>
            </CardHeader>
            <CardContent>
              {porRegional.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {porRegional.map((r, i) => {
                    const p = pct(r.value, faturYTD);
                    return (
                      <div key={r.name}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="truncate max-w-[140px]">{r.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{BRL(r.value)}</span>
                            <span className="text-xs text-muted-foreground">{p.toFixed(0)}%</span>
                          </div>
                        </div>
                        <Progress value={p} className="h-1.5" style={{ ["--progress-color" as string]: COLORS[i % COLORS.length] }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top representantes — YTD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topRep.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>
              ) : topRep.map((r, i) => (
                <div key={r.nome} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-50 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{r.nome}</span>
                      <span className="text-xs font-mono ml-2">{BRL(r.total)}</span>
                    </div>
                    {r.meta > 0 && (
                      <>
                        <Progress value={Math.min(100, r.pct)} className={`h-1 mt-0.5 ${r.pct >= 100 ? "[&>div]:bg-green-500" : r.pct >= 70 ? "[&>div]:bg-amber-500" : ""}`} />
                        <span className="text-[10px] text-muted-foreground">{r.pct.toFixed(0)}% da meta YTD</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Pedidos por mês (barras) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Volume de pedidos — últimos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={10} />
                <YAxis fontSize={10} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {loading && <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>}
      </div>
    </>
  );
}
