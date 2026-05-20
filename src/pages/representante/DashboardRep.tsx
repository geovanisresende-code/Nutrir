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
  Receipt, MapPin, ArrowRight, Calculator, Users, TrendingUp, FileText,
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

      // representante atual
      const { data: rep } = await supabase
        .from("nutrir_representantes")
        .select("id")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .maybeSingle();
      const repId = rep?.id ?? null;

      // visitas no mês
      const { count: visitasMes } = await supabase
        .from("nutrir_visitas")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .gte("data_visita", inicioMes);

      // comissão prevista no mês
      const { data: comissoes } = await supabase
        .from("nutrir_comissoes")
        .select("valor,status")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .gte("mes_referencia", inicioMes);
      const comissaoPrevista = (comissoes ?? []).reduce(
        (s, c: any) => s + Number(c.valor || 0),
        0,
      );

      // contas vencendo em 15 dias (do representante)
      let contasQ = supabase
        .from("nutrir_contas_receber")
        .select("id,valor,data_vencimento,status,cliente_id,nutrir_clientes(razao_social)")
        .eq("organization_id", org.id)
        .in("status", ["em_aberto", "vencendo"])
        .lte("data_vencimento", em15dias)
        .order("data_vencimento", { ascending: true })
        .limit(5);
      if (repId) contasQ = contasQ.eq("representante_id", repId);
      const { data: contas } = await contasQ;
      const contasVencendoValor = (contas ?? []).reduce(
        (s, c: any) => s + Number(c.valor || 0),
        0,
      );

      // testes ativos
      const { count: testesAtivos } = await supabase
        .from("nutrir_campos_teste")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .eq("status", "em_andamento");

      // pedidos do mês
      const { data: pedidos } = await supabase
        .from("nutrir_pedidos")
        .select("id,total")
        .eq("organization_id", org.id)
        .eq("created_by", user.id)
        .gte("data_pedido", inicioMes);
      const pedidosValorMes = (pedidos ?? []).reduce(
        (s, p: any) => s + Number(p.total || 0),
        0,
      );

      // ranking
      let ranking: Kpis["ranking"] = null;
      if (repId) {
        const { data: rankData } = await supabase
          .from("nutrir_comissoes")
          .select("representante_id,valor")
          .eq("organization_id", org.id)
          .gte("mes_referencia", inicioMes);
        if (rankData?.length) {
          const map = new Map<string, number>();
          rankData.forEach((r: any) => {
            map.set(
              r.representante_id,
              (map.get(r.representante_id) || 0) + Number(r.valor || 0),
            );
          });
          const ord = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
          const pos = ord.findIndex(([id]) => id === repId);
          if (pos >= 0) ranking = { posicao: pos + 1, total: ord.length };
        }
      }

      // próximas visitas (clientes sem visita há mais tempo)
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
        contasVencendo: contas?.length ?? 0,
        contasVencendoValor,
        testesAtivos: testesAtivos ?? 0,
        pedidosMes: pedidos?.length ?? 0,
        pedidosValorMes,
        ranking,
      });
      setProximasVisitas(sugeridas);
      setContasUrgentes(contas ?? []);
      setLoading(false);
    })();
  }, [org, user, inicioMes, em15dias]);

  if (loading || !kpis) {
    return <div className="p-6 text-muted-foreground">Carregando dashboard...</div>;
  }

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

      {/* Saudação */}
      <div>
        <h1 className="text-xl font-bold">{saudacao()}! 👋</h1>
        <p className="text-sm text-muted-foreground">Veja o que precisa de atenção hoje.</p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Registrar Visita", icon: ClipboardList, to: "/app/rep/visitas", color: "bg-primary text-primary-foreground" },
          { label: "Meus Clientes",    icon: Users,          to: "/app/rep/clientes", color: "bg-muted" },
          { label: "Fazer Cálculo",    icon: Calculator,     to: "/app/rep/calculadoras", color: "bg-muted" },
          { label: "Novo Pedido",      icon: ShoppingCart,   to: "/app/rep/pedidos",  color: "bg-muted" },
        ].map((a) => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className={`${a.color} rounded-xl p-3 flex flex-col items-center gap-2 text-center hover:opacity-90 transition-opacity`}
          >
            <a.icon className="h-5 w-5" />
            <span className="text-xs font-medium leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard icon={ClipboardList} label="Visitas no mês"    value={String(kpis.visitasMes)}            accent="primary" />
        <KpiCard icon={ShoppingCart}  label="Pedidos no mês"    value={String(kpis.pedidosMes)}            accent="success" />
        <KpiCard icon={DollarSign}    label="Comissão prevista" value={fmtBRL(kpis.comissaoPrevista)}      accent="success" />
        <KpiCard icon={Receipt}       label="Contas vencendo"   value={`${kpis.contasVencendo} · ${fmtBRL(kpis.contasVencendoValor)}`} accent="warning" />
        <KpiCard icon={TestTube}      label="Testes ativos"     value={String(kpis.testesAtivos)}          accent="primary" />
        <KpiCard icon={Trophy}        label="Ranking"           value={kpis.ranking ? `${kpis.ranking.posicao}º / ${kpis.ranking.total}` : "—"} accent="primary" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Sugestão de visitas
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/rep/roteiro">
                Ver roteiro <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximasVisitas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
            )}
            {proximasVisitas.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <div className="font-medium text-sm">{c.razao_social}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "—"} ·{" "}
                    {c.ultima ? `Última visita ${new Date(c.ultima).toLocaleDateString("pt-BR")}` : "Sem visitas"}
                  </div>
                </div>
                <Badge variant="secondary">Sugerido</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Contas a vencer (15 dias)
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/rep/contas-receber">
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {contasUrgentes.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem contas vencendo nos próximos 15 dias.</p>
            )}
            {contasUrgentes.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <div className="font-medium text-sm">{c.nutrir_clientes?.razao_social ?? "Cliente"}</div>
                  <div className="text-xs text-muted-foreground">
                    Vence {new Date(c.data_vencimento).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge variant={c.status === "vencendo" ? "destructive" : "secondary"}>
                  {fmtBRL(Number(c.valor))}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: "primary" | "success" | "warning";
}) {
  const accentMap = {
    primary: "text-primary bg-primary/10",
    success: "text-[#b08826] bg-[#d4a843]/10",
    warning: "text-amber-600 bg-amber-500/10",
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`inline-flex p-1.5 rounded-md ${accentMap[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{label}</div>
        <div className="text-base font-semibold leading-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
