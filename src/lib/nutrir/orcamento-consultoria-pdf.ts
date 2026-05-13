import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nutrirLogo from "@/assets/nutrir-logo.jpg";
import { formatBRL, formatNum, type ItemOrcamento, type TotaisOrcamento } from "./orcamento-consultoria-engine";

export interface OrcamentoPDFInput {
  numero?: number | null;
  cliente_nome: string;
  fazenda?: string | null;
  cidade?: string | null;
  uf?: string | null;
  area_total: number;
  prazo_pagamento?: string | null;
  tipo_cliente?: string | null;
  itens: ItemOrcamento[];
  totais: TotaisOrcamento;
  observacoes?: string | null;
  data?: Date;
  desconto_percentual?: number;
  desconto_valor?: number;
  valor_final?: number;
}

// Cores Nutrir (em RGB para jsPDF)
const NUTRIR_GREEN: [number, number, number] = [27, 67, 50];      // verde escuro
const NUTRIR_GOLD: [number, number, number] = [200, 161, 89];     // dourado
const NUTRIR_LIGHT: [number, number, number] = [248, 245, 238];   // cream
const TEXT_DARK: [number, number, number] = [33, 41, 50];
const TEXT_MUTED: [number, number, number] = [110, 116, 125];

// Carrega logo como dataURL (já está importado como módulo, vite resolve para URL)
async function loadImageAsDataURL(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Desenha um ícone simples para uma cultura, baseado no nome (SVG-like com primitivas jsPDF).
// Retorna como dataURL PNG via canvas off-screen.
function drawCulturaIconCanvas(nome: string): string {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d")!;
  const key = nome.toLowerCase();
  // fundo circular
  const palette = pickPalette(key);
  ctx.fillStyle = palette.bg;
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = palette.fg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = palette.fg;
  ctx.font = "bold 28px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(emojiFor(key), 32, 34);
  return c.toDataURL("image/png");
}

function pickPalette(key: string): { bg: string; fg: string } {
  if (/soja|feijão|amendoim/.test(key)) return { bg: "#ECFDF5", fg: "#047857" };
  if (/milho|trigo|aveia|cevada|sorgo|arroz|centeio|triticale|milheto|girassol|canola/.test(key)) return { bg: "#FEF9C3", fg: "#A16207" };
  if (/café|cacau/.test(key)) return { bg: "#FEF3C7", fg: "#78350F" };
  if (/cana|pastagem|erva-mate/.test(key)) return { bg: "#ECFCCB", fg: "#3F6212" };
  if (/laranja|limão/.test(key)) return { bg: "#FFEDD5", fg: "#C2410C" };
  if (/banana|abacaxi|mamão|coco|dendê/.test(key)) return { bg: "#FEF9C3", fg: "#CA8A04" };
  if (/uva|açaí|maracujá/.test(key)) return { bg: "#F3E8FF", fg: "#6B21A8" };
  if (/maçã|manga|melancia|melão|goiaba/.test(key)) return { bg: "#FEE2E2", fg: "#B91C1C" };
  if (/batata|cenoura|mandioca|cebola|alho|tomate/.test(key)) return { bg: "#FFEDD5", fg: "#9A3412" };
  if (/eucalipto|pinus|seringueira/.test(key)) return { bg: "#DCFCE7", fg: "#166534" };
  if (/algodão|tabaco|gergelim|mamona|guaraná|pimenta/.test(key)) return { bg: "#F1F5F9", fg: "#334155" };
  return { bg: "#ECFDF5", fg: "#047857" };
}

function emojiFor(key: string): string {
  if (/soja|feijão/.test(key)) return "🫘";
  if (/milho/.test(key)) return "🌽";
  if (/trigo|aveia|cevada|sorgo|centeio|triticale|milheto/.test(key)) return "🌾";
  if (/arroz/.test(key)) return "🍚";
  if (/café/.test(key)) return "☕";
  if (/cacau/.test(key)) return "🍫";
  if (/cana/.test(key)) return "🎋";
  if (/laranja/.test(key)) return "🍊";
  if (/limão/.test(key)) return "🍋";
  if (/banana/.test(key)) return "🍌";
  if (/abacaxi/.test(key)) return "🍍";
  if (/mamão|manga/.test(key)) return "🥭";
  if (/coco|dendê/.test(key)) return "🥥";
  if (/uva/.test(key)) return "🍇";
  if (/maçã/.test(key)) return "🍎";
  if (/melancia/.test(key)) return "🍉";
  if (/melão/.test(key)) return "🍈";
  if (/goiaba|maracujá/.test(key)) return "🥝";
  if (/açaí/.test(key)) return "🫐";
  if (/batata|mandioca/.test(key)) return "🥔";
  if (/cenoura/.test(key)) return "🥕";
  if (/cebola/.test(key)) return "🧅";
  if (/alho/.test(key)) return "🧄";
  if (/tomate/.test(key)) return "🍅";
  if (/eucalipto|pinus|seringueira/.test(key)) return "🌳";
  if (/girassol/.test(key)) return "🌻";
  if (/algodão/.test(key)) return "☁️";
  if (/pastagem|erva-mate/.test(key)) return "🌿";
  if (/amendoim/.test(key)) return "🥜";
  if (/pimenta/.test(key)) return "🌶️";
  if (/tabaco/.test(key)) return "🍃";
  return "🌱";
}

// Ícone PXRF (espectrômetro de raio-X de mão) desenhado em canvas
function drawPXRFIcon(): string {
  const c = document.createElement("canvas");
  c.width = 96; c.height = 96;
  const ctx = c.getContext("2d")!;
  // fundo
  ctx.fillStyle = "#F8F5EE";
  ctx.beginPath(); ctx.roundRect(2, 2, 92, 92, 12); ctx.fill();
  ctx.strokeStyle = "#1B4332"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(2, 2, 92, 92, 12); ctx.stroke();

  // corpo do equipamento (pistola pXRF)
  ctx.fillStyle = "#1B4332";
  // cabo
  ctx.beginPath(); ctx.roundRect(28, 44, 18, 36, 4); ctx.fill();
  // corpo principal
  ctx.beginPath(); ctx.roundRect(20, 22, 50, 28, 6); ctx.fill();
  // tela
  ctx.fillStyle = "#C8A159";
  ctx.beginPath(); ctx.roundRect(26, 28, 22, 14, 2); ctx.fill();
  // botão
  ctx.fillStyle = "#C8A159";
  ctx.beginPath(); ctx.arc(60, 36, 4, 0, Math.PI * 2); ctx.fill();
  // bico/sensor
  ctx.fillStyle = "#1B4332";
  ctx.beginPath(); ctx.roundRect(70, 30, 14, 12, 2); ctx.fill();
  // raios saindo do sensor (simbolizando análise)
  ctx.strokeStyle = "#C8A159"; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(86, 36);
    ctx.lineTo(94, 30 + i * 6);
    ctx.stroke();
  }
  return c.toDataURL("image/png");
}

