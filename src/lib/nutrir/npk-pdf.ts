import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo-agrociencia.png";
import type { NPKResult } from "@/lib/nutrir/npk-foliar-engine";

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

function footer(doc: jsPDF, page: number, total: number) {
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(`NUTRIR — Adubação NPK Complexada  ·  Página ${page}/${total}`, 105, 290, { align: "center" });
  doc.setTextColor(0);
}

export async function gerarPdfNPK(
  resultado: NPKResult,
  meta: { produtor: string; fazenda: string; cultura: string; areaHa: number; data?: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  const data = meta.data ?? new Date().toLocaleDateString("pt-BR");

  header(
    doc,
    "Recomendação NPK Complexado",
    `${meta.produtor || "—"} · ${meta.fazenda || "—"} · ${meta.cultura || "—"} · ${num(meta.areaHa, 0)} ha · ${data}`,
    logo,
  );

  let y = 54;

  // Demanda original
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Demanda x NUTRIR (massas/ha)", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Nutriente", "Demanda kg/ha", "Reduzida (NUTRIR) kg/ha"]],
    body: [
      ["N", num(resultado.demanda.nKgHa, 1), num(resultado.massas.nReduzidoKgHa, 1)],
      ["P2O5", num(resultado.demanda.p2o5KgHa, 1), num(resultado.massas.pReduzidoKgHa, 1)],
      ["K2O", num(resultado.demanda.k2oKgHa, 1), num(resultado.massas.kReduzidoKgHa, 1)],
    ],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Massas das MPs
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Matérias-primas (kg/ha)", 15, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Ureia", "MAP", "KCl"]],
    body: [[num(resultado.massas.ureiaKgHa, 1), num(resultado.massas.mapKgHa, 1), num(resultado.massas.kclKgHa, 1)]],
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Comparativo
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Comparativo de custos", 15, y);
  y += 4;
  const comp = resultado.comparativo;
  const body: (string | number)[][] = [
    ["NUTRIR (R$/ha)", moeda(comp.nutrirCustoHa)],
    [`MP equivalentes (${comp.mpEquivalentesDescricao})`, moeda(comp.mpEquivalentesCustoHa)],
    ["Economia vs MP (R$/ha)", `${moeda(comp.economiaVsMPHa)}  (${comp.economiaVsMPPct.toFixed(1)}%)`],
    ["Economia vs MP (total)", moeda(comp.economiaVsMPTotal)],
  ];
  if (comp.formuladoClienteCustoHa !== undefined) {
    body.push([`Formulado cliente (${comp.formuladoClienteDescricao ?? ""})`, moeda(comp.formuladoClienteCustoHa)]);
    body.push(["Economia vs Formulado (R$/ha)", `${moeda(comp.economiaVsFormuladoHa ?? 0)}  (${(comp.economiaVsFormuladoPct ?? 0).toFixed(1)}%)`]);
    body.push(["Economia vs Formulado (total)", moeda(comp.economiaVsFormuladoTotal ?? 0)]);
  }
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [34, 139, 34], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Custos
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Lista de custos", 15, y);
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

  footer(doc, 1, 2);

  // Página 2 — receitas por batida
  doc.addPage();
  header(doc, "Receitas das Batidas", `Modo: ${resultado.modoAplicacao}`, logo);

  let yy = 54;
  for (const b of resultado.batidas) {
    if (yy > 250) { footer(doc, 2, 2); doc.addPage(); header(doc, "Receitas das Batidas (cont.)", "", logo); yy = 54; }
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text(`${b.nome} — calda ${num(b.volumeCaldaL, 0)} L · vazão ${num(b.vazaoLHa, 0)} L/ha`, 15, yy);
    yy += 3;
    autoTable(doc, {
      startY: yy,
      head: [["#", "Ingrediente", "Quantidade", "Instrução"]],
      body: b.receita1000L.map((r) => [
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

  if (resultado.alertas.length) {
    if (yy > 250) { footer(doc, 2, 2); doc.addPage(); header(doc, "Alertas", "", logo); yy = 54; }
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("Alertas", 15, yy);
    yy += 4;
    autoTable(doc, {
      startY: yy,
      head: [["#", "Mensagem"]],
      body: resultado.alertas.map((a, i) => [String(i + 1), a]),
      theme: "grid",
      headStyles: { fillColor: [200, 120, 20], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 15, right: 15 },
    });
  }

  footer(doc, 2, 2);
  doc.save(`NUTRIR-NPK-${(meta.produtor || "produtor").replace(/\s+/g, "_")}.pdf`);
}
