/**
 * PDF mensal de RDV (Relatório de Despesas de Viagem)
 *  - Capa
 *  - Resumo por categoria
 *  - Tabela detalhada
 *  - Galeria de NFs/cupons (anexos)
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nutrirLogo from "@/assets/logo-agrociencia.png";
import { supabase } from "@/integrations/supabase/client";

const GREEN: [number, number, number] = [27, 67, 50];
const GOLD: [number, number, number] = [200, 161, 89];

const CATEGORIA_LABEL: Record<string, string> = {
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  hospedagem: "Hospedagem",
  pedagio: "Pedágio",
  manutencao: "Manutenção",
  estacionamento: "Estacionamento",
  outros: "Outros",
};

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function imgFromStorage(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("rdv-cupons").createSignedUrl(path, 60);
    if (!data?.signedUrl) return null;
    const r = await fetch(data.signedUrl);
    const b = await r.blob();
    return await new Promise<string>(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result as string);
      reader.readAsDataURL(b);
    });
  } catch { return null; }
}

export interface RdvPDFInput {
  rdvs: any[];
  vendedor: { nome: string; cargo?: string; regional?: string };
  periodo: { inicio: Date; fim: Date };
}

export async function gerarRdvPDF(input: RdvPDFInput): Promise<Blob> {
  const { rdvs, vendedor, periodo } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Capa ──────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, ph, "F");
  try { doc.addImage(nutrirLogo, "JPEG", pw/2 - 22, 50, 44, 44); } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Relatório de Despesas de Viagem", pw/2, 120, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.line(pw/2 - 35, 128, pw/2 + 35, 128);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(vendedor.nome, pw/2, 146, { align: "center" });
  if (vendedor.cargo) { doc.setFontSize(11); doc.setTextColor(220,220,220); doc.text(vendedor.cargo, pw/2, 154, { align: "center" }); }
  if (vendedor.regional) doc.text(`Regional: ${vendedor.regional}`, pw/2, 162, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const periodoStr = `${periodo.inicio.toLocaleDateString("pt-BR")} a ${periodo.fim.toLocaleDateString("pt-BR")}`;
  doc.text(`Período: ${periodoStr}`, pw/2, 178, { align: "center" });

  // ── Página 2: resumo ──────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Resumo por Categoria", 12, 14);

  // Agrupa por categoria
  const porCategoria = rdvs.reduce<Record<string, number>>((acc, r) => {
    const cat = r.categoria ?? "outros";
    acc[cat] = (acc[cat] ?? 0) + Number(r.valor || 0);
    return acc;
  }, {});
  const totalGeral = Object.values(porCategoria).reduce((a, b) => a + b, 0);

  autoTable(doc, {
    startY: 30,
    head: [["Categoria", "Lançamentos", "Subtotal"]],
    body: Object.entries(porCategoria).map(([cat, valor]) => [
      CATEGORIA_LABEL[cat] ?? cat,
      String(rdvs.filter(r => (r.categoria ?? "outros") === cat).length),
      fmtBRL(valor),
    ]).concat([["TOTAL GERAL", String(rdvs.length), fmtBRL(totalGeral)]] as any),
    theme: "striped",
    headStyles: { fillColor: GREEN, textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 12, right: 12 },
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.raw && (data.row.raw as any[])[0] === "TOTAL GERAL") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = GREEN as any;
      }
    },
  });

  // ── Detalhamento ──────────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Detalhamento de Lançamentos", 12, 14);

  autoTable(doc, {
    startY: 30,
    head: [["Data", "Categoria", "Cidade/UF", "Descrição", "Valor"]],
    body: rdvs.map(r => [
      r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—",
      CATEGORIA_LABEL[r.categoria] ?? r.categoria,
      [r.cidade, r.uf].filter(Boolean).join("/") || "—",
      r.descricao ?? r.hotel_nome ?? "—",
      fmtBRL(Number(r.valor || 0)),
    ]),
    theme: "grid",
    headStyles: { fillColor: GREEN, textColor: 255 },
    styles: { fontSize: 8 },
    columnStyles: { 4: { halign: "right" } },
    margin: { left: 8, right: 8 },
  });

  // ── Galeria de NFs/cupons (até 12) ────────────────────────────────
  const paths = rdvs.flatMap(r => r.cupom_path ? [r.cupom_path as string] : []).slice(0, 12);
  if (paths.length > 0) {
    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pw, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("Notas Fiscais e Cupons", 12, 14);

    let y = 32, col = 0;
    const colW = (pw - 12 * 2 - 6) / 3, colH = 60;
    for (const p of paths) {
      const dataUrl = await imgFromStorage(p);
      if (!dataUrl) continue;
      const x = 12 + col * (colW + 6);
      try { doc.addImage(dataUrl, "JPEG", x, y, colW, colH); } catch {}
      col++;
      if (col === 3) { col = 0; y += colH + 6; if (y + colH > ph - 20) { doc.addPage(); y = 32; } }
    }
  }

  // ── Rodapé ────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(110, 116, 125);
    doc.text(`${vendedor.nome} · ${periodoStr} · Página ${p}/${pages}`, pw/2, ph - 8, { align: "center" });
  }
  return doc.output("blob");
}

export function baixarBlobRDV(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