// Desenha o logo Nutrir com efeito "3D" (medalhão dourado com sombra) — sem retângulo branco sobre o verde
function drawLogoMedalhao(logo: string): string {
  const c = document.createElement("canvas");
  const S = 256;
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, S, S);

  // sombra externa (efeito de profundidade 3D)
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  // anel dourado (gradiente radial — efeito metálico 3D)
  const ring = ctx.createRadialGradient(S/2 - 30, S/2 - 30, 20, S/2, S/2, S/2 - 6);
  ring.addColorStop(0, "#F5DC93");
  ring.addColorStop(0.45, "#C8A159");
  ring.addColorStop(1, "#8C6A2A");
  ctx.fillStyle = ring;
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 6, 0, Math.PI * 2); ctx.fill();

  // remove sombra para o miolo
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // miolo verde escuro (fundo do logo, casa com a faixa do header)
  ctx.fillStyle = "#1B4332";
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 18, 0, Math.PI * 2); ctx.fill();

  // recorta para imagem ficar redonda dentro do miolo
  ctx.save();
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 22, 0, Math.PI * 2); ctx.clip();
  const img = new Image();
  // o desenho da imagem é síncrono apenas se já carregada; usamos um truque com data URL pré-resolvido (logo já vem como dataURL)
  img.src = logo;
  // como pode não estar pronto, devolvemos uma promise via evento — mas para manter a API atual, faremos draw síncrono se já estiver carregada
  if (img.complete && img.naturalWidth > 0) {
    const pad = 28;
    ctx.drawImage(img, pad, pad, S - pad * 2, S - pad * 2);
  }
  ctx.restore();

  // brilho superior (highlight 3D)
  const gloss = ctx.createLinearGradient(0, 10, 0, S/2);
  gloss.addColorStop(0, "rgba(255,255,255,0.35)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(S/2, S/2 - 30, S/2 - 40, S/4, 0, 0, Math.PI * 2);
  ctx.fill();

  return c.toDataURL("image/png");
}

