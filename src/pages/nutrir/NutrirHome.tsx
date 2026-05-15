import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { formatBRL } from "@/lib/nutrir/precos-engine";
import {
  FileSpreadsheet, Leaf, Droplets, ShoppingCart, DollarSign, Briefcase,
  Package, Beaker, Sprout, UserCog, Globe, FileText, Box, Users, BarChart3,
  TrendingUp, History,
} from "lucide-react";

interface Pedido { id: string; total: number; status: string; }

const tiles = [
  { to: "/app/nutrir/dashboard-geral", label: "Dashboard NUTRIR", icon: BarChart3, color: "text-primary", desc: "Visão consolidada · foliares · orçamentos · economia" },
  { to: "/app/nutrir/dashboard", label: "Dashboard Comercial", icon: TrendingUp, color: "text-primary", desc: "KPIs e gráficos de vendas" },
  { to: "/app/nutrir/orcamento", label: "Orçamento Consultoria", icon: FileSpreadsheet, color: "text-primary", desc: "Por talhão / GRIDE / valor por amostra" },
  { to: "/app/nutrir/calculadora-foliar", label: "Calc. Foliar Complexada", icon: Leaf, color: "text-[#b08826]", desc: "Convencional × NUTRIR + PDF" },
  { to: "/app/nutrir/historico-foliar", label: "Histórico Foliar", icon: History, color: "text-emerald-700", desc: "Cálculos foliares salvos" },
  { to: "/app/nutrir/calculadora-npk", label: "Calc. NPK Drench", icon: Droplets, color: "text-sky-600", desc: "Fertirrigação por nutriente ou fórmula" },
  { to: "/app/nutrir/historico-npk", label: "Histórico NPK", icon: History, color: "text-sky-700", desc: "Cálculos NPK salvos" },
  { to: "/app/nutrir/pedidos", label: "Pedidos", icon: ShoppingCart, color: "text-amber-600", desc: "Pedidos com preço automático" },
  { to: "/app/nutrir/precos", label: "Tabela de Preços", icon: DollarSign, color: "text-amber-600", desc: "Produto × Regional × Modalidade × Embalagem" },
  { to: "/app/nutrir/clientes", label: "Clientes", icon: Briefcase, color: "text-foreground", desc: "Cadastro completo Nutrir" },
  { to: "/app/nutrir/produtos", label: "Produtos", icon: Package, color: "text-foreground", desc: "Linha NUTRIR" },
  { to: "/app/nutrir/materias-primas", label: "Matérias-primas", icon: Beaker, color: "text-foreground", desc: "Insumos para formulações" },
  { to: "/app/nutrir/formulacoes", label: "Formulações", icon: Sprout, color: "text-foreground", desc: "Receitas técnicas" },
  { to: "/app/nutrir/representantes", label: "Representantes", icon: UserCog, color: "text-foreground", desc: "Equipe comercial" },
  { to: "/app/nutrir/regionais", label: "Regionais", icon: Globe, color: "text-foreground", desc: "Áreas de atuação" },
  { to: "/app/nutrir/modalidades", label: "Modalidades", icon: FileText, color: "text-foreground", desc: "Condições comerciais" },
  { to: "/app/nutrir/embalagens", label: "Embalagens", icon: Box, color: "text-foreground", desc: "Volumes e custos" },
  { to: "/app/nutrir/usuarios", label: "Usuários Nutrir", icon: Users, color: "text-foreground", desc: "Vendedores, consultores e gerentes" },
];

export default function NutrirHome() {
  const { data: pedidos } = useOrgTable<Pedido>("nutrir_pedidos", { select: "id,total,status" });
  const { data: clientes } = useOrgTable<{ id: string }>("nutrir_clientes", { select: "id" });
  const { data: produtos } = useOrgTable<{ id: string }>("nutrir_produtos", { select: "id" });
  const { data: orcamentos } = useOrgTable<{ id: string; total_geral: number }>("nutrir_orcamentos", { select: "id,total_geral" });

  const ativos = pedidos.filter(p => p.status !== "cancelado");
  const fat = ativos.reduce((s, p) => s + Number(p.total || 0), 0);
  const orcTotal = orcamentos.reduce((s, o) => s + Number(o.total_geral || 0), 0);

  return (
    <>
      <PageHeader title="Programa NUTRIR" description="Hub completo: consultoria agronômica + comercial integrado" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={TrendingUp} label="Faturamento" value={formatBRL(fat)} accent />
          <Stat icon={ShoppingCart} label="Pedidos" value={String(ativos.length)} />
          <Stat icon={FileSpreadsheet} label="Orçamentos" value={`${orcamentos.length} · ${formatBRL(orcTotal)}`} />
          <Stat icon={Briefcase} label="Clientes / Produtos" value={`${clientes.length} / ${produtos.length}`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiles.map(t => (
            <Link key={t.to} to={t.to}>
              <Card className="p-4 h-full hover:shadow-elegant hover:border-primary/40 transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <t.icon className={`w-5 h-5 ${t.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
}
