import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Map, Sprout, FlaskRound, ShoppingCart, FileText,
  Brain, Satellite, FlaskConical, MapPin, TestTube, Globe, Box, Users,
  Building2, Settings, CreditCard, Plug, ChevronRight, ShieldCheck,
  Leaf, Beaker, Package, FileSpreadsheet, Briefcase, DollarSign, BarChart3,
  ClipboardList, Receipt, Boxes, AlertCircle, UserCog, Activity, BookOpen, Calculator,
  Database, Layers, Megaphone, TrendingUp, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import nutrirLogo from "@/assets/logo-agrociencia.png";
import { useState, useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePosition } from "@/hooks/usePosition";
import { can } from "@/lib/permissions";

/*
  ── Sidebar Unificado (Agromap × Nutrir Core) ──
  Estruturado conforme a especificação:
    1) Área do Representante  (com submenus aninhados)
    2) Área do Gerente        (autorizações controladas pelo ADM)
    3) Gestão do Programa     (somente ADM)
*/

type LeafItem = { to: string; label: string; icon: any; end?: boolean; badge?: string };
type GroupItem = { label: string; icon: any; badge?: string; children: LeafItem[] };
type AnyItem = LeafItem | GroupItem;
type NavSection = { title: string; items: AnyItem[] };

