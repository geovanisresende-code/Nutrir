import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, DollarSign, AlertCircle, TestTube, Trophy, ShoppingCart,
  Receipt, MapPin, ArrowRight, Calculator, Users, FileText, Brain,
  Sprout, Map, TrendingUp, FlaskConical,
} from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Kpis {
  visitasMes: number;
  comissaoPrevista: number;
  contasVencendo: number;
  contasVencendoValor: number;
  testesAtivos: number;
  pedidosMes: number;
  pedidosValorMes: number;
  ranking: { posicao: number; total: number } | null;
}

/* ── Módulos do representante ──────────────────────────── */
const MODULOS = [
  {
    label: "Meus Clientes",
    icon: Users,
    to: "/app/rep/clientes",
    gradient: "from-blue-500 to-blue-700",
    shadow: "shadow-blue-300/50",
    desc: "Carteira e contatos",
  },
  {
    label: "Visitas",
    icon: ClipboardList,
    to: "/app/rep/visitas",
    gradient: "from-emerald-500 to-emerald-700",
    shadow: "shadow-emerald-300/50",
    desc: "Registrar e histórico",
  },
  {
    label: "RDV",
    icon: Receipt,
    to: "/app/rep/rdv",
    gradient: "from-orange-500 to-orange-700",
    shadow: "shadow-orange-300/50",
    desc: "Despesas e reembolsos",
    badge: "★",
  },
  {
    label: "Pedidos",
    icon: ShoppingCart,
    to: "/app/rep/pedidos",
    gradient: "from-violet-500 to-violet-700",
    shadow: "shadow-violet-300/50",
    desc: "Cotar e acompanhar",
  },
  {
    label: "Calculadora Nutrir",
    icon: Calculator,
    to: "/app/nutrir",
    gradient: "from-green-600 to-teal-700",
    shadow: "shadow-green-300/50",
    desc: "N180, N32, NPK",
    badge: "core",
  },
  {
    label: "Programa Nutrir",
    icon: Sprout,
    to: "/app/nutrir/orcamento",
    gradient: "from-lime-600 to-green-700",
    shadow: "shadow-lime-300/50",
    desc: "Orçamentos e receitas",
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    to: "/app/rep/financeiro",
    gradient: "from-yellow-500 to-amber-600",
    shadow: "shadow-yellow-300/50",
    desc: "Comissões e contas",
  },
  {
    label: "Campos de Teste",
    icon: TestTube,
    to: "/app/rep/campos-teste",
    gradient: "from-cyan-500 to-cyan-700",
    shadow: "shadow-cyan-300/50",
    desc: "Ensaios e acompanhar",
  },
  {
    label: "Talhões / GPS",
    icon: Map,
    to: "/app/rep/talhoes",
    gradient: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-300/50",
    desc: "Mapas e propriedades",
  },
  {
    label: "IA Agronômica",
    icon: Brain,
    to: "/app/ia/solo",
    gradient: "from-purple-600 to-indigo-700",
    shadow: "shadow-purple-300/50",
    desc: "Análise de solo e IA",
  },
  {
    label: "Produtos",
    icon: FlaskConical,
    to: "/app/nutrir/produtos",
    gradient: "from-rose-500 to-pink-700",
    shadow: "shadow-rose-300/50",
    desc: "Catálogo Nutrir",
  },
  {
    label: "Relatórios",
    icon: FileText,
    to: "/app/relatorios",
    gradient: "from-slate-500 to-slate-700",
    shadow: "shadow-slate-300/50",
    desc: "Exportar e histórico",
  },
];

