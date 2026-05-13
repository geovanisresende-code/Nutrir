/**
 * Helpers para abrir conversas no WhatsApp com mensagem pré-formatada.
 * Aceita números no formato BR (com ou sem DDI/máscara).
 */

export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Garante DDI 55 para números BR sem código
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const num = normalizePhoneBR(phone);
  if (!num) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${num}${text}`;
}

export function openWhatsapp(phone: string | null | undefined, message?: string): boolean {
  const url = whatsappLink(phone, message);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export const wppTemplates = {
  contaVencendo: (cliente: string, valor: number, vencimento: string) =>
    `Olá ${cliente}, tudo bem? 👋\n\nPassando para lembrar do seu boleto no valor de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} com vencimento em ${vencimento}.\n\nQualquer dúvida estou à disposição. 🌱`,
  pedidoConfirmado: (cliente: string, total: number) =>
    `Olá ${cliente}! Seu pedido foi confirmado no valor de R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. ✅\n\nEm breve enviaremos os detalhes da entrega.`,
  visitaAgendada: (cliente: string, data: string) =>
    `Olá ${cliente}! Confirmando nossa visita técnica agendada para ${data}. Até lá! 🚜`,
  testeAcompanhamento: (cliente: string, titulo: string) =>
    `Olá ${cliente}! Vou passar para acompanhar o teste "${titulo}". Posso confirmar para amanhã?`,
};
