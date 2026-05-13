import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShoppingCart, Users, Package, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";

interface Pedido { id: string; cliente_id: string | null; representante_id: string | null; regional_id: string | null; total: number; status: string; created_at: string; }
interface PedItem { id: string; pedido_id: string; produto_id: string; quantidade: number; subtotal: number; }
interface Cliente { id: string; razao_social: string; }
interface Repr { id: string; nome: string; }
interface Reg { id: string; nome: string; }
interface Prod { id: string; nome: string; }

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4"];

export default function DashboardComercial() {
  const { data: pedidos, loading } = useOrgTable<Pedido>("nutrir_pedidos", { orderBy: "created_at" });
  const { data: itens } = useOrgTable<PedItem>("nutrir_pedido_itens");
  const { data: clientes } = useOrgTable<Cliente>("nutrir_clientes", { select: "id,razao_social" });
  const { data: representantes } = useOrgTable<Repr>("nutrir_representantes", { select: "id,nome" });
  const { data: regionais } = useOrgTable<Reg>("nutrir_regionais", { select: "id,nome" });
  const { data: produtos } = useOrgTable<Prod>("nutrir_produtos", { select: "id,nome" });

  const stats = useMemo(() => {
    const ativos = pedidos.filter(p => p.status !== "cancelado");
    const totalVendas = ativos.reduce((s, p) => s + Number(p.total || 0), 0);
    const ticket = ativos.length ? totalVendas / ativos.length : 0;
    const clientesUnicos = new Set(ativos.map(p => p.cliente_id).filter(Boolean)).size;
    return { totalVendas, qtd: ativos.length, ticket, clientesUnicos };
  }, [pedidos]);

  const porRepresentante = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      const k = p.representante_id ?? "sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, total]) => ({
      nome: id === "sem" ? "Sem repr." : representantes.find(r => r.id === id)?.nome ?? "—",
      total,
    })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [pedidos, representantes]);

  const porRegional = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      const k = p.regional_id ?? "sem";
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, total]) => ({
      name: id === "sem" ? "Sem regional" : regionais.find(r => r.id === id)?.nome ?? "—",
      value: total,
    }));
  }, [pedidos, regionais]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { qtd: number; total: number }>();
    itens.forEach(it => {
      const cur = map.get(it.produto_id) ?? { qtd: 0, total: 0 };
      cur.qtd += Number(it.quantidade || 0);
      cur.total += Number(it.subtotal || 0);
      map.set(it.produto_id, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      nome: produtos.find(p => p.id === id)?.nome ?? "—", ...v,
    })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [itens, produtos]);

  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      if (!p.cliente_id) return;
      map.set(p.cliente_id, (map.get(p.cliente_id) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).map(([id, total]) => ({
      nome: clientes.find(c => c.id === id)?.razao_social ?? "—", total,
    })).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [pedidos, clientes]);

  const porMes = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.filter(p => p.status !== "cancelado").forEach(p => {
      const d = new Date(p.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, (map.get(k) ?? 0) + Number(p.total || 0));
    });
    return Array.from(map.entries()).sort().map(([k, total]) => ({
      mes: k.slice(5) + "/" + k.slice(2, 4), total,
    }));
  }, [pedidos]);

  return (
    <>
      <PageHeader title="Dashboard Comercial" description="Visão consolidada de vendas Nutrir"/>
      <div className="p-4 md:p-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={TrendingUp} label="Faturamento" value={formatBRL(stats.totalVendas)} accent="text-primary"/>
          <Kpi icon={ShoppingCart} label="Pedidos" value={String(stats.qtd)}/>
          <Kpi icon={BarChart3} label="Ticket médio" value={formatBRL(stats.ticket)}/>
          <Kpi icon={Users} label="Clientes ativos" value={String(stats.clientesUnicos)}/>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4"/>Vendas por mês</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                <XAxis dataKey="mes" fontSize={11}/>
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={(v: number) => formatBRL(v)}/>
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4"/>Vendas por regional</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porRegional} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {porRegional.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4"/>Top representantes</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, porRepresentante.length * 32)}>
            <BarChart data={porRepresentante} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
              <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}/>
              <YAxis type="category" dataKey="nome" width={130} fontSize={11}/>
              <Tooltip formatter={(v: number) => formatBRL(v)}/>
              <Bar dataKey="total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4"/>Top produtos</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs"><th className="text-left py-1">Produto</th><th className="text-right py-1">Qtd</th><th className="text-right py-1">Total</th></tr></thead>
              <tbody>
                {topProdutos.length === 0 ? <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Sem dados</td></tr>
                : topProdutos.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1.5 font-medium">{p.nome}</td>
                    <td className="py-1.5 text-right">{p.qtd.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-mono">{formatBRL(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4"/>Top clientes</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs"><th className="text-left py-1">Cliente</th><th className="text-right py-1">Total</th></tr></thead>
              <tbody>
                {topClientes.length === 0 ? <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">Sem dados</td></tr>
                : topClientes.map((c, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1.5 font-medium">{c.nome}</td>
                    <td className="py-1.5 text-right font-mono">{formatBRL(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {loading && <p className="text-sm text-muted-foreground text-center">Carregando…</p>}
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground"/>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}