export default function DashboardRep() {
  const { user } = useAuth();
  const { current: org } = useOrg();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [proximasVisitas, setProximasVisitas] = useState<any[]>([]);
  const [contasUrgentes, setContasUrgentes] = useState<any[]>([]);

  const inicioMes = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const em15dias = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!org || !user) return;
    (async () => {
      setLoading(true);
      try {

        // Representante
        const { data: rep } = await supabase
          .from("nutrir_representantes")
          .select("id")
          .eq("organization_id", org.id)
          .eq("user_id", user.id)
          .maybeSingle();
        const repId = rep?.id ?? null;

        // Visitas — tabela core, existe
        const { count: visitasMes } = await supabase
          .from("nutrir_visitas")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org.id)
          .eq("user_id", user.id)
          .gte("data_visita", inicioMes);

        // Comissões — tabela pode não existir ainda
        let comissaoPrevista = 0;
        try {
          const { data: comissoes } = await supabase
            .from("nutrir_comissoes")
            .select("valor")
            .eq("organization_id", org.id)
            .eq("user_id", user.id)
            .gte("mes_referencia", inicioMes);
          comissaoPrevista = (comissoes ?? []).reduce((s, c: any) => s + Number(c.valor || 0), 0);
        } catch { /* tabela não existe ainda */ }

        // Contas a receber — tabela pode não existir ainda
        let contas: any[] = [];
        let contasVencendoValor = 0;
        try {
          const { data: c } = await supabase
            .from("nutrir_contas_receber")
            .select("id,valor,data_vencimento,status,nutrir_clientes(razao_social)")
            .eq("organization_id", org.id)
            .in("status", ["aberto", "vencendo"])
            .lte("data_vencimento", em15dias)
            .order("data_vencimento");
          contas = c ?? [];
          contasVencendoValor = contas.reduce((s, c: any) => s + Number(c.valor || 0), 0);
        } catch { /* tabela não existe ainda */ }

        // Campos de teste — tabela pode não existir ainda
        let testesAtivos = 0;
        try {
          const { count } = await supabase
            .from("nutrir_campos_teste")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id)
            .eq("user_id", user.id)
            .eq("status", "ativo");
          testesAtivos = count ?? 0;
        } catch { /* tabela não existe ainda */ }

        // Pedidos — tabela pode não existir ainda
        let pedidosMes = 0;
        let pedidosValorMes = 0;
        let ranking: { posicao: number; total: number } | null = null;
        try {
          const { data: pedidos } = await supabase
            .from("nutrir_pedidos")
            .select("id,valor_total")
            .eq("organization_id", org.id)
            .eq("user_id", user.id)
            .gte("created_at", inicioMes);
          pedidosMes = (pedidos ?? []).length;
          pedidosValorMes = (pedidos ?? []).reduce((s, p: any) => s + Number(p.valor_total || 0), 0);

          if (repId) {
            const { data: todos } = await supabase
              .from("nutrir_pedidos")
              .select("user_id,valor_total")
              .eq("organization_id", org.id)
              .gte("created_at", inicioMes);
            if (todos && todos.length > 0) {
              const map = new Map<string, number>();
              todos.forEach((r: any) => {
                if (!r.user_id) return;
                map.set(r.user_id, (map.get(r.user_id) || 0) + Number(r.valor_total || 0));
              });
              const ord = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
              const pos = ord.findIndex(([id]) => id === user.id);
              if (pos >= 0) ranking = { posicao: pos + 1, total: ord.length };
            }
          }
        } catch { /* tabela não existe ainda */ }

        // Clientes e visitas — tabelas core
        const { data: clientes } = await supabase
          .from("nutrir_clientes")
          .select("id,razao_social,cidade,uf")
          .eq("organization_id", org.id)
          .eq("ativo", true)
          .limit(50);
        const { data: vAll } = await supabase
          .from("nutrir_visitas")
          .select("cliente_id,data_visita")
          .eq("organization_id", org.id)
          .eq("user_id", user.id)
          .order("data_visita", { ascending: false });
        const ultima = new Map<string, string>();
        (vAll ?? []).forEach((v: any) => {
          if (v.cliente_id && !ultima.has(v.cliente_id)) ultima.set(v.cliente_id, v.data_visita);
        });
        const sugeridas = (clientes ?? [])
          .map((c: any) => ({ ...c, ultima: ultima.get(c.id) ?? null }))
          .sort((a, b) => (a.ultima ?? "0").localeCompare(b.ultima ?? "0"))
          .slice(0, 5);

        setKpis({
          visitasMes: visitasMes ?? 0,
          comissaoPrevista,
          contasVencendo: contas.length,
          contasVencendoValor,
          testesAtivos,
          pedidosMes,
          pedidosValorMes,
          ranking,
        });
        setProximasVisitas(sugeridas);
        setContasUrgentes(contas);

      } catch (err) {
        console.error("[DashboardRep]", err);
        // Mesmo com erro geral, mostra dashboard com zeros
        setKpis({ visitasMes: 0, comissaoPrevista: 0, contasVencendo: 0, contasVencendoValor: 0, testesAtivos: 0, pedidosMes: 0, pedidosValorMes: 0, ranking: null });
      } finally {
        setLoading(false);
      }
    })();
  }, [org, user, inicioMes, em15dias]);

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Saudação */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          {saudacao()}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPIs compactos */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <KpiChip icon={ClipboardList} label="Visitas"   value={String(kpis.visitasMes)}   color="text-emerald-600" />
        <KpiChip icon={ShoppingCart}  label="Pedidos"   value={String(kpis.pedidosMes)}   color="text-violet-600" />
        <KpiChip icon={DollarSign}    label="Comissão"  value={fmtBRL(kpis.comissaoPrevista)} color="text-amber-600" />
        <KpiChip icon={AlertCircle}   label="A vencer"  value={String(kpis.contasVencendo)} color="text-red-500" />
        <KpiChip icon={TestTube}      label="Testes"    value={String(kpis.testesAtivos)}  color="text-cyan-600" />
        <KpiChip icon={TrendingUp}    label="Ranking"   value={kpis.ranking ? `${kpis.ranking.posicao}º` : "—"} color="text-primary" />
      </div>

      {/* ── GRID DE MÓDULOS ───────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Módulos
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {MODULOS.map((m) => (
            <button
              key={m.to}
              onClick={() => navigate(m.to)}
              className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border hover:border-transparent transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)";
              }}
            >
              {/* Ícone com gradiente */}
              <div className={`bg-gradient-to-br ${m.gradient} rounded-xl p-3 shadow-lg ${m.shadow}`}>
                <m.icon className="h-6 w-6 text-white" strokeWidth={1.8} />
              </div>

              {/* Label */}
              <span className="text-[11px] font-semibold text-center text-foreground leading-tight">
                {m.label}
              </span>

              {/* Badge opcional */}
              {m.badge && (
                <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full leading-none">
                  {m.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas e sugestões */}
      {(kpis.contasVencendo > 0 || proximasVisitas.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {proximasVisitas.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" /> Visitas sugeridas
                </CardTitle>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <Link to="/app/rep/visitas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {proximasVisitas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                    <div>
                      <div className="font-medium text-sm">{c.razao_social}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "—"} ·{" "}
                        {c.ultima
                          ? `Última visita ${new Date(c.ultima).toLocaleDateString("pt-BR")}`
                          : "Sem visitas"}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Sugerido</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {kpis.contasVencendo > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" /> Contas a vencer (15 dias)
                </CardTitle>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <Link to="/app/rep/contas-receber">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {contasUrgentes.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                    <div>
                      <div className="font-medium text-sm">
                        {c.nutrir_clientes?.razao_social ?? "Cliente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Vence {new Date(c.data_vencimento).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <Badge
                      variant={c.status === "vencendo" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {fmtBRL(Number(c.valor))}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function KpiChip({
  icon: Icon, label, value, color,
}: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 flex flex-col items-center text-center gap-0.5">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      <div className="text-sm font-bold leading-tight truncate w-full text-center">{value}</div>
    </div>
  );
}
