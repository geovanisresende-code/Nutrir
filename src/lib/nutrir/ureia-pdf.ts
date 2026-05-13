import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/nutrir-logo.jpg";
import type { CalcResult } from "@/lib/nutrir/nutrir-engine";

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
    try { doc.addImage(logoData, "JPEG", 90, 10, 30, 18); } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text(title, 105, 36, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text(subtitle, 105, 42, { align: "center" });
  doc.setTextColor(0);
  doc.setDrawColor(34, 139, 34).setLineWidth(0.6);
  doc.line(15, 46, 195, 46);
}

function footer(doc: jsPDF, page: number, total: number, label: string) {
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(`NUTRIR — ${label}  ·  Página ${page}/${total}`, 105, 290, { align: "center" });
  doc.setTextColor(0);
}

export async function gerarPdfUreia(
  resultado: CalcResult,
  meta: { produtor: string; fazenda: string; cultura: string; areaHa: number; data?: string; titulo?: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const data = meta.data ?? new Date().toLocaleDateString("pt-BR");
  const tituloPrincipal = meta.titulo ?? `Recomendação ${resultado.modo.toUpperCase()}`;

  header(
    doc,
    tituloPrincipal,
    `${meta.produtor || "—"} · ${meta.fazenda || "—"} · ${meta.cultura || "—"} · ${num(meta.areaHa, 0)} ha · ${data}`,
    logo,
  );

  let y = 54;

  // Resumo
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Resumo", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["N original (kg.N/ha)", num(resultado.nOriginalKgHa, 2)],
      ["N residual (kg.N/ha)", num(resultado.nResidualKgHa, 2)],
      ["Ureia equivalente (kg/ha)", num(resultado.ureiaKgHa, 0)],
      ["Calda total (L/ha)", num(resultado.caldaTotalLHa, 0)],
      ["Calda total na área (L)", num(resultado.caldaTotalL, 0)],
      ["Nº de aplicações", String(resultado.aplicacoes.length)],
      ["Custo NUTRIR (R$/ha)", moeda(resultado.custoPorHa)],
      ["Custo NUTRIR (total)", moeda(resultado.custoTotal)],
    ],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Comparativo
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(`Comparativo: ${resultado.comparativo.referenciaNome} × NUTRIR`, 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["", "Referência", "NUTRIR", "Diferença"]],
    body: [
      [
        "Descrição",
        resultado.comparativo.referenciaDescricao,
        resultado.comparativo.nutrirDescricao,
        "—",
      ],
      [
        "R$ / ha",
        moeda(resultado.comparativo.referenciaCustoHa),
        moeda(resultado.comparativo.nutrirCustoHa),
        `${resultado.comparativo.economiaPorHa >= 0 ? "−" : "+"}${moeda(Math.abs(resultado.comparativo.economiaPorHa))}`,
      ],
      [
        "Total na área",
        moeda(resultado.comparativo.referenciaCustoHa * meta.areaHa),
        moeda(resultado.custoTotal),
        `${resultado.comparativo.economiaPorHa >= 0 ? "Economia " : "Investimento "}${moeda(Math.abs(resultado.comparativo.economiaTotal))}`,
      ],
      ["Economia %", "—", "—", `${resultado.comparativo.economiaPercentual.toFixed(1)}%`],
    ],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Aplicações
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Aplicações por estágio", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Estágio", "Vazão L/ha", "Calda L", "Complexante", "Ureia kg/ha"]],
    body: resultado.aplicacoes.map((a) => [
      a.nome,
      num(a.vazaoLHa, 0),
      num(a.caldaTotalL, 0),
      a.complexante.toUpperCase(),
      num(a.ureiaKgHa, 0),
    ]),
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Custos
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Lista de Custos", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Item", "Quantidade", "Unid.", "R$/un", "Total"]],
    body: resultado.custos.map((c) => [
      c.item,
      num(c.quantidade, 2),
      c.unidade,
      moeda(c.precoUnitario),
      moeda(c.total),
    ]),
    foot: [["", "", "", "TOTAL", moeda(resultado.custoTotal)]],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 15, right: 15 },
  });

  footer(doc, 1, 2, "Adubação Nitrogenada Complexada");

  // Página 2 — receitas por estágio
  doc.addPage();
  header(doc, "Receitas de Preparo da Calda", "Por estágio — adicionar na ordem listada", logo);

  let yy = 54;
  for (const a of resultado.aplicacoes) {
    if (yy > 250) { footer(doc, 2, 2, "Adubação Nitrogenada Complexada"); doc.addPage(); header(doc, "Receitas de Preparo da Calda (cont.)", "", logo); yy = 54; }
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text(`${a.nome} — ${num(a.caldaTotalL, 0)} L de calda`, 15, yy);
    yy += 3;
    autoTable(doc, {
      startY: yy,
      head: [["#", "Ingrediente", "Quantidade", "Instrução"]],
      body: a.receita.map((r) => [
        String(r.ordem),
        r.ingrediente,
        `${num(r.quantidade, 2)} ${r.unidade}`,
        r.instrucao,
      ]),
      theme: "grid",
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 32, halign: "right" } },
      margin: { left: 15, right: 15 },
    });
    yy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  footer(doc, 2, 2, "Adubação Nitrogenada Complexada");
  doc.save(`NUTRIR-${resultado.modo}-${(meta.produtor || "produtor").replace(/\s+/g, "_")}.pdf`);
}