// Versão assíncrona que garante que a imagem está carregada antes do toDataURL
async function drawLogoMedalhaoAsync(logoDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const S = 256;
      c.width = S; c.height = S;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, S, S);

      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 6;

      const ring = ctx.createRadialGradient(S/2 - 30, S/2 - 30, 20, S/2, S/2, S/2 - 6);
      ring.addColorStop(0, "#F5DC93");
      ring.addColorStop(0.45, "#C8A159");
      ring.addColorStop(1, "#8C6A2A");
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 6, 0, Math.PI * 2); ctx.fill();

      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      ctx.fillStyle = "#1B4332";
      ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 18, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 22, 0, Math.PI * 2); ctx.clip();
      const pad = 26;
      ctx.drawImage(img, pad, pad, S - pad * 2, S - pad * 2);
      ctx.restore();

      // anel interno fino dourado
      ctx.strokeStyle = "#C8A159"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 22, 0, Math.PI * 2); ctx.stroke();

      // brilho superior (highlight 3D)
      const gloss = ctx.createLinearGradient(0, 10, 0, S/2);
      gloss.addColorStop(0, "rgba(255,255,255,0.38)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.ellipse(S/2, S/2 - 30, S/2 - 40, S/4, 0, 0, Math.PI * 2);
      ctx.fill();

      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(logoDataUrl);
    img.src = logoDataUrl;
  });
}

function header(doc: jsPDF, logoMedal: string, pxrf: string, numero?: number | null, data?: Date) {
  const W = doc.internal.pageSize.getWidth();
  // faixa superior verde com gradiente simulado (duas faixas)
  doc.setFillColor(...NUTRIR_GREEN);
  doc.rect(0, 0, W, 32, "F");
  // sombra inferior simulada
  doc.setFillColor(20, 50, 38);
  doc.rect(0, 30, W, 2, "F");
  // faixa dourada fina
  doc.setFillColor(...NUTRIR_GOLD);
  doc.rect(0, 32, W, 1.2, "F");

  // logo em medalhão (PNG transparente — sem fundo branco)
  try { doc.addImage(logoMedal, "PNG", 10, 4, 24, 24); } catch { /* ignore */ }

  // título
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NUTRIR AgTech", 38, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Nutrição com Inteligência Regenerativa", 38, 19.5);
  doc.setFontSize(7.5);
  doc.setTextColor(...NUTRIR_GOLD);
  doc.text("PROPOSTA COMERCIAL — ANÁLISE FOLIAR PXRF", 38, 24);

  // pxrf icon (canto direito)
  try { doc.addImage(pxrf, "PNG", W - 30, 4, 24, 24); } catch { /* ignore */ }

  // número e data
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const dataFmt = (data ?? new Date()).toLocaleDateString("pt-BR");
  const numFmt = numero ? `Nº ${String(numero).padStart(5, "0")}` : "Rascunho";
  doc.text(`${numFmt}  ·  ${dataFmt}`, W - 34, 24, { align: "right" });
}

function footer(doc: jsPDF, page: number, total: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...NUTRIR_GOLD);
  doc.setLineWidth(0.4);
  doc.line(12, H - 14, W - 12, H - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("NUTRIR AgTech · Análises foliares por espectrometria de raio-X (PXRF)", 12, H - 9);
  doc.text(`Página ${page} de ${total}`, W - 12, H - 9, { align: "right" });
}

