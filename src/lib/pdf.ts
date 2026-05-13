// PDF generation utilities using jsPDF + autoTable
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY: [number, number, number] = [22, 163, 74]; // green-600
const MUTED: [number, number, number] = [100, 116, 139];

export type ReportContext = {
  orgName: string;
  clientName?: string | null;
  fieldName?: string | null;
};

function header(doc: jsPDF, title: string, ctx: ReportContext) {
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AgroSpec", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(ctx.orgName, doc.internal.pageSize.getWidth() - 14, 14, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const meta: string[] = [];
  if (ctx.clientName) meta.push(`Cliente: ${ctx.clientName}`);
  if (ctx.fieldName) meta.push(`Talhão: ${ctx.fieldName}`);
  meta.push(`Emitido em: ${new Date().toLocaleString("pt-BR")}`);
  doc.text(meta.join("  •  "), 14, 42);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 46, doc.internal.pageSize.getWidth() - 14, 46);
  doc.setTextColor(15, 23, 42);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Página ${i} de ${pages}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
    doc.text(
      "Gerado por AgroSpec",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text(text, 14, y);
  doc.setTextColor(15, 23, 42);
  return y + 6;
}

function paragraph(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, y);
  return y + lines.length * 5 + 2;
}

// === Public generators ===

export function generateAnalysisReport(
  ctx: ReportContext,
  sample: {
    type: "soil" | "leaf";
    collected_at: string;
    crop?: string | null;
    values: Record<string, number | null>;
    classification?: Record<string, { level: string; value: number }> | null;
  },
): Blob {
  const doc = new jsPDF();
  header(doc, sample.type === "soil" ? "Análise de Solo" : "Análise Foliar", ctx);

  let y = 56;
  y = sectionTitle(doc, "Identificação", y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Cultura", sample.crop ?? "—"],
      ["Coletado em", new Date(sample.collected_at).toLocaleDateString("pt-BR")],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = sectionTitle(doc, "Resultados", y);
  const rows = Object.entries(sample.values)
    .filter(([, v]) => v != null)
    .map(([k, v]) => {
      const cls = sample.classification?.[k];
      return [
        k.toUpperCase(),
        String(v),
        cls?.level ? cls.level.charAt(0).toUpperCase() + cls.level.slice(1) : "—",
      ];
    });
  autoTable(doc, {
    startY: y,
    head: [["Nutriente", "Valor", "Classificação"]],
    body: rows,
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    styles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const lvl = String(data.cell.raw ?? "").toLowerCase();
        if (lvl.startsWith("baixo")) data.cell.styles.textColor = [220, 38, 38];
        else if (lvl.startsWith("médio") || lvl.startsWith("medio")) data.cell.styles.textColor = [202, 138, 4];
        else if (lvl.startsWith("adequado")) data.cell.styles.textColor = [22, 163, 74];
        else if (lvl.startsWith("alto")) data.cell.styles.textColor = [37, 99, 235];
      }
    },
  });

  footer(doc);
  return doc.output("blob");
}