const isGroup = (i: AnyItem): i is GroupItem => "children" in i;

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — Área do Representante
// ─────────────────────────────────────────────────────────────────────────────
const repSection: NavSection = {
  title: "Área do Representante",
  items: [
    { to: "/app/rep", label: "Dashboard", icon: LayoutDashboard, end: true },

    // ── Operação diária — visitas e clientes ──
    {
      label: "Relatório de Visitas",
      icon: ClipboardList,
      children: [
        { to: "/app/rep/visitas",          label: "Registrar Visita",   icon: ClipboardList },
        { to: "/app/rep/campos-teste",     label: "Campos de Teste",    icon: TestTube },
        { to: "/app/rep/talhoes",          label: "Talhões / GPS",      icon: Map },
      ],
    },
    { to: "/app/rep/clientes",         label: "Clientes",            icon: Briefcase },
    { to: "/app/rep/estoque-cliente",  label: "Estoque do Cliente",  icon: Boxes },

    // ── Comercial — pedidos, comissões e contas ──
    { to: "/app/rep/pedidos",          label: "Pedidos",             icon: ShoppingCart },
    {
      label: "Comissões & Contas",
      icon: DollarSign,
      children: [
        { to: "/app/rep/comissoes",      label: "Comissões",         icon: DollarSign },
        { to: "/app/rep/contas-receber", label: "Contas a Receber",  icon: Receipt },
      ],
    },
    { to: "/app/rep/rdv",              label: "RDV",                 icon: FileSpreadsheet },

    // ── Programa Nutrir ──
    {
      label: "Programa Nutrir",
      icon: Sprout,
      children: [
        { to: "/app/nutrir",                   label: "Hub Nutrir",                  icon: Sprout, end: true },
        { to: "/app/nutrir/orcamento",         label: "Orçamento de Consultoria",    icon: FileSpreadsheet },
        { to: "/app/nutrir/orcamento-nutricao",label: "Orçamento + Nutrição",        icon: Leaf, badge: "novo" },
        { to: "/app/nutrir/painel-custo",      label: "Painel Custo de Análise",     icon: Calculator },
        { to: "/app/nutrir/orcamentos",        label: "Orçamentos Salvos",           icon: FileText },
      ],
    },
    { to: "/app/nutrir/produtos",      label: "Produtos",            icon: Package },

    // ── Mapas e Inteligência ──
    {
      label: "Mapas e Talhões",
      icon: Map,
      children: [
        { to: "/app/mapas",          label: "Criar Mapas",       icon: Map },
        { to: "/app/nutrir/ndvi",    label: "Análise NDVI",      icon: Satellite },
        { to: "/app/nutrir/coleta",  label: "Coletar Amostras",  icon: MapPin },
      ],
    },
    {
      label: "IA Agronômica",
      icon: Brain,
      children: [
        { to: "/app/ia/solo",      label: "Análise de Solo",    icon: FlaskConical },
        { to: "/app/ia/sintomas",  label: "Sintomas Foliares",  icon: Leaf },
      ],
    },

    { to: "/app/relatorios",           label: "Relatórios",          icon: FileText },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — Programa Nutrir (visível para todos com nutrir.area)
// ─────────────────────────────────────────────────────────────────────────────
const nutrirSection: NavSection = {
  title: "Programa Nutrir",
  items: [
    { to: "/app/nutrir",                    label: "Hub Nutrir",               icon: Sprout, end: true },
    { to: "/app/nutrir/orcamento",          label: "Orçamento Consultoria",    icon: FileSpreadsheet },
    { to: "/app/nutrir/orcamento-nutricao", label: "Orçamento + Nutrição",     icon: Leaf, badge: "novo" },
    { to: "/app/nutrir/orcamentos",         label: "Orçamentos Salvos",        icon: FileText },
    { to: "/app/nutrir/produtos",           label: "Produtos",                 icon: Package },
    { to: "/app/mapas",                     label: "Mapas e Talhões",          icon: Map },
    { to: "/app/rep/talhoes",               label: "Talhões / GPS",            icon: MapPin },
    { to: "/app/nutrir/ndvi",               label: "Análise NDVI",             icon: Satellite },
    { to: "/app/nutrir/coleta",             label: "Coletar Amostras",         icon: MapPin },
    { to: "/app/ia/solo",                   label: "IA: Análise de Solo",      icon: Brain },
    { to: "/app/ia/sintomas",               label: "IA: Sintomas Foliares",    icon: FlaskConical },
    { to: "/app/gestao/motor-calculos",     label: "Motor de Cálculos",        icon: Calculator, badge: "core" },
    { to: "/app/relatorios",                label: "Relatórios",               icon: FileText },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — Área do Gerente
// ─────────────────────────────────────────────────────────────────────────────
const gerenteSection: NavSection = {
  title: "Área do Gerente",
  items: [
    { to: "/app/gerente/dashboard",        label: "Dashboard Comercial",  icon: BarChart3 },
    { to: "/app/nutrir/painel-diretoria", label: "Painel Diretoria",     icon: TrendingUp, badge: "novo" },
    { to: "/app/gerente/ouvidoria",        label: "Ouvidoria",            icon: AlertCircle, badge: "alertas" },
    { to: "/app/gerente/equipe",           label: "Equipe Regional",      icon: Users },
    { to: "/app/gerente/aprovacoes",       label: "Aprovações",           icon: ShieldCheck },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — Gestão do Programa (somente ADM)
// ─────────────────────────────────────────────────────────────────────────────
const gestaoSection: NavSection = {
  title: "Gestão do Programa",
  items: [
    { to: "/app/gestao/orcamento-consultoria", label: "Orçamento Consultoria",  icon: Activity, badge: "motor" },
    { to: "/app/gestao/clientes",              label: "BD de Clientes",          icon: Database },
    {
      label: "Banco de Dados de Produtos",
      icon: Package,
      children: [
        { to: "/app/gestao/produtos",       label: "Produtos",                  icon: Package },
        { to: "/app/gestao/precificacao",   label: "Precificação de Produtos",  icon: DollarSign },
        { to: "/app/nutrir/modalidades",    label: "Modalidades",               icon: Layers },
      ],
    },
    { to: "/app/nutrir/regionais",     label: "Regionais",                       icon: Globe },
    { to: "/app/gestao/colaboradores", label: "Representantes e Colaboradores",  icon: UserCog },
    { to: "/app/gestao/rdv-relatorios",label: "Relatórios de Despesas Colab.",   icon: Receipt },
    { to: "/app/gestao/culturas",      label: "Banco de Dados de Culturas",      icon: Sprout },
    {
      label: "Motor de Cálculos",
      icon: FlaskConical,
      badge: "core",
      children: [
        { to: "/app/gestao/motor-calculos",     label: "Calculadora Nutrir",       icon: Calculator },
        { to: "/app/nutrir/materias-primas",    label: "Matérias-primas",          icon: Beaker },
        { to: "/app/nutrir/embalagens",         label: "Embalagens",               icon: Box },
        { to: "/app/nutrir/complexadores",      label: "Complexadores",            icon: FlaskRound },
        { to: "/app/nutrir/fontes-formulas",    label: "Fontes & Fórmulas",        icon: BookOpen },
        { to: "/app/gestao/importacoes",        label: "Importações CSV/Excel",    icon: FileSpreadsheet },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 4 — Financeiro & Operações (opcional, controlado por permissão)
// ─────────────────────────────────────────────────────────────────────────────
const operacaoSection: NavSection = {
  title: "Financeiro & Operações",
  items: [
    { to: "/app/financeiro",                  label: "Financeiro",          icon: DollarSign },
    { to: "/app/crm",                        label: "CRM Pipeline",        icon: BarChart3 },
    { to: "/app/nutrir/geracao-demanda",     label: "Geração de Demanda",  icon: Megaphone, badge: "novo" },
    {
      label: "Estoque",
      icon: Boxes,
      children: [
        { to: "/app/estoque/lotes",      label: "Estoque por Lotes", icon: Boxes },
        { to: "/app/estoque/romaneios",  label: "Romaneios",         icon: ClipboardList },
      ],
    },
    { to: "/app/admin/portal",          label: "Portal do Cliente",  icon: ShieldCheck },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 5 — Administração geral (organização, planos, configurações)
// ─────────────────────────────────────────────────────────────────────────────
const adminSection: NavSection = {
  title: "Administração",
  items: [
    { to: "/app",                  label: "Dashboard",           icon: LayoutDashboard, end: true },
    { to: "/app/admin/usuarios",   label: "Usuários",            icon: ShieldCheck },
    { to: "/app/equipe",           label: "Equipe",              icon: Users },
    { to: "/app/organizacao",      label: "Organização",         icon: Building2 },
    { to: "/app/billing",          label: "Planos & Cobrança",   icon: CreditCard },
    { to: "/app/integracoes",      label: "Integrações",         icon: Plug },
    { to: "/app/configuracoes",    label: "Configurações",       icon: Settings },
  ],
};

// Mínimo p/ viewer (cliente)
const viewerSection: NavSection = {
  title: "Minha Área",
  items: [
    { to: "/app",                label: "Dashboard",     icon: LayoutDashboard, end: true },
    { to: "/app/relatorios",     label: "Relatórios",    icon: FileText },
    { to: "/app/configuracoes",  label: "Configurações", icon: Settings },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────────
export const AppSidebar = () => {
  const { isAdmin, isDirector, loading: r1 } = useUserRole();
  const { position, loading: r2 } = usePosition();
  const loading = r1 || r2;

  const sections = useMemo<NavSection[]>(() => {
    if (loading) return [];
    if (position === "cliente") return [viewerSection];
    const out: NavSection[] = [];
    if (can(position, "rep.area"))      out.push(repSection);
    if (can(position, "nutrir.area"))   out.push(nutrirSection);
    if (can(position, "gerente.area"))  out.push(gerenteSection);
    if (can(position, "gestao.area") || isAdmin || isDirector) out.push(gestaoSection);
    if (can(position, "operacao.area")) out.push(operacaoSection);
    if (can(position, "org.manage") || isAdmin || isDirector)  out.push(adminSection);
    if (out.length === 0) out.push(viewerSection);
    return out;
  }, [loading, position, isAdmin, isDirector]);

  return (
    <aside className="w-[220px] shrink-0 bg-sidebar flex flex-col h-screen sticky top-0 border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 h-14 border-b border-sidebar-border shrink-0">
        <img src={nutrirLogo} alt="Nutrir" className="h-9 w-auto object-contain" />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3">
        {sections.map((section) => (
          <SidebarSection key={section.title} section={section} />
        ))}
      </nav>
    </aside>
  );
};

const SidebarSection = ({ section }: { section: NavSection }) => {
  const { pathname } = useLocation();
  const hasActive = section.items.some(item =>
    isGroup(item)
      ? item.children.some(c => (c.end ? pathname === c.to : pathname.startsWith(c.to)))
      : (item.end ? pathname === item.to : pathname.startsWith(item.to))
  );
  const [open, setOpen] = useState(hasActive || section.title === "Área do Representante");

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1 mb-1 text-[10.5px] font-semibold uppercase tracking-widest text-sidebar-section hover:text-sidebar-foreground/60 transition-colors duration-150"
      >
        <span>{section.title}</span>
        <ChevronRight className={cn("h-3 w-3 transition-transform duration-150", open && "rotate-90")} />
      </button>
      {open && (
        <div className="space-y-0.5">
          {section.items.map((item, idx) =>
            isGroup(item)
              ? <NavGroup key={item.label + idx} group={item} />
              : <NavItemRow key={item.to} item={item} />
          )}
        </div>
      )}
    </div>
  );
};

const NavGroup = ({ group }: { group: GroupItem }) => {
  const { pathname } = useLocation();
  const childActive = group.children.some(c =>
    c.end ? pathname === c.to : pathname.startsWith(c.to)
  );
  const [open, setOpen] = useState(childActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors duration-150",
          childActive
            ? "text-sidebar-primary font-medium"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        )}
      >
        <group.icon className="h-[15px] w-[15px] shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        {group.badge && (
          <span className="text-[9px] uppercase font-bold tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm">
            {group.badge}
          </span>
        )}
        <ChevronRight className={cn("h-3 w-3 opacity-40 transition-transform duration-150", open && "rotate-90")} />
      </button>
      {open && (
        <div className="ml-4 pl-3 mt-0.5 space-y-0.5 border-l-2 border-sidebar-border">
          {group.children.map(item => <NavItemRow key={item.to} item={item} compact />)}
        </div>
      )}
    </div>
  );
};

const NavItemRow = ({ item, compact = false }: { item: LeafItem; compact?: boolean }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) =>
      cn(
        "group flex items-center gap-2 rounded-md text-[13px] transition-colors duration-150",
        compact ? "px-2 py-1" : "px-2 py-1.5",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold border-l-[3px] border-primary rounded-l-none pl-[5px]"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )
    }
  >
    <item.icon className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-[15px] w-[15px]")} />
    <span className="flex-1 truncate">{item.label}</span>
    {item.badge && (
      <span className="text-[9px] uppercase font-bold tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm">
        {item.badge}
      </span>
    )}
  </NavLink>
);