export async function gerarOrcamentoPDF(input: OrcamentoPDFInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  const logoOriginal = await loadImageAsDataURL(nutrirLogo);
  const logo = await drawLogoMedalhaoAsync(logoOriginal);
  const pxrf = drawPXRFIcon();

  header(doc, logo, pxrf, input.numero, input.data);

  // BLOCO CLIENTE
  let y = 42;
  doc.setFillColor(...NUTRIR_LIGHT);
  doc.roundedRect(12, y, W - 24, 32, 2, 2, "F");
  doc.setTextColor(...NUTRIR_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO CLIENTE", 16, y + 6);
  doc.setDrawColor(...NUTRIR_GOLD);
  doc.setLineWidth(0.3);
  doc.line(16, y + 7.5, 60, y + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const colL = 16, colR = W / 2 + 4;
  doc.text(`Cliente: ${input.cliente_nome || "—"}`, colL, y + 14);
  doc.text(`Fazenda: ${input.fazenda || "—"}`, colL, y + 20);
  doc.text(`Localização: ${[input.cidade, input.uf].filter(Boolean).join(" / ") || "—"}`, colL, y + 26);
  doc.text(`Tipo: ${input.tipo_cliente || "Produtor Rural"}`, colR, y + 14);
  doc.text(`Área Total: ${formatNum(input.area_total, 1)} ha`, colR, y + 20);
  doc.text(`Prazo: ${input.prazo_pagamento || "90 dias"}`, colR, y + 26);

  // BLOCO ITENS — gera ícones e tabela
  y = 76;
  doc.setTextColor(...NUTRIR_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DETALHAMENTO DO ORÇAMENTO", 12, y);
  doc.setDrawColor(...NUTRIR_GOLD);
  doc.line(12, y + 1.5, 78, y + 1.5);

  y += 4;

  const rows = input.itens.map((it, idx) => {
    const icon = drawCulturaIconCanvas(it.cultura_nome);
    const metodoTxt = it.metodo_amostragem === "talhoes"
      ? `Talhões: ${it.numero_talhoes} × ${it.amostras_por_talhao} am.`
      : `Gride ${formatNum(it.grid_ha, 1)} ha`;
    return {
      idx: idx + 1,
      icon,
      cultura: it.cultura_nome,
      area: formatNum(it.area_ha, 1),
      metodo: metodoTxt,
      amostras: it.total_amostras.toString(),
      valorHa: formatBRL(it.valor_ha),
      subtotal: formatBRL(it.subtotal),
    };
  });

  autoTable(doc, {
    startY: y + 2,
    head: [["#", "", "Cultura", "Área (ha)", "Método", "Amostras", "R$/ha", "Subtotal"]],
    body: rows.map(r => [r.idx, "", r.cultura, r.area, r.metodo, r.amostras, r.valorHa, r.subtotal]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.4, textColor: TEXT_DARK, lineColor: [220, 215, 200], lineWidth: 0.2 },
    headStyles: { fillColor: NUTRIR_GREEN, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 8.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 10, halign: "center" },
      2: { halign: "left", cellWidth: 42 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "left", cellWidth: 34, fontSize: 8 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", cellWidth: 30, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [252, 250, 245] },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const r = rows[data.row.index];
        if (r) {
          const x = data.cell.x + 1.5;
          const cy = data.cell.y + 1.2;
          try { doc.addImage(r.icon, "PNG", x, cy, 6.5, 6.5); } catch {/*noop*/}
        }
      }
    },
    margin: { left: 12, right: 12 },
  });

  // TOTAIS — caixa destaque (3 colunas centralizadas, sem risco de sobreposição)
  let ay = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (ay > 235) { doc.addPage(); header(doc, logo, pxrf, input.numero, input.data); ay = 40; }

  const boxX = 12, boxW = W - 24, boxH = 26;
  doc.setFillColor(...NUTRIR_GREEN);
  doc.roundedRect(boxX, ay, boxW, boxH, 3, 3, "F");
  // realce dourado lateral
  doc.setFillColor(...NUTRIR_GOLD);
  doc.rect(boxX, ay, 1.5, boxH, "F");

  // âncoras das 3 colunas
  const c1 = boxX + boxW * (1/6);
  const c2 = boxX + boxW * (3/6);
  const c3 = boxX + boxW * (5/6);

  doc.setTextColor(...NUTRIR_GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TOTAL DE AMOSTRAS", c1, ay + 7, { align: "center" });
  doc.text("VALOR MÉDIO / HECTARE", c2, ay + 7, { align: "center" });
  doc.text("VALOR BRUTO DO CONTRATO", c3, ay + 7, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(input.totais.total_amostras.toString(), c1, ay + 17, { align: "center" });
  doc.text(formatBRL(input.totais.valor_medio_ha), c2, ay + 17, { align: "center" });
  doc.setFontSize(14);
  doc.text(formatBRL(input.totais.valor_total), c3, ay + 17, { align: "center" });

  // separadores verticais sutis
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  const sep1 = boxX + boxW * (2/6);
  const sep2 = boxX + boxW * (4/6);
  doc.line(sep1, ay + 4, sep1, ay + boxH - 4);
  doc.line(sep2, ay + 4, sep2, ay + boxH - 4);

  ay += boxH;

  // Desconto + Valor Final
  const desc = input.desconto_percentual ?? 0;
  if (desc > 0) {
    ay += 4;
    doc.setFillColor(...NUTRIR_LIGHT);
    doc.roundedRect(12, ay, W - 24, 16, 2, 2, "F");
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Desconto aplicado: ${formatNum(desc, 2)}%`, 18, ay + 6);
    doc.text(`− ${formatBRL(input.desconto_valor ?? 0)}`, 18, ay + 12);
    doc.setTextColor(...NUTRIR_GREEN);
    doc.setFontSize(11);
    doc.text("VALOR FINAL", W - 18, ay + 6, { align: "right" });
    doc.setFontSize(15);
    doc.text(formatBRL(input.valor_final ?? input.totais.valor_total), W - 18, ay + 13, { align: "right" });
    ay += 16;
  }

  // CONDIÇÕES COMERCIAIS
  ay += 30;
  if (ay > 240) { doc.addPage(); header(doc, logo, pxrf, input.numero, input.data); ay = 40; }
  doc.setTextColor(...NUTRIR_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CONDIÇÕES COMERCIAIS", 12, ay);
  doc.setDrawColor(...NUTRIR_GOLD); doc.line(12, ay + 1.5, 60, ay + 1.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const cond = [
    "1. Proposta válida por 30 dias.",
    "2. Inclui: coleta georreferenciada + análise foliar PXRF + laudo técnico.",
    "3. Laudo entregue em até 48h após a coleta.",
    "4. Valores proporcionais ao rendimento bruto de cada cultura.",
    "5. Cereais (soja, milho, feijão, trigo, sorgo, pastagem): grid mínimo recomendado de 5 ha.",
    `6. Pagamento: ${input.prazo_pagamento || "90 dias"}.`,
  ];
  cond.forEach((c, i) => doc.text(c, 14, ay + 8 + i * 5.2));

  if (input.observacoes) {
    ay = ay + 8 + cond.length * 5.2 + 4;
    if (ay > 250) { doc.addPage(); header(doc, logo, pxrf, input.numero, input.data); ay = 40; }
    doc.setFont("helvetica", "bold"); doc.setTextColor(...NUTRIR_GREEN);
    doc.text("Observações:", 12, ay);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(input.observacoes, W - 24);
    doc.text(lines, 12, ay + 5);
  }

  // Assinaturas
  const H = doc.internal.pageSize.getHeight();
  const sigY = Math.max(ay + 30, H - 40);
  doc.setDrawColor(...TEXT_MUTED); doc.setLineWidth(0.3);
  doc.line(20, sigY, 90, sigY);
  doc.line(W - 90, sigY, W - 20, sigY);
  doc.setTextColor(...TEXT_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Nutrir AgTech", 55, sigY + 5, { align: "center" });
  doc.text("Cliente", W - 55, sigY + 5, { align: "center" });

  // Numera todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    footer(doc, i, totalPages);
  }

  return doc.output("blob");
}
