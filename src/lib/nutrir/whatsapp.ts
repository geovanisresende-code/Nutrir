// Helper para envio de mensagens via WhatsApp Web/App
// Como wa.me não aceita anexos diretos, abrimos o WhatsApp com uma mensagem
// pré-formatada e instruímos o usuário a anexar o PDF baixado.

export type WhatsAppContexto =
  | "foliar"
  | "npk"
  | "orcamento"
  | "pedido"
  | "consultoria";

interface EnviarWhatsAppParams {
  contexto: WhatsAppContexto;
  cliente?: string | null;
  cultura?: string | null;
  identificador?: string | null; // nº pedido / código orçamento / data
  total?: number | null;
  telefone?: string | null; // formato livre, será sanitizado
  observacao?: string | null;
}

const TITULOS: Record<WhatsAppContexto, string> = {
  foliar: "Recomendação Foliar",
  npk: "Recomendação NPK",
  orcamento: "Orçamento NUTRIR",
  pedido: "Pedido NUTRIR",
  consultoria: "Orçamento de Consultoria",
};

function sanitizarTelefone(tel?: string | null): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (!digits) return null;
  // Se vier sem DDI, assume Brasil (55)
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

function formatBRL(v?: number | null): string | null {
  if (v == null || isNaN(v)) return null;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function montarMensagemWhatsApp(p: EnviarWhatsAppParams): string {
  const linhas: string[] = [];
  linhas.push(`*${TITULOS[p.contexto]}*`);
  if (p.cliente) linhas.push(`Cliente: ${p.cliente}`);
  if (p.cultura) linhas.push(`Cultura: ${p.cultura}`);
  if (p.identificador) linhas.push(`Referência: ${p.identificador}`);
  const total = formatBRL(p.total ?? null);
  if (total) linhas.push(`Total: ${total}`);
  if (p.observacao) linhas.push("", p.observacao);
  linhas.push(
    "",
    "Segue em anexo o PDF com o detalhamento.",
    "_Mensagem enviada pelo NUTRIR_",
  );
  return linhas.join("\n");
}

export function abrirWhatsApp(p: EnviarWhatsAppParams): void {
  const msg = encodeURIComponent(montarMensagemWhatsApp(p));
  const tel = sanitizarTelefone(p.telefone);
  const url = tel
    ? `https://wa.me/${tel}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
