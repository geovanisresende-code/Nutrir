/**
 * PDF de Relatório Final de Campo de Teste — estilo Canva moderno.
 *  - Capa com nome do produto/cliente/cultura
 *  - Dados do teste (área, plantio, status)
 *  - Markdown do relatório IA convertido em texto formatado
 *  - Tabela de acompanhamentos
 *  - Galeria de fotos (até 6 thumbnails)
 *  - Série NDVI (se disponível)
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nutrirLogo from "@/assets/1.png";
import { supabase } from "@/integrations/supabase/client";

const GREEN: [number, number, number] = [27, 67, 50];
const GOLD: [number, number, number] = [200, 161, 89];
const MUTED: [number, number, number] = [110, 116, 125];

export interface CampoTesteInput {
  campo: any;                  // row de nutrir_campos_teste
  cliente?: { razao_social?: string; cidade?: string; uf?: string } | null;
  relatorios: any[];           // acompanhamentos
  ndvi_serie?: any[];          // série NDVI opcional
}

/** Remove sintaxe markdown básica preservando legibilidade */
function stripMd(s: string): string {
  if (!s) return "";
  return s
    .replace(/^#{1,6}\s+/gm, "")    // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1")     // italic
    .replace(/`([^`]+)`/g, "$1")     // inline code
    .replace(/^\s*[-*]\s+/gm, "• ")  // bullets
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links
}

/** Quebra string em parágrafos com largura controlada */
function escreverParagrafos(doc: jsPDF, texto: string, x: number, y: number, maxWidth: number, lineH = 4.5) {
  const linhas = doc.splitTextToSize(texto, maxWidth);
  doc.text(linhas, x, y);
  return y + linhas.length * lineH;
}

async function downloadAsBlob(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("campos-teste-fotos").createSignedUrl(path, 60);
    if (!data?.signedUrl) return null;
    const resp = await fetch(data.signedUrl);
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarCampoTestePDF(input: CampoTesteInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const { campo, cliente, relatorios, ndvi_serie } = input;

  // ───── Capa ──────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, ph, "F");
  try { doc.addImage(nutrirLogo, "JPEG", pw/2 - 22, 50, 44, 44); } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Relatório de Campo de Teste", pw/2, 120, { align: "center" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(pw/2 - 30, 128, pw/2 + 30, 128);

  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text(campo.titulo ?? "Sem título", pw/2, 144, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(220, 220, 220);
  doc.text(`Cliente: ${cliente?.razao_social ?? "—"}`, pw/2, 160, { align: "center" });
  if (campo.cultura) doc.text(`Cultura: ${campo.cultura}`, pw/2, 168, { align: "center" });
  if (campo.variedade) doc.text(`Variedade: ${campo.variedade}`, pw/2, 176, { align: "center" });
  if (campo.area_total_ha) doc.text(`Área: ${campo.area_total_ha} ha`, pw/2, 184, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pw/2, ph - 18, { align: "center" });

  // ───── Página 2: ficha técnica ───────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ficha Técnica do Teste", 12, 14);

  let y = 32;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: [
      ["Cliente",        cliente?.razao_social ?? "—"],
      ["Localização",    [cliente?.cidade, cliente?.uf].filter(Boolean).join(" / ") || "—"],
      ["Cultura",        campo.cultura ?? "—"],
      ["Variedade",      campo.variedade ?? "—"],
      ["Data de plantio",campo.data_plantio ? new Date(campo.data_plantio).toLocaleDateString("pt-BR") : "—"],
      ["Área total",     campo.area_total_ha ? `${campo.area_total_ha} ha` : "—"],
      ["Status",         campo.status === "finalizado" ? "Finalizado" : campo.status === "em_andamento" ? "Em andamento" : campo.status],
      ["Produtos testados", Array.isArray(campo.produtos) ? campo.produtos.map((p: any) => p.nome).join(", ") : "—"],
    ],
    theme: "striped",
    headStyles: { fillColor: GREEN, textColor: 255 },
    margin: { left: 12, right: 12 },
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ───── Relatório IA (texto) ─────────────────────────────────────────
  if (campo.relatorio_final_resumo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text("Análise Técnica (IA)", 12, y);
    y += 6;
    doc.setDrawColor(...GOLD);
    doc.line(12, y, pw - 12, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    y = escreverParagrafos(doc, stripMd(campo.relatorio_final_resumo), 12, y, pw - 24);
    y += 6;
    if (y > 250) { doc.addPage(); y = 30; }
  }

  // ───── Acompanhamentos ──────────────────────────────────────────────
  if (relatorios && relatorios.length > 0) {
    if (y > 220) { doc.addPage(); y = 30; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text(`Acompanhamentos (${relatorios.length})`, 12, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Data", "Estágio", "NDVI", "Observação"]],
      body: relatorios.map(r => [
        r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—",
        r.estagio ?? "—",
        r.ndvi != null ? Number(r.ndvi).toFixed(2) : "—",
        r.observacao ?? "",
      ]),
      theme: "grid",
      headStyles: { fillColor: GREEN, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { cellWidth: 90 } },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ───── Série NDVI ───────────────────────────────────────────────────
  if (ndvi_serie && ndvi_serie.length > 0) {
    if (y > 230) { doc.addPage(); y = 30; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text(`Histórico NDVI (${ndvi_serie.length} leituras)`, 12, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Data", "NDVI médio", "Mín", "Máx", "Fonte"]],
      body: ndvi_serie.slice(0, 30).map(p => [
        p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—",
        p.ndvi_medio != null ? Number(p.ndvi_medio).toFixed(3) : "—",
        p.ndvi_min != null ? Number(p.ndvi_min).toFixed(3) : "—",
        p.ndvi_max != null ? Number(p.ndvi_max).toFixed(3) : "—",
        p.fonte ?? "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: GREEN, textColor: 255 },
      styles: { fontSize: 8 },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ───── Galeria de fotos (até 6) ─────────────────────────────────────
  const fotos: string[] = [];
  for (const r of (relatorios ?? [])) {
    if (Array.isArray(r.fotos)) for (const f of r.fotos) fotos.push(f);
    if (fotos.length >= 6) break;
  }
  if (fotos.length > 0) {
    doc.addPage();
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pw, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Galeria do Teste", 12, 14);

    let imgY = 32;
    const colW = (pw - 12 * 2 - 6) / 2;
    const colH = 70;
    let col = 0;
    for (const f of fotos.slice(0, 6)) {
      const dataUrl = await downloadAsBlob(f);
      if (!dataUrl) continue;
      const x = 12 + col * (colW + 6);
      try {
        doc.addImage(dataUrl, "JPEG", x, imgY, colW, colH);
      } catch {}
      col++;
      if (col === 2) {
        col = 0;
        imgY += colH + 6;
        if (imgY + colH > ph - 20) {
          doc.addPage();
          imgY = 32;
        }
      }
    }
  }

  // ───── Rodapé ───────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Programa Nutrir · Página ${p} de ${pages}`, pw/2, ph - 8, { align: "center" });
  }

  const blob = doc.output("blob");
  return blob;
}

export function baixarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
