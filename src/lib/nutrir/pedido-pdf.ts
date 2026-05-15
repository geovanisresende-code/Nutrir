import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nutrirLogo from "@/assets/logo-nutrir-3d.png";
import { formatBRL } from "./precos-engine";

export interface PedidoPDFInput {
  numero?: string | null;
  data_pedido: string;
  data_entrega?: string | null;
  cliente_nome: string;
  cliente_doc?: string | null;
  cliente_endereco?: string | null;
  representante?: string | null;
  regional?: string | null;
  modalidade?: string | null;
  status: string;
  itens: Array<{
    produto: string;
    embalagem?: string | null;
    quantidade: number;
    preco_unitario: number;
    desconto_pct: number;
    subtotal: number;
  }>;
  subtotal: number;
  desconto: number;
  total: number;
  observacoes?: string | null;
}

const GREEN: [number, number, number] = [27, 67, 50];
const GOLD: [number, number, number] = [200, 161, 89];
const MUTED: [number, number, number] = [110, 116, 125];

export async function gerarPedidoPDF(input: PedidoPDFInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 28, "F");
  try {
    doc.addImage(nutrirLogo, "JPEG", 10, 6, 18, 16);
  } catch { /* ignore */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text("PEDIDO COMERCIAL", 32, 14);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Programa NUTRIR · ${input.numero ?? "—"}`, 32, 20);

  doc.setTextColor(255, 255, 255).setFontSize(9);
  doc.text(`Status: ${input.status.toUpperCase()}`, pw - 10, 14, { align: "right" });
  doc.text(new Date(input.data_pedido).toLocaleDateString("pt-BR"), pw - 10, 20, { align: "right" });

  // Cliente
  let y = 36;
  doc.setTextColor(0, 0, 0).setFont("helvetica", "bold").setFontSize(11);
  doc.text("Cliente", 10, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  y += 6;
  doc.text(input.cliente_nome, 10, y);
  if (input.cliente_doc) { y += 5; doc.setTextColor(...MUTED).text(input.cliente_doc, 10, y).setTextColor(0,0,0); }
  if (input.cliente_endereco) { y += 5; doc.setTextColor(...MUTED).text(input.cliente_endereco, 10, y).setTextColor(0,0,0); }

  // Detalhes
  const rightX = pw / 2 + 5;
  let yr = 36;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Comercial", rightX, yr);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  yr += 6;
  if (input.representante) { doc.text(`Representante: ${input.representante}`, rightX, yr); yr += 5; }
  if (input.regional) { doc.text(`Regional: ${input.regional}`, rightX, yr); yr += 5; }
  if (input.modalidade) { doc.text(`Modalidade: ${input.modalidade}`, rightX, yr); yr += 5; }
  if (input.data_entrega) { doc.text(`Entrega: ${new Date(input.data_entrega).toLocaleDateString("pt-BR")}`, rightX, yr); }
  doc.setTextColor(0, 0, 0);

  // Itens
  autoTable(doc, {
    startY: Math.max(y, yr) + 8,
    head: [["#", "Produto", "Embalagem", "Qtd", "Preço un.", "Desc %", "Subtotal"]],
    body: input.itens.map((i, idx) => [
      String(idx + 1),
      i.produto,
      i.embalagem ?? "—",
      i.quantidade.toFixed(2),
      formatBRL(i.preco_unitario),
      i.desconto_pct.toFixed(1) + "%",
      formatBRL(i.subtotal),
    ]),
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" },
      5: { halign: "right" }, 6: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 10, right: 10 },
  });

  // Totais
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const boxX = pw - 80;
  doc.setDrawColor(...GOLD).setLineWidth(0.5);
  doc.roundedRect(boxX, finalY, 70, 24, 2, 2);
  doc.setFontSize(9).setTextColor(...MUTED);
  doc.text("Subtotal", boxX + 4, finalY + 6);
  doc.text("Desconto", boxX + 4, finalY + 12);
  doc.setFontSize(11).setTextColor(...GREEN).setFont("helvetica", "bold");
  doc.text("TOTAL", boxX + 4, finalY + 20);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0, 0, 0);
  doc.text(formatBRL(input.subtotal), boxX + 66, finalY + 6, { align: "right" });
  doc.text("- " + formatBRL(input.desconto), boxX + 66, finalY + 12, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...GREEN);
  doc.text(formatBRL(input.total), boxX + 66, finalY + 20, { align: "right" });

  // Observações
  if (input.observacoes) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0, 0, 0);
    doc.text("Observações", 10, finalY + 6);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    const lines = doc.splitTextToSize(input.observacoes, pw - 90);
    doc.text(lines, 10, finalY + 12);
  }

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...GOLD).line(10, ph - 14, pw - 10, ph - 14);
  doc.setFontSize(8).setTextColor(...MUTED);
  doc.text("Programa NUTRIR · Documento gerado eletronicamente", 10, ph - 8);
  doc.text(new Date().toLocaleString("pt-BR"), pw - 10, ph - 8, { align: "right" });

  return doc.output("blob");
}
