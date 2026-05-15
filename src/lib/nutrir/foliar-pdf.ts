import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo-nutrir-3d.png";
import type { FoliarResultado } from "@/lib/nutrir/foliar-engine";

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function header(doc: jsPDF, title: string, subtitle: string, logoData: string | null) {
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", 90, 10, 30, 18); } catch {/* ignore */}
  }
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(title, 105, 36, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(subtitle, 105, 42, { align: "center" });
  doc.setTextColor(0);
  doc.setDrawColor(34, 139, 34).setLineWidth(0.6);
  doc.line(15, 46, 195, 46);
}

function footer(doc: jsPDF, page: number, total: number) {
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(`NUTRIR — Programa de Adubação Foliar  ·  Página ${page}/${total}`, 105, 290, { align: "center" });
  doc.setTextColor(0);
}

export async function gerarPdfFoliar(
  resultado: FoliarResultado,
  meta: { produtor: string; fazenda: string; cultura: string; areaHa: number; data?: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const data = meta.data ?? new Date().toLocaleDateString("pt-BR");

  // ─── PAGINA 1: Custos, comparativo, lista de compras ───
  header(doc, "Recomendação de Adubação Foliar", `${meta.produtor || "—"} · ${meta.fazenda || "—"} · ${meta.cultura || "—"} · ${num(meta.areaHa, 0)} ha · ${data}`, logo);

  let y = 54;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Comparativo de Custos: Convencional × NUTRIR", 15, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["", "Convencional", "NUTRIR", "Diferença"]],
    body: [
      ["R$ / ha", moeda(resultado.comparativo.convencionalRsHa), moeda(resultado.comparativo.nutrirRsHa),
        `${resultado.comparativo.economiaRsHa >= 0 ? "−" : "+"}${moeda(Math.abs(resultado.comparativo.economiaRsHa))}`],
      ["Total na área", moeda(resultado.comparativo.convencionalRsHa * meta.areaHa),
        moeda(resultado.custoFoliarTotalRs),
        `${resultado.comparativo.economiaRsHa >= 0 ? "Economia " : "Investimento "}${moeda(Math.abs(resultado.comparativo.economiaTotalRs))}`],
      ["%", "—", "—", `${resultado.comparativo.economiaPercent}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Volume Total de Aplicação", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Volume foliar", "Nº batidas", "Nº aplicações", "Dias para cobrir"]],
    body: [[`${resultado.aplicacaoFoliarLHa} L/ha`, `${resultado.numeroBatidas}`,
      `${resultado.aplicacoesPorEstagio.filter(a => a.tipo === "foliar").length}`,
      `${resultado.diasParaCobrir} dias`]],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Aplicações por Estágio Fenológico", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["#", "Estágio", "Tipo", "Aplicação"]],
    body: resultado.aplicacoesPorEstagio.map(a => [
      String(a.ordem),
      a.nome,
      a.tipo === "drench" ? "Sulco/Drench" : "Foliar",
      a.itens.map(i => `${num(i.quantidade, 1)} ${i.unidade} — ${i.produto}`).join("\n"),
    ]),
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Lista de Compras (Matérias-primas)", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Produto", "Necessário", "Comprar", "R$/un", "Total"]],
    body: resultado.listaCompras.map(it => [
      it.produto,
      `${num(it.quantidadeArea, 0)} ${it.unidade}`,
      `${num(it.arredondado, 0)} ${it.unidade}${it.embalagem ? ` (${it.embalagem})` : ""}`,
      moeda(it.precoUnit),
      moeda(it.custoTotal),
    ]),
    foot: [["", "", "", "TOTAL", moeda(resultado.listaCompras.reduce((a, b) => a + b.custoTotal, 0))]],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 15, right: 15 },
  });

  footer(doc, 1, 2);

  // ─── PAGINA 2: Receita ───
  doc.addPage();
  header(doc, "Receita de Preparo da Calda", `Por batida — adicionar na ordem listada`, logo);

  autoTable(doc, {
    startY: 54,
    head: [["#", "Ingrediente", "Quantidade", "Instrução"]],
    body: resultado.receita.map(r => r.isInstrucao
      ? [String(r.ordem), { content: r.instrucao, colSpan: 3, styles: { fontStyle: "bold", fillColor: [240, 248, 240] } }] as any
      : [String(r.ordem), r.ingrediente, `${num(r.quantidade, 2)} ${r.unidade}`, r.instrucao]
    ),
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 32, halign: "right" } },
    margin: { left: 15, right: 15 },
  });

  footer(doc, 2, 2);

  doc.save(`NUTRIR-Adubacao-Foliar-${(meta.produtor || "produtor").replace(/\s+/g, "_")}.pdf`);
}
