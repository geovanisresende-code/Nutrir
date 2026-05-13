import jsPDF from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";

const PRIMARY: [number, number, number] = [22, 101, 52];
const MUTED: [number, number, number] = [100, 116, 139];

export const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("pt-BR");
};

export interface PdfDocOptions {
  title: string;
  subtitle?: string;
  org?: string;
}

export function newPdf({ title, subtitle, org }: PdfDocOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(org ?? "Nutrir AgTech", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("pt-BR"), pageW - 14, 10, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 32);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 38);
  }

  return { doc, cursorY: subtitle ? 44 : 38, pageW };
}

export function pdfTable(doc: jsPDF, opts: UserOptions) {
  autoTable(doc, {
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 2 },
    margin: { left: 14, right: 14 },
    ...opts,
  });
}

export function pdfFooter(doc: jsPDF, label?: string) {
  const pages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label ?? "Gerado pelo sistema Nutrir", 14, pageH - 8);
    doc.text(`Página ${i} de ${pages}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

export function savePdf(doc: jsPDF, filename: string) {
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function pdfSection(doc: jsPDF, y: number, title: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text(title, 14, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  doc.setTextColor(15, 23, 42);
  return y + 7;
}

export function pdfKeyValue(
  doc: jsPDF,
  y: number,
  pairs: [string, string][],
  cols = 2,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - 28) / cols;
  doc.setFontSize(9);
  let row = 0;
  let col = 0;
  pairs.forEach(([k, v]) => {
    const x = 14 + col * colW;
    const ly = y + row * 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(`${k}:`, x, ly);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const kWidth = doc.getTextWidth(`${k}: `);
    doc.text(String(v ?? "—"), x + kWidth, ly, { maxWidth: colW - kWidth - 2 });
    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
  });
  return y + (row + (col > 0 ? 1 : 0)) * 6 + 4;
}

// ============= Geradores específicos =============

export function pdfVisita(visita: any, cliente?: any, org?: string) {
  const { doc, cursorY } = newPdf({
    title: "Relatório de Visita",
    subtitle: `Visita de ${fmtDate(visita.data_visita)}`,
    org,
  });
  let y = cursorY;
  y = pdfSection(doc, y, "Dados gerais");
  y = pdfKeyValue(doc, y, [
    ["Cliente", cliente?.razao_social ?? visita.cliente_nome_livre ?? "—"],
    ["Cidade/UF", cliente ? `${cliente.cidade ?? "—"}/${cliente.uf ?? ""}` : "—"],
    ["Data", fmtDate(visita.data_visita)],
    ["Motivo", String(visita.motivo ?? "—").replace(/_/g, " ")],
    ["Alerta", String(visita.alerta_nivel ?? "—").replace(/_/g, " ")],
    ["Coordenadas",
      visita.latitude && visita.longitude
        ? `${Number(visita.latitude).toFixed(5)}, ${Number(visita.longitude).toFixed(5)}`
        : "—"],
  ]);

  y = pdfSection(doc, y, "Relato");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const relato = String(visita.relato ?? "—");
  const lines = doc.splitTextToSize(relato, doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, y);
  y += lines.length * 5 + 4;

  if (visita.observacao) {
    y = pdfSection(doc, y, "Observações");
    doc.setFontSize(10);
    const obs = doc.splitTextToSize(String(visita.observacao), doc.internal.pageSize.getWidth() - 28);
    doc.text(obs, 14, y);
  }

  pdfFooter(doc);
  return doc;
}

export function pdfPedido(pedido: any, itens: any[], cliente?: any, org?: string) {
  const { doc, cursorY } = newPdf({
    title: `Pedido ${pedido.numero ?? pedido.id?.slice(0, 8) ?? ""}`,
    subtitle: `Emitido em ${fmtDate(pedido.data_pedido)}`,
    org,
  });
  let y = cursorY;
  y = pdfSection(doc, y, "Cliente");
  y = pdfKeyValue(doc, y, [
    ["Razão social", cliente?.razao_social ?? "—"],
    ["CNPJ/CPF", cliente?.cnpj ?? cliente?.cpf ?? "—"],
    ["Cidade", cliente?.cidade ? `${cliente.cidade}/${cliente.uf ?? ""}` : "—"],
    ["Status", String(pedido.status ?? "—").replace(/_/g, " ")],
  ]);

  y = pdfSection(doc, y, "Itens");
  pdfTable(doc, {
    startY: y,
    head: [["Produto", "Embal.", "Qtd", "Preço un.", "Subtotal"]],
    body: (itens ?? []).map((it: any) => [
      it.produto_nome ?? "—",
      it.embalagem_nome ?? "—",
      Number(it.quantidade ?? 0).toLocaleString("pt-BR"),
      fmtBRL(Number(it.preco_unitario ?? 0)),
      fmtBRL(Number(it.quantidade ?? 0) * Number(it.preco_unitario ?? 0)),
    ]),
    foot: [[
      { content: "TOTAL", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(Number(pedido.total ?? 0)), styles: { fontStyle: "bold" } },
    ]],
  });

  // @ts-ignore
  y = (doc.lastAutoTable?.finalY ?? y) + 10;
  if (pedido.assinatura_nome) {
    y = pdfSection(doc, y, "Assinatura digital");
    y = pdfKeyValue(doc, y, [
      ["Assinado por", pedido.assinatura_nome],
      ["Data", fmtDate(pedido.assinatura_em)],
    ]);
  }
  pdfFooter(doc);
  return doc;
}

export function pdfCampoTeste(teste: any, cliente?: any, org?: string) {
  const { doc, cursorY } = newPdf({
    title: `Campo de Teste — ${teste.titulo ?? ""}`,
    subtitle: `Início ${fmtDate(teste.data_inicio)} · Status: ${String(teste.status ?? "").replace(/_/g, " ")}`,
    org,
  });
  let y = cursorY;
  y = pdfSection(doc, y, "Dados gerais");
  y = pdfKeyValue(doc, y, [
    ["Cliente", cliente?.razao_social ?? "—"],
    ["Cultura", teste.cultura ?? "—"],
    ["Variedade", teste.variedade ?? "—"],
    ["Plantio", fmtDate(teste.data_plantio)],
    ["Área", `${Number(teste.area_total_ha ?? 0).toLocaleString("pt-BR")} ha`],
    ["Coord. centro",
      teste.centro_lat && teste.centro_lng
        ? `${Number(teste.centro_lat).toFixed(5)}, ${Number(teste.centro_lng).toFixed(5)}`
        : "—"],
  ]);

  const produtos = Array.isArray(teste.produtos) ? teste.produtos : [];
  if (produtos.length) {
    y = pdfSection(doc, y, "Produtos testados");
    pdfTable(doc, {
      startY: y,
      head: [["Produto", "Área (ha)", "Dose/ha", "Estágio", "Obs."]],
      body: produtos.map((p: any) => [
        p.nome ?? p.produto_nome ?? "—",
        p.area ?? "—",
        p.dose ?? "—",
        p.estagio ?? "—",
        p.obs ?? "—",
      ]),
    });
    // @ts-ignore
    y = (doc.lastAutoTable?.finalY ?? y) + 6;
  }

  if (teste.observacoes) {
    y = pdfSection(doc, y, "Observações");
    doc.setFontSize(10);
    const obs = doc.splitTextToSize(String(teste.observacoes), doc.internal.pageSize.getWidth() - 28);
    doc.text(obs, 14, y);
  }
  pdfFooter(doc);
  return doc;
}

export function pdfRdvMensal(rdv: any[], periodo: string, repNome: string, org?: string) {
  const { doc, cursorY } = newPdf({
    title: "Relatório de Despesas de Viagem (RDV)",
    subtitle: `${repNome} · ${periodo}`,
    org,
  });
  const total = rdv.reduce((s, r: any) => s + Number(r.valor ?? 0), 0);
  pdfTable(doc, {
    startY: cursorY,
    head: [["Data", "Tipo", "Descrição", "Valor"]],
    body: rdv.map((r: any) => [
      fmtDate(r.data),
      String(r.tipo ?? "—").replace(/_/g, " "),
      r.descricao ?? "—",
      fmtBRL(Number(r.valor ?? 0)),
    ]),
    foot: [[
      { content: "TOTAL", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(total), styles: { fontStyle: "bold" } },
    ]],
  });
  pdfFooter(doc);
  return doc;
}

export function pdfComissoes(comissoes: any[], periodo: string, repNome: string, org?: string) {
  const { doc, cursorY } = newPdf({
    title: "Demonstrativo de Comissões",
    subtitle: `${repNome} · ${periodo}`,
    org,
  });
  const total = comissoes.reduce((s, c: any) => s + Number(c.valor ?? 0), 0);
  pdfTable(doc, {
    startY: cursorY,
    head: [["Mês", "Cliente", "Pedido", "Base", "%", "Valor", "Status"]],
    body: comissoes.map((c: any) => [
      fmtDate(c.mes_referencia),
      c.nutrir_clientes?.razao_social ?? "—",
      c.pedido_id?.slice?.(0, 8) ?? "—",
      fmtBRL(Number(c.base_calculo ?? 0)),
      `${Number(c.percentual ?? 0).toFixed(2)}%`,
      fmtBRL(Number(c.valor ?? 0)),
      String(c.status ?? "").replace(/_/g, " "),
    ]),
    foot: [[
      { content: "TOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(total), styles: { fontStyle: "bold" } },
      "",
    ]],
  });
  pdfFooter(doc);
  return doc;
}
