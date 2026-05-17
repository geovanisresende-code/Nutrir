import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import {
  TrendingUp, ShoppingCart, Users, Package, BarChart3, Receipt, Target,
  CheckCircle2, Clock, AlertTriangle, TrendingDown, Award, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

// ─── helpers ──────────────────────────────────────────────────────────────────
const BRL = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt0 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const COLORS = ["hsl(var(--primary))", "#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4", "#f97316"];

const RDV_LABEL: Record<string, string> = {
  combustivel: "Combustível", alimentacao: "Alimentação", hospedagem: "Hospedagem",
  pedagio: "Pedágio", manutencao: "Manutenção", estacionamento: "Estacionamento", outros: "Outros",
};

type Periodo = "mes" | "trimestre" | "ano" | "tudo";
function periodoRange(p: Periodo): Date {
  const d = new Date();
  if (p === "mes")      { return new Date(d.getFullYear(), d.getMonth(), 1); }
  if (p === "trimestre"){ return new Date(d.getFullYear(), d.getMonth() - 2, 1); }
  if (p === "ano")      { return new Date(d.getFullYear(), 0, 1); }
  return new Date(2000, 0, 1);
}

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: string; sub?: string; accent?: string;
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
      </CardContent>
    </Card>
  );
}

// ─── Status visual do funil ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  rascunho:   { label: "Rascunho",   color: "text-muted-foreground", bg: "bg-muted" },
  confirmado: { label: "Confirmado", color: "text-blue-700",         bg: "bg-blue-50" },
  aprovado:   { label: "Aprovado",   color: "text-green-700",        bg: "bg-green-50" },
  faturado:   { label: "Faturado",   color: "text-emerald-700",      bg: "bg-emerald-50" },
  cancelado:  { label: "Cancelado",  color: "text-red-700",          bg: "bg-red-50" },
};