export function generateRecommendationReport(
  ctx: ReportContext,
  rec: { prompt: string; response: string; model: string; created_at: string },
): Blob {
  const doc = new jsPDF();
  header(doc, "Recomendação Agronômica", ctx);

  let y = 56;
  y = sectionTitle(doc, "Contexto", y);
  y = paragraph(doc, rec.prompt, y);
  y += 4;

  y = sectionTitle(doc, "Recomendação", y);
  // strip markdown lightly
  const clean = rec.response
    .replace(/[*_`#>]/g, "")
    .replace(/\n{3,}/g, "\n\n");
  const lines = doc.splitTextToSize(clean, doc.internal.pageSize.getWidth() - 28);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  let cursor = y;
  for (const line of lines) {
    if (cursor > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      cursor = 20;
    }
    doc.text(line, 14, cursor);
    cursor += 5;
  }

  cursor += 6;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Modelo: ${rec.model}  •  Gerado em: ${new Date(rec.created_at).toLocaleString("pt-BR")}`, 14, cursor);

  footer(doc);
  return doc.output("blob");
}

export function generateNdviReport(
  ctx: ReportContext,
  readings: { captured_at: string; ndvi_mean: number | null; ndvi_min: number | null; ndvi_max: number | null; source: string | null }[],
): Blob {
  const doc = new jsPDF();
  header(doc, "Relatório NDVI", ctx);

  const last = readings[readings.length - 1];
  let y = 56;
  y = sectionTitle(doc, "Resumo", y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Leituras", String(readings.length)],
      ["Última leitura", last ? new Date(last.captured_at).toLocaleDateString("pt-BR") : "—"],
      ["NDVI atual", last?.ndvi_mean != null ? last.ndvi_mean.toFixed(3) : "—"],
      ["Fonte", last?.source ?? "—"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Mini-chart: simple line plot
  if (readings.length > 1) {
    y = sectionTitle(doc, "Série temporal", y);
    const x0 = 18, y0 = y + 50, w = doc.internal.pageSize.getWidth() - 36, h = 45;
    // axes
    doc.setDrawColor(203, 213, 225);
    doc.line(x0, y0, x0 + w, y0);
    doc.line(x0, y0, x0, y0 - h);
    // gridlines 0.0, 0.5, 1.0
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    [0, 0.5, 1].forEach((v) => {
      const yy = y0 - h * v;
      doc.setDrawColor(241, 245, 249);
      doc.line(x0, yy, x0 + w, yy);
      doc.text(v.toFixed(1), x0 - 6, yy + 1.5);
    });
    // points
    const xs = readings.map((_, i) => x0 + (w * i) / Math.max(readings.length - 1, 1));
    const ys = readings.map((r) => y0 - h * Math.min(1, Math.max(0, r.ndvi_mean ?? 0)));
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.8);
    for (let i = 1; i < xs.length; i++) doc.line(xs[i - 1], ys[i - 1], xs[i], ys[i]);
    doc.setFillColor(...PRIMARY);
    xs.forEach((x, i) => doc.circle(x, ys[i], 1.2, "F"));
    y = y0 + 8;
  }

  y += 4;
  y = sectionTitle(doc, "Histórico", y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Médio", "Mín", "Máx", "Fonte"]],
    body: readings.map((r) => [
      new Date(r.captured_at).toLocaleDateString("pt-BR"),
      r.ndvi_mean?.toFixed(3) ?? "—",
      r.ndvi_min?.toFixed(3) ?? "—",
      r.ndvi_max?.toFixed(3) ?? "—",
      r.source ?? "—",
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    styles: { fontSize: 9 },
  });

  footer(doc);
  return doc.output("blob");
}

export function generateConsolidatedReport(
  ctx: ReportContext,
  data: {
    soil: any[];
    leaf: any[];
    ndviLast?: { captured_at: string; ndvi_mean: number | null } | null;
    recommendations: { created_at: string; response: string }[];
  },
): Blob {
  const doc = new jsPDF();
  header(doc, "Relatório Consolidado", ctx);

  let y = 56;
  y = sectionTitle(doc, "Visão geral", y);
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Análises de solo", String(data.soil.length)],
      ["Análises foliares", String(data.leaf.length)],
      ["NDVI mais recente", data.ndviLast?.ndvi_mean != null
        ? `${data.ndviLast.ndvi_mean.toFixed(3)} (${new Date(data.ndviLast.captured_at).toLocaleDateString("pt-BR")})`
        : "—"],
      ["Recomendações IA", String(data.recommendations.length)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (data.soil.length) {
    y = sectionTitle(doc, "Últimas análises de solo", y);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Cultura", "pH", "M.O.", "P", "K"]],
      body: data.soil.slice(0, 8).map((s) => [
        new Date(s.collected_at).toLocaleDateString("pt-BR"),
        s.crop ?? "—",
        s.ph ?? "—",
        s.organic_matter ?? "—",
        s.phosphorus ?? "—",
        s.potassium ?? "—",
      ]),
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (data.leaf.length) {
    y = sectionTitle(doc, "Últimas análises foliares", y);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Cultura", "N", "P", "K", "Ca"]],
      body: data.leaf.slice(0, 8).map((s) => [
        new Date(s.collected_at).toLocaleDateString("pt-BR"),
        s.crop ?? "—",
        s.n ?? "—",
        s.p ?? "—",
        s.k ?? "—",
        s.ca ?? "—",
      ]),
      headStyles: { fillColor: PRIMARY, textColor: 255 },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (data.recommendations.length) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, "Última recomendação IA", y);
    const last = data.recommendations[0];
    const clean = last.response.replace(/[*_`#>]/g, "").slice(0, 1500);
    paragraph(doc, clean, y);
  }

  footer(doc);
  return doc.output("blob");
}
