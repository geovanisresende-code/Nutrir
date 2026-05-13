/**
 * Gerador de PDF unificado Nutrir.
 * Encaminha para os geradores específicos garantindo cabeçalho, rodapé e
 * formatação padrão da marca em todos os documentos.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nutrirLogo from "@/assets/nutrir-logo.jpg";
import { formatBRL } from "./precos-engine";
import { gerarPedidoPDF, type PedidoPDFInput } from "./pedido-pdf";
import { gerarOrcamentoPDF } from "./orcamento-consultoria-pdf";
import { gerarPdfFoliar } from "./foliar-pdf";
import { gerarPdfNPK } from "./npk-pdf";
import { gerarPdfUreia } from "./ureia-pdf";

const GREEN: [number, number, number] = [27, 67, 50];
const GOLD: [number, number, number] = [200, 161, 89];
const MUTED: [number, number, number] = [110, 116, 125];

export type TipoPDF =
  | "pedido"
  | "orcamento_consultoria"
  | "foliar"
  | "npk"
  | "ureia"
  | "generico";

export interface CabecalhoPDF {
  titulo: string;
  subtitulo?: string;
  numero?: string;
  data?: string;
  cliente?: string;
}

export interface DocumentoGenerico {
  cabecalho: CabecalhoPDF;
  secoes: Array<{
    titulo: string;
    paragrafos?: string[];
    tabela?: { head: string[]; body: (string | number)[][] };
  }>;
  totais?: { label: string; valor: number }[];
  rodape?: string;
}

export function aplicarCabecalho(doc: jsPDF, cab: CabecalhoPDF) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 28, "F");
  try {
    doc.addImage(nutrirLogo, "JPEG", 10, 5, 18, 18);
  } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(cab.titulo, 32, 13);
  if (cab.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(cab.subtitulo, 32, 19);
  }
  if (cab.numero || cab.data) {
    doc.setFontSize(9);
    const meta = [cab.numero && `Nº ${cab.numero}`, cab.data && cab.data]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(meta, pw - 10, 13, { align: "right" });
  }
  doc.setTextColor(0, 0, 0);
}

export function aplicarRodape(doc: jsPDF, texto?: string) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(10, ph - 14, pw - 10, ph - 14);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      texto || "Nutrir Agro · Documento gerado pelo sistema",
      10,
      ph - 8,
    );
    doc.text(`Página ${i} de ${total}`, pw - 10, ph - 8, { align: "right" });
  }
}

function gerarGenerico(d: DocumentoGenerico): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  aplicarCabecalho(doc, d.cabecalho);
  let y = 38;
  if (d.cabecalho.cliente) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Cliente: ${d.cabecalho.cliente}`, 10, y);
    y += 8;
  }
  for (const sec of d.secoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text(sec.titulo, 10, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    if (sec.paragrafos) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const p of sec.paragrafos) {
        const lines = doc.splitTextToSize(p, 190);
        doc.text(lines, 10, y);
        y += lines.length * 4.5 + 2;
      }
    }
    if (sec.tabela) {
      autoTable(doc, {
        startY: y,
        head: [sec.tabela.head],
        body: sec.tabela.body.map((r) => r.map((c) => String(c))),
        theme: "striped",
        headStyles: { fillColor: GREEN, textColor: 255 },
        styles: { fontSize: 9 },
        margin: { left: 10, right: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    y += 4;
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }
  if (d.totais && d.totais.length) {
    y += 4;
    doc.setDrawColor(...GOLD);
    doc.line(120, y, 200, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    for (const t of d.totais) {
      doc.text(t.label, 120, y);
      doc.text(formatBRL(t.valor), 200, y, { align: "right" });
      y += 5;
    }
  }
  aplicarRodape(doc, d.rodape);
  return doc.output("blob");
}

export async function gerarPDF(
  tipo: TipoPDF,
  dados: any,
  extra?: any,
): Promise<Blob | void> {
  switch (tipo) {
    case "pedido":
      return gerarPedidoPDF(dados as PedidoPDFInput);
    case "orcamento_consultoria":
      return gerarOrcamentoPDF(dados);
    case "foliar":
      return gerarPdfFoliar(dados, extra);
    case "npk":
      return gerarPdfNPK(dados, extra);
    case "ureia":
      return gerarPdfUreia(dados, extra);
    case "generico":
    default:
      return gerarGenerico(dados as DocumentoGenerico);
  }
}

export function baixarPDF(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome.endsWith(".pdf") ? nome : `${nome}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/*
 * ────────────────────────────────────────────────────────────────────────
 * Orçamento Consultoria + Nutrição (unificado, "Canva-style")
 *  - Capa
 *  - Detalhamento por fazenda/cultivo
 *  - Resumo financeiro
 *  - Comparativo Convencional × Programa Nutrir
 * ────────────────────────────────────────────────────────────────────────
 */
export interface OrcamentoCompletoInput {
  cliente: string;
  cliente_doc?: string;
  fazendas: Array<{
    id: string;
    nome: string;
    cultivos: Array<{
      cultura_nome: string;
      cultura_tipo: string;
      area_ha: number;
      modo_grid: "gride" | "talhao";
      grid_ha: number;
      n_talhoes: number;
      n_amostras_ciclo: number;
      adubacoes: Record<string, boolean>;
      obs: string;
    }>;
  }>;
  resumo: {
    totalArea: number;
    totalAmostras: number;
    subtotalConsultoria: number;
    valor_medio_ha: number;
    desconto: number;
    total: number;
  };
  preco_amostra: number;
  desconto_pct: number;
}