export default function DashboardComercial() {
  const { current } = useOrg();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pedItens, setPedItens] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [representantes, setRepresentantes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [regionais, setRegionais] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [rdvs, setRdvs] = useState<any[]>([]);
  const [pendencias, setPendencias] = useState({ orcamentos: 0, rdv: 0, pedidos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    Promise.all([
      supabase.from("nutrir_pedidos" as any).select("id,cliente_id,representante_id,regional_id,total,status,created_at,numero").eq("organization_id", current.id).order("created_at"),
      supabase.from("nutrir_pedido_itens" as any).select("id,pedido_id,produto_id,quantidade,subtotal").eq("organization_id", current.id),
      supabase.from("nutrir_clientes" as any).select("id,razao_social").eq("organization_id", current.id),
      supabase.from("nutrir_representantes" as any).select("id,nome").eq("organization_id", current.id),
      supabase.from("nutrir_colaboradores" as any).select("id,nome,user_id,meta_mensal,bonus_meta_pct,regional_id").eq("organization_id", current.id),
      supabase.from("nutrir_regionais" as any).select("id,nome").eq("organization_id", current.id),
      supabase.from("nutrir_produtos" as any).select("id,nome").eq("organization_id", current.id),
      supabase.from("nutrir_rdv" as any).select("id,categoria,valor,data,status").eq("organization_id", current.id),
      // pendências
      (supabase as any).from("nutrir_orcamentos").select("id", { count: "exact", head: true }).eq("organization_id", current.id).eq("status", "rascunho"),
      (supabase as any).from("nutrir_rdv").select("id", { count: "exact", head: true }).eq("organization_id", current.id).eq("status", "enviado"),
      (supabase as any).from("nutrir_pedidos").select("id", { count: "exact", head: true }).eq("organization_id", current.id).eq("status", "rascunho"),
    ]).then(([ped, pei, cli, rep, col, reg, pro, rdv, orc, rdvp, pedp]) => {
      setPedidos((ped.data as any[]) ?? []);
      setPedItens((pei.data as any[]) ?? []);
      setClientes((cli.data as any[]) ?? []);
      setRepresentantes((rep.data as any[]) ?? []);
      setColaboradores((col.data as any[]) ?? []);
      setRegionais((reg.data as any[]) ?? []);
      setProdutos((pro.data as any[]) ?? []);
      setRdvs((rdv.data as any[]) ?? []);
      setPendencias({ orcamentos: orc.count ?? 0, rdv: rdvp.count ?? 0, pedidos: pedp.count ?? 0 });
      setLoading(false);
    });
  }, [current?.id]);

  // Filtro por período
  const corte = periodoRange(periodo);
  const pedFiltrados = useMemo(() =>
    pedidos.filter(p => new Date(p.created_at) >= corte),
    [pedidos, periodo]
  );
  const pedAtivos = useMemo(() => pedFiltrados.filter(p => p.status !== "cancelado"), [pedFiltrados]);

  // KPIs
  const kpis = useMemo(() => {
    const faturamento = pedAtivos.reduce((s, p) => s + Number(p.total || 0), 0);
    const ticket = pedAtivos.length ? faturamento / pedAtivos.length : 0;
    const clientesUnicos = new Set(pedAtivos.map(p => p.cliente_id).filter(Boolean)).size;
    return { faturamento, qtd: pedAtivos.length, ticket, clientesUnicos };
  }, [pedAtivos]);

  // Funil por status
  const funil = useMemo(() => {
    const statusOrder = ["rascunho", "confirmado", "aprovado", "faturado", "cancelado"];
    const map = new Map<string, { count: number; total: number }>();
    pedFiltrados.forEach(p => {
      const cur = map.get(p.status) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.total || 0);
      map.set(p.status, cur);
    });
    return statusOrder.map(s => ({ status: s, ...(map.get(s) ?? { count: 0, total: 0 }) }));
  }, [pedFiltrados]);

  // Ranking por representante com meta
  const rankingRep = useMemo(() => {
    const map = new Map<string, number>();
    pedAtivos.forEach(p => {
      const k = p.representante_id ?? "_sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([reprId, total]) => {
      const rep = representantes.find(r => r.id === reprId);
      const col = colaboradores.find(c => c.user_id === reprId || c.id === reprId);
      const meta = Number(col?.meta_mensal ?? 0);
      const pct = meta > 0 ? Math.min(100, (total / meta) * 100) : 0;
      return { id: reprId, nome: reprId === "_sem" ? "Sem representante" : rep?.nome ?? "—", total, meta, pct };
    }).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [pedAtivos, representantes, colaboradores]);

  // Vendas por mês (linha)
  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    pedAtivos.forEach(p => {
      const d = new Date(p.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).sort().map(([k, total]) => ({
      mes: k.slice(5) + "/" + k.slice(2, 4), total,
    }));
  }, [pedAtivos]);

  // Por regional
  const porRegional = useMemo(() => {
    const map = new Map<string, number>();
    pedAtivos.forEach(p => {
      const k = p.regional_id ?? "_sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, value]) => ({
      name: id === "_sem" ? "Sem regional" : regionais.find(r => r.id === id)?.nome ?? "—", value,
    })).sort((a, b) => b.value - a.value);
  }, [pedAtivos, regionais]);

  // Top produtos
  const topProdutos = useMemo(() => {
    const pedIds = new Set(pedAtivos.map(p => p.id));
    const map = new Map<string, { qtd: number; total: number }>();
    pedItens.filter(it => pedIds.has(it.pedido_id)).forEach(it => {
      const cur = map.get(it.produto_id) ?? { qtd: 0, total: 0 };
      cur.qtd += Number(it.quantidade || 0);
      cur.total += Number(it.subtotal || 0);
      map.set(it.produto_id, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      nome: produtos.find(p => p.id === id)?.nome ?? "—", ...v,
    })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [pedAtivos, pedItens, produtos]);

  // Top clientes
  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    pedAtivos.forEach(p => {
      if (!p.cliente_id) return;
      map.set(p.cliente_id, (map.get(p.cliente_id) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, total]) => ({
      nome: clientes.find(c => c.id === id)?.razao_social ?? "—", total,
    })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [pedAtivos, clientes]);

  // RDV por categoria (período)
  const rdvPorCat = useMemo(() => {
    const map = new Map<string, number>();
    rdvs.filter(r => r.data && new Date(r.data) >= corte).forEach(r => {
      const k = r.categoria ?? "outros";
      map.set(k, (map.get(k) ?? 0) + Number(r.valor || 0));
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      name: RDV_LABEL[k] ?? k, value: v,
    })).sort((a, b) => b.value - a.value);
  }, [rdvs, periodo]);

  const totalPendencias = pendencias.orcamentos + pendencias.rdv + pendencias.pedidos;
  const PERIODO_LABEL: Record<Periodo, string> = {
    mes: "Mês atual", trimestre: "Últimos 3 meses", ano: "Ano atual", tudo: "Todo período",
  };

  return (
    <>
      <PageHeader
        title="Painel Gerente"
        description="Dashboard comercial — vendas, metas, equipe e aprovações"
        actions={
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(PERIODO_LABEL) as [Periodo, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="p-4 md:p-6 space-y-5">

        {/* Alertas de pendências */}
        {totalPendencias > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendencias.orcamentos > 0 && (
              <Link to="/app/gerente/aprovacoes">
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 gap-1.5 py-1 px-3 cursor-pointer hover:bg-amber-100">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {pendencias.orcamentos} orçamento{pendencias.orcamentos > 1 ? "s" : ""} aguardando
                </Badge>
              </Link>
            )}
            {pendencias.rdv > 0 && (
              <Link to="/app/gerente/aprovacoes">
                <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 gap-1.5 py-1 px-3 cursor-pointer hover:bg-blue-100">
                  <Receipt className="w-3.5 h-3.5" />
                  {pendencias.rdv} RDV{pendencias.rdv > 1 ? "s" : ""} para revisar
                </Badge>
              </Link>
            )}
            {pendencias.pedidos > 0 && (
              <Link to="/app/gerente/aprovacoes">
                <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 gap-1.5 py-1 px-3 cursor-pointer hover:bg-green-100">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {pendencias.pedidos} pedido{pendencias.pedidos > 1 ? "s" : ""} pendente{pendencias.pedidos > 1 ? "s" : ""}
                </Badge>
              </Link>
            )}
          </div>
        )}

        {/* KPIs principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={TrendingUp}   label="Faturamento"   value={BRL(kpis.faturamento)} accent="text-primary" />
          <KpiCard icon={ShoppingCart} label="Pedidos ativos" value={fmt0(kpis.qtd)} sub={PERIODO_LABEL[periodo]} />
          <KpiCard icon={BarChart3}    label="Ticket médio"  value={BRL(kpis.ticket)} />
          <KpiCard icon={Users}        label="Clientes"       value={fmt0(kpis.clientesUnicos)} sub="no período" />
        </div>

        {/* Funil de pedidos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Funil de pedidos — {PERIODO_LABEL[periodo]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI chips por status */}
            <div className="flex flex-wrap gap-3">
              {funil.map(f => {
                const cfg = STATUS_CONFIG[f.status] ?? { label: f.status, color: "", bg: "bg-muted" };
                return (
                  <div key={f.status} className={`flex-1 min-w-[110px] rounded-lg border p-3 ${f.count === 0 ? "opacity-40" : ""}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${cfg.color}`}>{cfg.label}</div>
                    <div className="text-xl font-bold">{f.count}</div>
                    <div className="text-xs text-muted-foreground">{BRL(f.total)}</div>
                  </div>
                );
              })}
            </div>

            {/* Gráfico de funil — barras horizontais por quantidade e valor */}
            {pedFiltrados.length > 0 && (() => {
              const FUNIL_COLORS: Record<string, string> = {
                rascunho:   "#94a3b8",
                confirmado: "#3b82f6",
                aprovado:   "#22c55e",
                faturado:   "#10b981",
                cancelado:  "#ef4444",
              };
              const chartData = funil.filter(f => f.count > 0).map(f => ({
                name: STATUS_CONFIG[f.status]?.label ?? f.status,
                qtd: f.count,
                valor: f.total,
                fill: FUNIL_COLORS[f.status] ?? "#94a3b8",
              }));
              const maxQtd = Math.max(...chartData.map(d => d.qtd), 1);
              return (
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-2">Quantidade de pedidos por etapa</div>
                  <div className="space-y-2">
                    {chartData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-24 text-xs text-right text-muted-foreground shrink-0">{d.name}</div>
                        <div className="flex-1 h-7 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ width: `${Math.max(8, (d.qtd / maxQtd) * 100)}%`, background: d.fill }}
                          >
                            <span className="text-[11px] font-bold text-white">{d.qtd}</span>
                          </div>
                        </div>
                        <div className="w-28 text-xs font-mono text-muted-foreground shrink-0">{BRL(d.valor)}</div>
                      </div>
                    ))}
                  </div>
                  {/* Taxa de conversão rascunho → faturado */}
                  {(() => {
                    const rascunho = funil.find(f => f.status === "rascunho")?.count ?? 0;
                    const faturado = funil.find(f => f.status === "faturado")?.count ?? 0;
                    const total = pedFiltrados.length;
                    const cancelado = funil.find(f => f.status === "cancelado")?.count ?? 0;
                    const taxa = total > 0 ? ((faturado / (total - cancelado || 1)) * 100) : 0;
                    return total > 0 ? (
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Total no período: <strong className="text-foreground">{total}</strong></span>
                        <span>Faturados: <strong className="text-emerald-700">{faturado}</strong></span>
                        <span>Cancelados: <strong className="text-red-600">{cancelado}</strong></span>
                        <span>Taxa faturamento: <strong className="text-primary">{taxa.toFixed(0)}%</strong></span>
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Gráfico de evolução mensal */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Evolução de vendas</h3>
            {porMes.length < 2 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Dados insuficientes para o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => BRL(v)} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Vendas por regional</h3>
            {porRegional.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porRegional} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={(e) => e.name.slice(0, 12)}>
                    {porRegional.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => BRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Meta por representante */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4" /> Ranking + Meta por representante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rankingRep.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado no período.</p>
            ) : rankingRep.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-50 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium truncate">{r.nome}</span>
                    <span className="text-sm font-mono shrink-0 ml-2">{BRL(r.total)}</span>
                  </div>
                  {r.meta > 0 ? (
                    <>
                      <Progress value={r.pct} className={`h-1.5 ${r.pct >= 100 ? "[&>div]:bg-green-500" : r.pct >= 70 ? "[&>div]:bg-amber-500" : ""}`} />
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.pct.toFixed(0)}% da meta ({BRL(r.meta)})
                        {r.pct >= 100 && <span className="text-green-600 ml-1">✓ Meta batida!</span>}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">Sem meta definida</div>
                  )}
                </div>
              </div>
            ))}
            <Link to="/app/nutrir/representantes">
              <Button variant="ghost" size="sm" className="w-full mt-1 text-xs">
                Ver todos os representantes <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Top produtos + Top clientes */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" />Top produtos</h3>
            {topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, topProdutos.length * 28)}>
                <BarChart data={topProdutos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" width={120} fontSize={10} />
                  <Tooltip formatter={(v: number) => BRL(v)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Top clientes</h3>
            <div className="space-y-2">
              {topClientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              ) : topClientes.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-sm font-medium truncate max-w-[200px]">{c.nome}</span>
                  </div>
                  <span className="text-sm font-mono">{BRL(c.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RDV por categoria */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Despesas RDV por categoria — {PERIODO_LABEL[periodo]}
          </h3>
          {rdvPorCat.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma despesa no período.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={rdvPorCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                    label={(e) => e.name}>
                    {rdvPorCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => BRL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {rdvPorCat.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{r.name}</span>
                    </div>
                    <span className="font-mono text-xs">{BRL(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {loading && <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>}
      </div>
    </>
  );
}
