import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import {
  TrendingUp, ShoppingCart, FileSpreadsheet, Leaf, Briefcase, Package,
  Sprout, PiggyBank, BarChart3, Activity,
} from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

interface Pedido { id: string; total: number; status: string; created_at: string; regional_id: string | null; representante_id: string | null; }
interface Orcamento { id: string; total_geral: number; area_total_ha: number | null; created_at: string; status: string | null; }
interface Foliar { id: string; resultado: any; inputs: any; cultura: string | null; area_ha: number | null; created_at: string; economia_total_rs?: number | null; economia_rs_ha?: number | null; }
interface Cliente { id: string; razao_social: string; }
interface Produto { id: string; nome: string; }
interface Regional { id: string; nome: string; }
interface Representante { id: string; nome: string; regional_id: string | null; }

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4"];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardNutrir() {
  const { data: pedidos, loading: lp } = useOrgTable<Pedido>("nutrir_pedidos", { select: "id,total,status,created_at,regional_id,representante_id", orderBy: "created_at" });
  const { data: orcamentos, loading: lo } = useOrgTable<Orcamento>("nutrir_orcamentos", { select: "id,total_geral,area_total_ha,created_at,status", orderBy: "created_at" });
  const { data: foliares, loading: lf } = useOrgTable<Foliar>("nutrir_foliar_historico", { orderBy: "created_at" });
  const { data: clientes } = useOrgTable<Cliente>("nutrir_clientes", { select: "id,razao_social" });
  const { data: produtos } = useOrgTable<Produto>("nutrir_produtos", { select: "id,nome" });
  const { data: regionais } = useOrgTable<Regional>("nutrir_regionais", { select: "id,nome" });
  const { data: representantes } = useOrgTable<Representante>("nutrir_representantes", { select: "id,nome,regional_id" });

  const loading = lp || lo || lf;

  /* ------- KPIs principais ------- */
  const kpis = useMemo(() => {
    const ativos = pedidos.filter(p => p.status !== "cancelado");
    const faturamento = ativos.reduce((s, p) => s + Number(p.total || 0), 0);
    const ticket = ativos.length ? faturamento / ativos.length : 0;
    const orcTotal = orcamentos.reduce((s, o) => s + Number(o.total_geral || 0), 0);
    const haOrcadosTotal = orcamentos.reduce((s, o) => s + Number(o.area_total_ha || 0), 0);
    const haFoliar = foliares.reduce((s, f) => s + Number(f.area_ha || 0), 0);

    // economia média gerada nos cálculos foliares: compara convencional vs nutrir
    let economiaTotal = 0; let economiaPct = 0; let nComparados = 0;
    foliares.forEach(f => {
      const r = f.resultado;
      const conv = Number(r?.convencional?.custo_total ?? r?.custo_convencional ?? 0);
      const nut = Number(r?.nutrir?.custo_total ?? r?.custo_nutrir ?? 0);
      if (conv > 0 && nut > 0) {
        economiaTotal += (conv - nut);
        economiaPct += ((conv - nut) / conv) * 100;
        nComparados++;
      }
    });
    const economiaMediaPct = nComparados ? economiaPct / nComparados : 0;

    const conversao = orcamentos.length
      ? (orcamentos.filter(o => o.status === "convertido" || o.status === "pedido").length / orcamentos.length) * 100
      : 0;

    return {
      faturamento, ticket, qtdPedidos: ativos.length,
      qtdOrc: orcamentos.length, orcTotal,
      qtdFoliar: foliares.length, haFoliar, haOrcadosTotal,
      economiaTotal, economiaMediaPct, conversao,
    };
  }, [pedidos, orcamentos, foliares]);

  /* ------- série mensal consolidada ------- */
  const serieMensal = useMemo(() => {
    const map = new Map<string, { mes: string; pedidos: number; orcamentos: number; foliares: number }>();
    const touch = (k: string) => {
      if (!map.has(k)) map.set(k, { mes: k, pedidos: 0, orcamentos: 0, foliares: 0 });
      return map.get(k)!;
    };
    pedidos.filter(p => p.status !== "cancelado").forEach(p => { touch(monthKey(p.created_at)).pedidos += Number(p.total || 0); });
    orcamentos.forEach(o => { touch(monthKey(o.created_at)).orcamentos += Number(o.total_geral || 0); });
    foliares.forEach(f => { touch(monthKey(f.created_at)).foliares += 1; });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes))
      .map(r => ({ ...r, mes: r.mes.slice(5) + "/" + r.mes.slice(2, 4) }));
  }, [pedidos, orcamentos, foliares]);

  /* ------- foliares por cultura ------- */
  const porCultura = useMemo(() => {
    const map = new Map<string, number>();
    foliares.forEach(f => {
      const k = f.cultura || "—";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [foliares]);

  /* ------- funil ------- */
  const funil = useMemo(() => ([
    { etapa: "Foliares", qtd: foliares.length },
    { etapa: "Orçamentos", qtd: orcamentos.length },
    { etapa: "Pedidos", qtd: pedidos.filter(p => p.status !== "cancelado").length },
  ]), [foliares, orcamentos, pedidos]);

  /* ------- comparativo por regional ------- */
  const porRegional = useMemo(() => {
    const map = new Map<string, { nome: string; faturamento: number; pedidos: number; ticket: number }>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      const reg = regionais.find(r => r.id === p.regional_id);
      const key = reg?.nome || "Sem regional";
      const cur = map.get(key) ?? { nome: key, faturamento: 0, pedidos: 0, ticket: 0 };
      cur.faturamento += Number(p.total || 0);
      cur.pedidos += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(r => ({ ...r, ticket: r.pedidos ? r.faturamento / r.pedidos : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [pedidos, regionais]);

  /* ------- comparativo por representante (top 8) ------- */
  const porRepresentante = useMemo(() => {
    const map = new Map<string, { nome: string; regional: string; faturamento: number; pedidos: number }>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      const rep = representantes.find(r => r.id === p.representante_id);
      const reg = regionais.find(r => r.id === (rep?.regional_id ?? p.regional_id));
      const key = rep?.nome || "Sem representante";
      const cur = map.get(key) ?? { nome: key, regional: reg?.nome ?? "—", faturamento: 0, pedidos: 0 };
      cur.faturamento += Number(p.total || 0);
      cur.pedidos += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.faturamento - a.faturamento).slice(0, 8);
  }, [pedidos, representantes, regionais]);

  /* ------- economia média por cultura (a partir do histórico foliar) ------- */
  const economiaPorCultura = useMemo(() => {
    const map = new Map<string, { cultura: string; economiaHa: number; n: number }>();
    foliares.forEach(f => {
      const k = f.cultura || "—";
      const ec = Number(f.economia_rs_ha ?? 0);
      if (!ec) return;
      const cur = map.get(k) ?? { cultura: k, economiaHa: 0, n: 0 };
      cur.economiaHa += ec;
      cur.n += 1;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .map(r => ({ cultura: r.cultura, economiaHa: r.n ? r.economiaHa / r.n : 0, amostras: r.n }))
      .sort((a, b) => b.economiaHa - a.economiaHa)
      .slice(0, 8);
  }, [foliares]);

  return (
    <>
      <PageHeader
        title="Dashboard NUTRIR"
        description="Visão consolidada: foliares, orçamentos, pedidos e economia gerada"
      />
      <div className="p-4 md:p-6 space-y-4">
        {/* KPIs - linha 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={TrendingUp} label="Faturamento" value={formatBRL(kpis.faturamento)} accent="text-primary"/>
          <Kpi icon={ShoppingCart} label="Pedidos ativos" value={String(kpis.qtdPedidos)} hint={`Ticket: ${formatBRL(kpis.ticket)}`}/>
          <Kpi icon={FileSpreadsheet} label="Orçamentos" value={String(kpis.qtdOrc)} hint={formatBRL(kpis.orcTotal)}/>
          <Kpi icon={Leaf} label="Cálculos foliares" value={String(kpis.qtdFoliar)} hint={`${kpis.haFoliar.toFixed(1)} ha`}/>
        </div>

        {/* KPIs - linha 2 (impacto) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={PiggyBank} label="Economia gerada" value={formatBRL(kpis.economiaTotal)} accent="text-[#b08826]" hint="Convencional × NUTRIR"/>
          <Kpi icon={Activity} label="Economia média" value={`${kpis.economiaMediaPct.toFixed(1)}%`} accent="text-[#b08826]"/>
          <Kpi icon={Sprout} label="Hectares orçados" value={`${kpis.haOrcadosTotal.toFixed(1)} ha`}/>
          <Kpi icon={BarChart3} label="Conversão orç→pedido" value={`${kpis.conversao.toFixed(0)}%`}/>
        </div>

        {/* Série mensal consolidada */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4"/> Evolução mensal — Pedidos (R$) × Orçamentos (R$) × Cálculos foliares
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={serieMensal}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
              <XAxis dataKey="mes" fontSize={11}/>
              <YAxis yAxisId="r" orientation="left" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
              <YAxis yAxisId="q" orientation="right" fontSize={11}/>
              <Tooltip formatter={(v: number, name) => name === "foliares" ? `${v} cálc.` : formatBRL(v)}/>
              <Legend/>
              <Line yAxisId="r" type="monotone" dataKey="pedidos" stroke="hsl(var(--primary))" strokeWidth={2} name="Pedidos"/>
              <Line yAxisId="r" type="monotone" dataKey="orcamentos" stroke="hsl(var(--accent))" strokeWidth={2} name="Orçamentos"/>
              <Line yAxisId="q" type="monotone" dataKey="foliares" stroke="#22c55e" strokeWidth={2} name="Foliares (qtd)"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Funil */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4"/> Funil consultivo</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funil} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis type="number" fontSize={11}/>
                <YAxis type="category" dataKey="etapa" width={100} fontSize={11}/>
                <Tooltip/>
                <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}/>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Cada etapa mostra a quantidade total registrada — útil para acompanhar a maturidade da operação.
            </p>
          </Card>

          {/* Foliares por cultura */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Leaf className="w-4 h-4"/> Cálculos foliares por cultura</h3>
            {porCultura.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Sem dados de cálculos foliares ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={porCultura} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                    {porCultura.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Comparativo regional */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Faturamento por regional</h3>
            {porRegional.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sem pedidos vinculados a regional ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porRegional} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="nome" width={120} fontSize={11}/>
                  <Tooltip formatter={(v: number, name) => name === "faturamento" ? formatBRL(v) : name === "ticket" ? formatBRL(v) : v}/>
                  <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Faturamento"/>
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              {porRegional.length} regional(is) ativa(s) · ticket médio destacado por região na tabela abaixo.
            </p>
            {porRegional.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b">
                    <tr><th className="text-left py-1">Regional</th><th className="text-right">Pedidos</th><th className="text-right">Faturamento</th><th className="text-right">Ticket</th></tr>
                  </thead>
                  <tbody>
                    {porRegional.map(r => (
                      <tr key={r.nome} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{r.nome}</td>
                        <td className="text-right font-mono">{r.pedidos}</td>
                        <td className="text-right font-mono">{formatBRL(r.faturamento)}</td>
                        <td className="text-right font-mono text-[#b08826]">{formatBRL(r.ticket)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4"/> Top representantes</h3>
            {porRepresentante.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">Sem pedidos vinculados a representante ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porRepresentante} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="nome" width={120} fontSize={11}/>
                  <Tooltip formatter={(v: number) => formatBRL(v)}/>
                  <Bar dataKey="faturamento" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Faturamento"/>
                </BarChart>
              </ResponsiveContainer>
            )}
            {porRepresentante.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Top {porRepresentante.length} por faturamento — regional vinculada exibida no tooltip da tabela do dashboard comercial.
              </p>
            )}
          </Card>
        </div>

        {/* Economia média por cultura */}
        {economiaPorCultura.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><PiggyBank className="w-4 h-4 text-[#b08826]"/> Economia média por cultura (R$/ha)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={economiaPorCultura}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="cultura" fontSize={11}/>
                <YAxis fontSize={11} tickFormatter={(v) => `R$${v.toFixed(0)}`}/>
                <Tooltip formatter={(v: number, name) => name === "economiaHa" ? `${formatBRL(v)}/ha` : v}/>
                <Bar dataKey="economiaHa" fill="#22c55e" radius={[4, 4, 0, 0]} name="Economia média"/>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">
              Calculado a partir do histórico de cálculos foliares · {economiaPorCultura.reduce((s,c)=>s+c.amostras,0)} amostras totais.
            </p>
          </Card>
        )}

        {/* Resumo cadastros */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4"/> Cadastros ativos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Mini label="Clientes" value={String(clientes.length)}/>
            <Mini label="Produtos NUTRIR" value={String(produtos.length)}/>
            <Mini label="Orçamentos no histórico" value={String(orcamentos.length)}/>
            <Mini label="Foliares salvos" value={String(foliares.length)}/>
          </div>
        </Card>

        {loading && <p className="text-sm text-muted-foreground text-center">Carregando dados consolidados…</p>}
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent, hint }: { icon: any; label: string; value: string; accent?: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground"/>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
