// ── Definição central dos 6 papéis (cargos) e suas permissões ──
export type Position =
  | "proprietario"
  | "diretor"
  | "gerente"
  | "representante"
  | "assistente_tecnico"
  | "cliente";

export const POSITION_LABEL: Record<Position, string> = {
  proprietario: "Proprietário",
  diretor: "Diretor",
  gerente: "Gerente",
  representante: "Representante",
  assistente_tecnico: "Assistente Técnico",
  cliente: "Cliente",
};

export const POSITION_DESC: Record<Position, string> = {
  proprietario: "Acesso total · gestão da organização, financeiro, RLS, billing.",
  diretor: "Acesso total operacional · todos os módulos, exceto exclusão da organização.",
  gerente: "Aprovações, equipe regional, ouvidoria, dashboards, RDV.",
  representante: "Pedidos, visitas, RDV, clientes, comissões, roteiro.",
  assistente_tecnico: "Programa Nutrir (consultoria, NDVI, laudos, IA).",
  cliente: "Apenas dashboard/relatórios próprios e configurações.",
};

// Tags de capacidade (usadas para gating de rotas e UI)
export type Capability =
  | "org.manage"           // organização, billing, integrações, usuários, segurança
  | "rep.area"             // bloco Área do Representante
  | "nutrir.area"          // bloco Programa Nutrir (consultoria/produção)
  | "gerente.area"         // bloco Gerente (aprovações, ouvidoria, equipe regional)
  | "gestao.area"          // bloco Gestão (Motor, BD, Precificação)
  | "operacao.area"        // Financeiro, CRM, Estoque, Portal Cliente
  | "viewer.only";         // apenas dashboard / relatórios próprios / config

export const PERMISSIONS: Record<Position, Capability[]> = {
  proprietario: ["org.manage", "rep.area", "nutrir.area", "gerente.area", "gestao.area", "operacao.area"],
  diretor:      ["org.manage", "rep.area", "nutrir.area", "gerente.area", "gestao.area", "operacao.area"],
  gerente:      ["rep.area", "nutrir.area", "gerente.area", "operacao.area"],
  representante:["rep.area", "nutrir.area"],
  assistente_tecnico: ["nutrir.area"],
  cliente:      ["viewer.only"],
};

export function can(position: Position | null, cap: Capability): boolean {
  if (!position) return false;
  return PERMISSIONS[position].includes(cap);
}

// Mapeamento de prefixo de rota → capability necessária
export const ROUTE_CAPABILITY: Array<{ prefix: string; cap: Capability }> = [
  { prefix: "/app/admin", cap: "org.manage" },
  { prefix: "/app/organizacao", cap: "org.manage" },
  { prefix: "/app/billing", cap: "org.manage" },
  { prefix: "/app/integracoes", cap: "org.manage" },
  { prefix: "/app/equipe", cap: "org.manage" },
  { prefix: "/app/gestao", cap: "gestao.area" },
  { prefix: "/app/gerente", cap: "gerente.area" },
  { prefix: "/app/financeiro", cap: "operacao.area" },
  { prefix: "/app/crm", cap: "operacao.area" },
  { prefix: "/app/estoque", cap: "operacao.area" },
  { prefix: "/app/rep", cap: "rep.area" },
  { prefix: "/app/nutrir", cap: "nutrir.area" },
  { prefix: "/app/ia", cap: "nutrir.area" },
  { prefix: "/app/mapas", cap: "nutrir.area" },
  { prefix: "/app/heatmap", cap: "nutrir.area" },
  { prefix: "/app/satelite", cap: "nutrir.area" },
];

export function requiredCapability(pathname: string): Capability | null {
  // Ordem importa: prefixos mais específicos primeiro
  const sorted = [...ROUTE_CAPABILITY].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const r of sorted) {
    if (pathname === r.prefix || pathname.startsWith(r.prefix + "/")) return r.cap;
  }
  // Rotas livres (dashboard, relatorios, configuracoes, notificacoes, fazendas)
  return null;
}
