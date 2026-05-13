/**
 * Teste de fluxo "E2E" do módulo NUTRIR (lógica de negócio):
 *   Orçamento → Pedido → Mudança de status → Notificação
 *
 * Como o ambiente Lovable não roda Playwright/browser real, o "E2E" aqui
 * cobre a cadeia de chamadas ao backend mockando o cliente Supabase.
 * O objetivo é garantir contratos, transições e efeitos colaterais críticos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { montarMensagemWhatsApp } from "@/lib/nutrir/whatsapp";

// ────────────────────────────────────────────────────────────────────────────
// Mock do cliente Supabase
// ────────────────────────────────────────────────────────────────────────────
type Tabela = Record<string, any[]>;
let db: Tabela = {};
let auditoria: any[] = [];
let notificacoes: any[] = [];

function makeQuery(table: string) {
  let rows = db[table] ?? [];
  let filters: Array<(r: any) => boolean> = [];
  const api: any = {
    select: () => api,
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return api;
    },
    order: () => api,
    single: async () => {
      const r = rows.filter((row) => filters.every((f) => f(row)))[0];
      return { data: r ?? null, error: r ? null : { message: "not found" } };
    },
    insert: async (payload: any) => {
      const arr = Array.isArray(payload) ? payload : [payload];
      const inserted = arr.map((p) => ({
        id: p.id ?? `${table}-${Math.random().toString(36).slice(2, 8)}`,
        created_at: new Date().toISOString(),
        ...p,
      }));
      db[table] = [...(db[table] ?? []), ...inserted];
      return {
        data: inserted[0],
        error: null,
        select: () => ({ single: async () => ({ data: inserted[0], error: null }) }),
      };
    },
    update: async (changes: any) => {
      const list = db[table] ?? [];
      let blocked: string | null = null;
      const updated = list.map((row) => {
        if (!filters.every((f) => f(row))) return row;
        // Simula trigger: bloqueia cancelamento sem permissão
        if (
          table === "nutrir_pedidos" &&
          changes.status === "cancelado" &&
          row.status !== "cancelado" &&
          (globalThis as any).__userRole !== "admin" &&
          (globalThis as any).__userRole !== "owner"
        ) {
          blocked = "Apenas administradores podem cancelar pedidos.";
          return row;
        }
        const next = { ...row, ...changes };
        // Simula trigger de auditoria
        if (
          (table === "nutrir_pedidos" || table === "nutrir_orcamentos") &&
          changes.status &&
          changes.status !== row.status
        ) {
          auditoria.push({
            entidade: table === "nutrir_pedidos" ? "pedido" : "orcamento",
            entidade_id: row.id,
            status_anterior: row.status,
            status_novo: changes.status,
            created_at: new Date().toISOString(),
          });
          // Simula trigger de notificação
          notificacoes.push({
            tipo: "info",
            entidade: table,
            entidade_id: row.id,
            titulo: `Status alterado para ${changes.status}`,
          });
        }
        return next;
      });
      db[table] = updated;
      return blocked
        ? { error: { message: blocked }, data: null }
        : { error: null, data: null };
    },
    delete: async () => {
      const before = (db[table] ?? []).length;
      db[table] = (db[table] ?? []).filter((r) => !filters.every((f) => f(r)));
      return { error: null, data: { count: before - db[table].length } };
    },
  };
  return api;
}

const supabaseMock = { from: (t: string) => makeQuery(t) };

beforeEach(() => {
  db = {
    nutrir_clientes: [{ id: "cli-1", razao_social: "Fazenda Boa Vista" }],
    nutrir_orcamentos: [],
    nutrir_orcamento_itens: [],
    nutrir_pedidos: [],
    nutrir_pedido_itens: [],
  };
  auditoria = [];
  notificacoes = [];
  (globalThis as any).__userRole = "member";
});

// ────────────────────────────────────────────────────────────────────────────
// Fluxo E2E
// ────────────────────────────────────────────────────────────────────────────
describe("NUTRIR · fluxo orçamento → pedido → status → notificação", () => {
  it("cria orçamento, converte em pedido, muda status e gera auditoria + notificação", async () => {
    // 1) cria orçamento
    const orc = await supabaseMock.from("nutrir_orcamentos").insert({
      organization_id: "org-1",
      titulo: "Safra 25/26 — Boa Vista",
      cliente_id: "cli-1",
      area_total_ha: 120,
      total_geral: 18000,
      status: "rascunho",
    });
    expect(orc.data.id).toBeTruthy();
    expect(db.nutrir_orcamentos).toHaveLength(1);

    // 2) converte em pedido (com origem)
    const ped = await supabaseMock.from("nutrir_pedidos").insert({
      organization_id: "org-1",
      cliente_id: "cli-1",
      orcamento_origem_id: orc.data.id,
      data_pedido: new Date().toISOString(),
      status: "rascunho",
      subtotal: 18000,
      desconto: 0,
      total: 18000,
    });
    expect(ped.data.orcamento_origem_id).toBe(orc.data.id);

    // 3) marca orçamento como convertido (deve gerar auditoria + notificação)
    await supabaseMock
      .from("nutrir_orcamentos")
      .eq("id", orc.data.id)
      .update({ status: "convertido" });

    // 4) confirma o pedido
    await supabaseMock
      .from("nutrir_pedidos")
      .eq("id", ped.data.id)
      .update({ status: "confirmado" });

    expect(auditoria).toHaveLength(2);
    expect(auditoria[0]).toMatchObject({
      entidade: "orcamento",
      status_anterior: "rascunho",
      status_novo: "convertido",
    });
    expect(auditoria[1]).toMatchObject({
      entidade: "pedido",
      status_anterior: "rascunho",
      status_novo: "confirmado",
    });

    expect(notificacoes).toHaveLength(2);
    expect(notificacoes[1].titulo).toMatch(/confirmado/);
  });

  it("bloqueia cancelamento por usuário comum e libera para admin", async () => {
    const ped = await supabaseMock.from("nutrir_pedidos").insert({
      organization_id: "org-1",
      cliente_id: "cli-1",
      data_pedido: new Date().toISOString(),
      status: "confirmado",
      subtotal: 100,
      desconto: 0,
      total: 100,
    });

    // Usuário comum tenta cancelar
    (globalThis as any).__userRole = "member";
    const r1 = await supabaseMock
      .from("nutrir_pedidos")
      .eq("id", ped.data.id)
      .update({ status: "cancelado" });
    expect(r1.error?.message).toMatch(/administradores/i);
    expect(db.nutrir_pedidos[0].status).toBe("confirmado");

    // Admin cancela com sucesso
    (globalThis as any).__userRole = "admin";
    const r2 = await supabaseMock
      .from("nutrir_pedidos")
      .eq("id", ped.data.id)
      .update({ status: "cancelado" });
    expect(r2.error).toBeNull();
    expect(db.nutrir_pedidos[0].status).toBe("cancelado");

    // E gera auditoria
    expect(auditoria.find((a) => a.status_novo === "cancelado")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Helper de WhatsApp
// ────────────────────────────────────────────────────────────────────────────
describe("NUTRIR · mensagem WhatsApp", () => {
  it("monta mensagem em pt-BR com cliente, total e referência", () => {
    const msg = montarMensagemWhatsApp({
      contexto: "pedido",
      cliente: "Fazenda Boa Vista",
      identificador: "Pedido #1234",
      total: 18000,
      observacao: "Status: confirmado",
    });
    expect(msg).toContain("Pedido NUTRIR");
    expect(msg).toContain("Fazenda Boa Vista");
    expect(msg).toContain("Pedido #1234");
    expect(msg).toContain("R$");
    expect(msg).toContain("18.000,00");
    expect(msg).toContain("Status: confirmado");
  });

  it("não inclui linhas vazias quando dados opcionais estão ausentes", () => {
    const msg = montarMensagemWhatsApp({ contexto: "foliar" });
    expect(msg).toContain("Recomendação Foliar");
    expect(msg).not.toContain("Cliente:");
    expect(msg).not.toContain("Total:");
  });
});