export async function gerarOrcamentoCompletoPDF(input: OrcamentoCompletoInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Capa ────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, ph, "F");
  try {
    doc.addImage(nutrirLogo, "JPEG", pw / 2 - 22, 60, 44, 44);
  } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("Programa Nutrir", pw / 2, 130, { align: "center" });
  doc.setFontSize(16);
  doc.text("Orçamento de Consultoria + Nutrição", pw / 2, 142, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(pw / 2 - 30, 150, pw / 2 + 30, 150);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(input.cliente, pw / 2, 168, { align: "center" });
  if (input.cliente_doc) {
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(input.cliente_doc, pw / 2, 175, { align: "center" });
  }
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(new Date().toLocaleDateString("pt-BR"), pw / 2, ph - 20, { align: "center" });

  // ── Página 2: detalhamento da consultoria ──────────────────────────
  doc.addPage();
  aplicarCabecalho(doc, {
    titulo: "Detalhamento da Consultoria",
    subtitulo: input.cliente,
    data: new Date().toLocaleDateString("pt-BR"),
  });

  let y = 38;
  doc.setTextColor(0, 0, 0);
  for (const f of input.fazendas) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text(f.nome, 10, y);
    doc.setTextColor(0, 0, 0);
    y += 5;

    const body = f.cultivos.map((c) => {
      const grid = c.modo_grid === "gride" ? c.grid_ha : c.area_ha / Math.max(1, c.n_talhoes);
      const amostras = grid && c.area_ha ? Math.ceil((c.area_ha / grid) * (c.n_amostras_ciclo / 4)) : 0;
      const custoHa = c.area_ha ? (amostras * input.preco_amostra) / c.area_ha : 0;
      const subtotal = amostras * input.preco_amostra;
      const adub = Object.entries(c.adubacoes).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(" + ") || "—";
      return [
        c.cultura_nome,
        c.area_ha.toLocaleString("pt-BR") + " ha",
        c.modo_grid === "gride" ? c.grid_ha + " ha" : `${c.n_talhoes} talhões`,
        String(amostras),
        formatBRL(custoHa) + "/ha",
        formatBRL(subtotal),
        adub,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Cultura", "Área", "Gride/Talhão", "Amostras", "Custo/ha", "Subtotal", "Adubação"]],
      body,
      theme: "striped",
      headStyles: { fillColor: GREEN, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 20; }
  }

  // ── Resumo financeiro ──────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 30; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text("Resumo Financeiro", 10, y);
  y += 6;
  doc.setDrawColor(...GOLD);
  doc.line(10, y, pw - 10, y);
  y += 4;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows: Array<[string, string]> = [
    ["Área total",                input.resumo.totalArea.toLocaleString("pt-BR") + " ha"],
    ["Amostras totais",           String(input.resumo.totalAmostras)],
    ["Preço por amostra",         formatBRL(input.preco_amostra)],
    ["Subtotal consultoria",      formatBRL(input.resumo.subtotalConsultoria)],
    [`Desconto (${input.desconto_pct}%)`, "- " + formatBRL(input.resumo.desconto)],
  ];
  for (const [l, v] of rows) {
    doc.text(l, 10, y);
    doc.text(v, pw - 10, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("TOTAL", 10, y + 2);
  doc.text(formatBRL(input.resumo.total), pw - 10, y + 2, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Valor médio por hectare: ${formatBRL(input.resumo.valor_medio_ha)}`, 10, y);

  // ── Comparativo Convencional × Nutrir ──────────────────────────────
  doc.addPage();
  aplicarCabecalho(doc, {
    titulo: "Comparativo Convencional × Programa Nutrir",
    subtitulo: input.cliente,
  });
  let y2 = 38;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(
    "Esta análise estima economia/ganho com o Programa Nutrir frente à adubação convencional. " +
    "Considera redução de 60% N, 50% P e 40% K no NPK Nutrir e ganho de eficiência via complexação.",
    10, y2, { maxWidth: pw - 20 },
  );
  y2 += 18;
  autoTable(doc, {
    startY: y2,
    head: [["Item", "Convencional", "Programa Nutrir", "Δ"]],
    body: [
      ["Consultoria/ha",        "—",        formatBRL(input.resumo.valor_medio_ha), "+"],
      ["Custo N + P + K",       "100%",     "≈ 50%",                                 "-50%"],
      ["Adicional foliar",      "—",        "incluso",                               "+"],
      ["Acompanhamento técnico","Esporádico","8 visitas / ciclo",                    "+"],
      ["Ganho de produtividade","—",        "+10 a 25%",                             "+"],
    ],
    theme: "grid",
    headStyles: { fillColor: GREEN, textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 10, right: 10 },
  });

  aplicarRodape(doc, "Programa Nutrir · AgroMap × Nutrir Unificado");

  const blob = doc.output("blob");
  baixarPDF(blob, `orcamento-nutrir-${input.cliente.replace(/\s+/g, "_").toLowerCase()}`);
  return blob;
}
