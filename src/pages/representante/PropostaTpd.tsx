import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, FileDown, Calculator } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────
const R = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numBR = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d });

// Fórmulas pré-cadastradas
const FORMULAS = [
  { label: "20-00-20", n: 20, p: 0, k: 20 },
  { label: "20-05-20", n: 20, p: 5, k: 20 },
  { label: "20-05-15", n: 20, p: 5, k: 15 },
  { label: "20-00-15", n: 20, p: 0, k: 15 },
  { label: "20-00-10", n: 20, p: 0, k: 10 },
  { label: "15-00-15", n: 15, p: 0, k: 15 },
  { label: "Outra (manual)", n: 0, p: 0, k: 0 },
];

interface Proposta {
  produtor: string;
  area: number;
  cultura: string;
  formula: string;
  nPct: number;
  kPct: number;
  doseKgHa: number;
  precoTon: number;
  // TPD
  n180LHa: number;
  n180CustoHa: number;
  k180LHa: number;
  k180CustoHa: number;
  // Insumos
  ureiaKgHa: number;
  ureiaPrecoTon: number;
  lifeGrowLHa: number;
  lifeGrowPrecoL: number;
  kclKgHa: number;
  kclPrecoTon: number;
  tshLHa: number;
  tshPrecoL: number;
  // Bateladas
  volBatelada: number;
}

const empty: Proposta = {
  produtor: "", area: 100, cultura: "Cana-de-açúcar",
  formula: "20-00-20", nPct: 20, kPct: 20, doseKgHa: 400, precoTon: 4000,
  n180LHa: 175, n180CustoHa: 498.75, k180LHa: 270, k180CustoHa: 360.45,
  ureiaKgHa: 70, ureiaPrecoTon: 4000,
  lifeGrowLHa: 8.75, lifeGrowPrecoL: 25,
  kclKgHa: 81, kclPrecoTon: 2800,
  tshLHa: 8.1, tshPrecoL: 16.5,
  volBatelada: 6000,
};

export default function PropostaTpd() {
  const navigate = useNavigate();
  const [p, setP] = useState<Proposta>(empty);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [formulaCustom, setFormulaCustom] = useState(false);

  const set = (k: keyof Proposta, v: any) => setP(prev => ({ ...prev, [k]: v }));

  // ── Cálculos derivados ───────────────────────────────────────
  const custoAtualHa   = R((p.doseKgHa * p.precoTon) / 1000);
  const custoAtualTotal = R(custoAtualHa * p.area);
  const custoTpdHa     = R(p.n180CustoHa + p.k180CustoHa);
  const custoTpdTotal  = R(custoTpdHa * p.area);
  const economiaHa     = R(custoAtualHa - custoTpdHa);
  const economiaTotal  = R(economiaHa * p.area);
  const economiaPct    = custoAtualHa > 0 ? R((economiaHa / custoAtualHa) * 100, 1) : 0;

  const nEntregueKgHa  = R((p.nPct / 100) * p.doseKgHa);
  const kEntregueKgHa  = R((p.kPct / 100) * p.doseKgHa);
  const volN180Total   = R(p.n180LHa * p.area);
  const volK180Total   = R(p.k180LHa * p.area);

  // Insumos totais
  const ureiaTotal     = R(p.ureiaKgHa * p.area);
  const lifeGrowTotal  = R(p.lifeGrowLHa * p.area);
  const kclTotal       = R(p.kclKgHa * p.area);
  const tshTotal       = R(p.tshLHa * p.area);
  const custInsumos    = R(
    (ureiaTotal * p.ureiaPrecoTon / 1000) +
    (lifeGrowTotal * p.lifeGrowPrecoL) +
    (kclTotal * p.kclPrecoTon / 1000) +
    (tshTotal * p.tshPrecoL)
  );

  // Bateladas N180 e K180
  const batN180Total = volN180Total;
  const batK180Total = volK180Total;
  const batN180Cheias = Math.floor(batN180Total / p.volBatelada);
  const batN180Parcial = R(batN180Total % p.volBatelada);
  const batK180Cheias = Math.floor(batK180Total / p.volBatelada);
  const batK180Parcial = R(batK180Total % p.volBatelada);

  // ── Gerador de PDF ───────────────────────────────────────────
  const gerarPdf = async () => {
    if (!p.produtor.trim()) {
      toast({ title: "Informe o nome do produtor", variant: "destructive" }); return;
    }
    setGerandoPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const W = 210, H = 297;
      const GREEN_DARK = [17, 57, 35] as [number, number, number];
      const GREEN_MED  = [27, 82, 50] as [number, number, number];
      const GOLD       = [212, 168, 67] as [number, number, number];
      const WHITE      = [255, 255, 255] as [number, number, number];
      const CREAM      = [245, 240, 225] as [number, number, number];

      const slide = (fn: (d: typeof doc) => void) => { fn(doc); doc.addPage(); };

      const bg = () => {
        doc.setFillColor(...GREEN_DARK); doc.rect(0, 0, W, H, "F");
      };
      const chip = (text: string, y: number) => {
        doc.setTextColor(...GOLD).setFont("helvetica", "bold").setFontSize(9);
        doc.text(text.toUpperCase(), 15, y);
      };
      const title = (text: string, y: number, size = 22) => {
        doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(size);
        const lines = doc.splitTextToSize(text, W - 30);
        doc.text(lines, 15, y); return y + lines.length * (size * 0.45);
      };
      const subtitle = (text: string, y: number) => {
        doc.setTextColor(200, 220, 210).setFont("helvetica", "normal").setFontSize(10);
        const lines = doc.splitTextToSize(text, W - 30);
        doc.text(lines, 15, y); return y + lines.length * 5;
      };
      const card = (x: number, y: number, w: number, h: number, fillRGB: [number,number,number] = [255,255,255]) => {
        doc.setFillColor(...fillRGB);
        doc.roundedRect(x, y, w, h, 4, 4, "F");
      };
      const kpiCard = (x: number, y: number, w: number, label: string, value: string, sub?: string, green = false) => {
        card(x, y, w, 32, green ? [220, 240, 225] : WHITE);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
        doc.text(label.toUpperCase(), x + 4, y + 7);
        doc.setTextColor(...(green ? GREEN_MED : GREEN_DARK)).setFont("helvetica", "bold").setFontSize(15);
        doc.text(value, x + 4, y + 18);
        if (sub) { doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7); doc.text(sub, x + 4, y + 25); }
      };
      const footer = (n: number) => {
        doc.setTextColor(150).setFont("helvetica", "normal").setFontSize(8);
        doc.text("Agrociência · Proposta TPD", 15, H - 6);
        doc.text(`${String(n).padStart(2, "0")}/09`, W - 20, H - 6);
      };

      // ── Slide 1: Capa ─────────────────────────────────────────
      bg();
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 12, 45, 20, 3, 3, "F");
      doc.setTextColor(...GOLD).setFont("helvetica", "bold").setFontSize(9);
      doc.text("AGROCIÊNCIA", 32.5, 23, { align: "center" });
      chip("Proposta Comercial", 46);
      let y = title(`TPD Agrociência para\n${p.cultura}`, 54, 20);
      subtitle("Não é só trocar adubo. É parar de comprar tecnologia pronta\ne começar a produzir fertilizante dentro da fazenda,\ncom custo menor e controle total.", y + 3);
      // Card produtor
      card(10, 120, W - 20, 30, CREAM);
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
      doc.text("PRODUTOR", 16, 129);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(14);
      doc.text(p.produtor, 16, 138);
      doc.setTextColor(...GREEN_MED).setFont("helvetica", "bold").setFontSize(9);
      doc.text(`Área: ${numBR(p.area)} ha  ·  Cultura: ${p.cultura}  ·  Base atual: ${p.formula}`, 16, 146);
      // Cards custo
      kpiCard(10, 160, 88, "Custo Atual", moeda(custoAtualHa) + "/ha", `${p.formula}: ${numBR(p.doseKgHa)} kg/ha a ${moeda(p.precoTon)}/t`);
      kpiCard(102, 160, 98, "Custo TPD", moeda(custoTpdHa) + "/ha", "N180 + K180 produzidos sob demanda.", true);
      // Card economia
      card(10, 198, W - 20, 40, CREAM);
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
      doc.text("ECONOMIA PROJETADA", 16, 207);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(20);
      doc.text(moeda(economiaTotal), 16, 222);
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(8);
      doc.text(`Redução estimada de ${economiaPct}% contra o custo atual, equivalente a ${moeda(economiaHa)}/ha.`, 16, 232);
      // Box fechamento
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 244, W - 20, 38, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines1 = doc.splitTextToSize(`O produtor deixa de comprar tecnologia pronta e passa a produzir sua própria tecnologia nutricional, com escala, controle e menor dependência da indústria.`, W - 40);
      doc.text(lines1, 15, 254);
      footer(1);
      doc.addPage();

      // ── Slide 2: O Problema ──────────────────────────────────
      bg();
      chip("O Problema", 20);
      title(`Hoje o dinheiro sai da fazenda\ncomprando formulado caro.`, 28, 18);
      subtitle(`A base atual é simples: ${numBR(p.doseKgHa)} kg/ha de ${p.formula}. Para ${numBR(p.area)} hectares, isso vira uma compra pesada de ${numBR(p.doseKgHa * p.area / 1000, 1)} toneladas.`, 70);
      kpiCard(10, 100, W - 20, "Compra Atual", `${numBR(p.doseKgHa * p.area / 1000, 1)} toneladas`, `Volume total de formulado ${p.formula} comprado para cobrir a área.`);
      kpiCard(10, 140, W - 20, "Desembolso Atual", moeda(custoAtualTotal), `É o custo direto estimado da adubação N/K no modelo atual.`);
      kpiCard(10, 180, (W - 25) / 2, "Nitrogênio", `${numBR(nEntregueKgHa)} kg/ha`, `Total no projeto: ${numBR(nEntregueKgHa * p.area)} kg de N.`);
      kpiCard(10 + (W - 25) / 2 + 5, 180, (W - 25) / 2, "Potássio", `${numBR(kEntregueKgHa)} kg/ha`, `Total no projeto: ${numBR(kEntregueKgHa * p.area)} kg de K.`);
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 222, W - 20, 42, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines2 = doc.splitTextToSize(`A pergunta não é se o produtor precisa nutrir a ${p.cultura}. A pergunta é: por que continuar pagando caro por uma tecnologia que pode ser produzida dentro da propriedade?`, W - 40);
      doc.text(lines2, 15, 232);
      footer(2);
      doc.addPage();

      // ── Slide 3: A Virada ────────────────────────────────────
      bg();
      chip("A Virada", 20);
      title("Substituir o formulado por\nN180 + K180 produzido na fazenda.", 28, 17);
      subtitle("O TPD transforma matéria-prima em fertilizante organomineral líquido sob demanda. Sai a compra de fórmula pronta. Entra produção estratégica dentro da fazenda.", 68);
      kpiCard(10, 100, (W - 25) / 2, "N180", `${numBR(p.n180LHa)} L/ha`, `Entrega nominal: ${numBR((p.nPct / 100) * p.doseKgHa * 0.18, 1)} kg N/ha.`);
      kpiCard(10 + (W - 25) / 2 + 5, 100, (W - 25) / 2, "K180", `${numBR(p.k180LHa)} L/ha`, `Entrega nominal: ${numBR((p.kPct / 100) * p.doseKgHa * 0.18, 1)} kg K/ha.`);
      kpiCard(10, 142, W - 20, "Custo TPD", `${moeda(custoTpdHa)}/ha`, `N180: ${moeda(p.n180CustoHa)}/ha · K180: ${moeda(p.k180CustoHa)}/ha`);
      kpiCard(10, 182, W - 20, "Volume Total a Produzir", `${numBR(volN180Total + volK180Total)} litros`, `N180: ${numBR(volN180Total)} L · K180: ${numBR(volK180Total)} L`);
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 224, W - 20, 40, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines3 = doc.splitTextToSize("O produtor troca dependência por controle: compra insumos, produz na unidade e aplica a tecnologia no momento certo.", W - 40);
      doc.text(lines3, 15, 234);
      footer(3);
      doc.addPage();

      // ── Slide 4: O Que Comprar ───────────────────────────────
      bg();
      chip("O Que Comprar", 20);
      title(`Lista objetiva para executar\nos ${numBR(p.area)} ha.`, 28, 18);
      subtitle(`Esta é a compra que substitui as ${numBR(p.doseKgHa * p.area / 1000, 1)} toneladas de formulado. Menos compra de produto pronto. Mais produção interna com matéria-prima.`, 65);
      const insumos = [
        { nome: "UREIA BRANCA", qtd: `${numBR(ureiaTotal / 1000, 1)} t`, custo: R((ureiaTotal / 1000) * p.ureiaPrecoTon) },
        { nome: "LIFE GROW", qtd: `${numBR(lifeGrowTotal)} L`, custo: R(lifeGrowTotal * p.lifeGrowPrecoL) },
        { nome: "KCl", qtd: `${numBR(kclTotal / 1000, 1)} t`, custo: R((kclTotal / 1000) * p.kclPrecoTon) },
        { nome: "TSH", qtd: `${numBR(tshTotal)} L`, custo: R(tshTotal * p.tshPrecoL) },
      ];
      let cy = 100;
      insumos.forEach(ins => {
        card(10, cy, W - 20, 28, WHITE);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
        doc.text(ins.nome, 16, cy + 8);
        doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(14);
        doc.text(ins.qtd, 16, cy + 20);
        doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(11);
        doc.text(moeda(ins.custo), W - 16, cy + 20, { align: "right" });
        cy += 33;
      });
      card(10, cy, W - 20, 32, CREAM);
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
      doc.text("TOTAL TPD", 16, cy + 8);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(18);
      doc.text(moeda(custInsumos), 16, cy + 22);
      doc.setTextColor(180, 60, 40).setFont("helvetica", "bold").setFontSize(9);
      doc.text(`contra ${moeda(custoAtualTotal)} no formulado atual`, 16, cy + 30);
      footer(4);
      doc.addPage();

      // ── Slide 5: Como Produzir ───────────────────────────────
      bg();
      chip("Como Produzir", 20);
      title(`Bateladas de ${numBR(p.volBatelada / 1000, 0)}.000 L para tirar\no projeto do papel.`, 28, 18);
      kpiCard(10, 80, W - 20, "N180 — Produção Total", `${numBR(volN180Total)} L`, `${numBR(batN180Total / p.volBatelada, 2)} bateladas: ${batN180Cheias} cheias${batN180Parcial > 0 ? ` + 1 parcial de ${numBR(batN180Parcial)} L` : ""}.`);
      kpiCard(10, 120, W - 20, "K180 — Produção Total", `${numBR(volK180Total)} L`, `${numBR(batK180Total / p.volBatelada, 2)} bateladas: ${batK180Cheias} cheias${batK180Parcial > 0 ? ` + 1 parcial de ${numBR(batK180Parcial)} L` : ""}.`);
      kpiCard(10, 160, (W - 25) / 2, "N180/1.000 L", `${numBR(p.ureiaKgHa / (p.n180LHa / 1000 * (1000 / p.volBatelada * 1000) / 1000), 0)} kg + ${numBR(p.lifeGrowLHa / (p.n180LHa / 1000), 0)} L`, "Ureia branca + Life Grow; completar com água.");
      kpiCard(10 + (W - 25) / 2 + 5, 160, (W - 25) / 2, "K180/1.000 L", `${numBR(p.kclKgHa / (p.k180LHa / 1000), 0)} kg + ${numBR(p.tshLHa / (p.k180LHa / 1000), 1)} L`, "KCl + TSH; completar com água.");
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 205, W - 20, 50, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines5 = doc.splitTextToSize(`Produção total planejada: ${numBR(volN180Total + volK180Total)} litros. A fazenda deixa de receber a fórmula pronta e passa a fabricar a solução dentro da própria operação.`, W - 40);
      doc.text(lines5, 15, 218);
      footer(5);
      doc.addPage();

      // ── Slide 6: Comparativo ─────────────────────────────────
      bg();
      chip("Comparativo", 20);
      title("O TPD entra para esmagar\no custo por hectare.", 28, 18);
      card(10, 75, W - 20, 90, WHITE);
      doc.setTextColor(80).setFont("helvetica", "bold").setFontSize(8);
      doc.text("CUSTO POR HECTARE", 16, 85);
      const bars: { label: string; val: number; color: [number,number,number] }[] = [
        { label: p.formula, val: custoAtualHa, color: [180, 120, 40] },
        { label: "Ureia + KCl", val: R(custoAtualHa * 0.665), color: [140, 140, 140] },
        { label: "TPD", val: custoTpdHa, color: [27, 120, 60] },
      ];
      const maxVal = Math.max(...bars.map(b => b.val));
      const barW = W - 80;
      bars.forEach((b, i) => {
        const y2 = 95 + i * 24;
        doc.setTextColor(60).setFont("helvetica", "bold").setFontSize(8);
        doc.text(b.label, 16, y2 + 6);
        const bw = (b.val / maxVal) * barW;
        doc.setFillColor(...b.color); doc.roundedRect(16, y2 + 8, bw, 8, 2, 2, "F");
        doc.setTextColor(...b.color).setFont("helvetica", "bold").setFontSize(9);
        doc.text(moeda(b.val), W - 16, y2 + 15, { align: "right" });
      });
      kpiCard(10, 176, W - 20, "Economia contra o modelo atual", `${moeda(economiaHa)}/ha`, `Em ${numBR(p.area)} ha, isso vira ${moeda(economiaTotal)} no caixa.`, true);
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 218, W - 20, 36, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines6 = doc.splitTextToSize("A proposta não vende \"mais um produto\". Ela corta custo onde mais dói: no desembolso direto por hectare.", W - 40);
      doc.text(lines6, 15, 228);
      footer(6);
      doc.addPage();

      // ── Slide 7: Número Principal ────────────────────────────
      bg();
      chip("Número Principal", 20);
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(24);
      const linE = doc.splitTextToSize(`${moeda(economiaTotal)} de economia projetada.`, W - 30);
      doc.text(linE, 15, 36);
      subtitle(`Esse é o dinheiro que deixa de sair do caixa quando a fazenda troca o formulado ${p.formula} pelo TPD N180 + K180.`, 72);
      card(10, 100, W - 20, 34, CREAM);
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7);
      doc.text("ECONOMIA TOTAL", 16, 109);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(20);
      doc.text(moeda(economiaTotal), 16, 124);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(9);
      doc.text(`${economiaPct}% de redução no custo direto da adubação N/K`, 16, 132);
      kpiCard(10, 144, (W - 25) / 2, "Antes", moeda(custoAtualTotal), `Compra de formulado ${p.formula}.`);
      kpiCard(10 + (W - 25) / 2 + 5, 144, (W - 25) / 2, "Depois", moeda(custoTpdTotal), "Produção TPD N180 + K180.", true);
      kpiCard(10, 184, W - 20, "Diferença", moeda(economiaTotal), `Equivale a ${moeda(economiaHa)} economizados em cada hectare.`, true);
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, 224, W - 20, 40, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines7 = doc.splitTextToSize(`Fechamento agressivo: ou o produtor continua comprando caro, ou passa a produzir sua própria tecnologia e captura a margem dentro da fazenda.`, W - 40);
      doc.text(lines7, 15, 234);
      footer(7);
      doc.addPage();

      // ── Slide 8: Aplicação ───────────────────────────────────
      bg();
      chip("Aplicação", 20);
      title("Tecnologia no lugar certo,\nna hora certa.", 28, 18);
      subtitle("A eficiência do TPD depende de produzir bem, aplicar bem e acompanhar por talhão. A proposta é econômica, mas precisa ser executada com disciplina operacional.", 66);
      const apls = [
        { label: "N180", sub: "Dose planejada: " + numBR(p.n180LHa) + " L/ha. Foco em posicionamento do nitrogênio." },
        { label: "K180", sub: "Dose planejada: " + numBR(p.k180LHa) + " L/ha. Foco em posicionamento do potássio." },
        { label: "Validação", sub: "Análise, compatibilidade, calibração do equipamento e acompanhamento agronômico por talhão." },
      ];
      let ay = 105;
      apls.forEach(a => {
        card(10, ay, W - 20, 32, WHITE);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7); doc.text(a.label.toUpperCase(), 16, ay + 8);
        doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(12); doc.text(a.label === "Validação" ? "Por Talhão" : a.label === "N180" ? "Corte de soqueira" : "Aplicação via pingente", 16, ay + 18);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(8); doc.text(a.sub, 16, ay + 26);
        ay += 37;
      });
      doc.setFillColor(...GREEN_MED); doc.roundedRect(10, ay, W - 20, 36, 3, 3, "F");
      doc.setTextColor(...WHITE).setFont("helvetica", "bold").setFontSize(10);
      const lines8 = doc.splitTextToSize("Economia sem execução é promessa. Economia com unidade, matéria-prima, produção e aplicação correta vira resultado operacional.", W - 40);
      doc.text(lines8, 15, ay + 10);
      footer(8);
      doc.addPage();

      // ── Slide 9: Próximo Passo ───────────────────────────────
      bg();
      chip("Próximo Passo", 20);
      title("A decisão é simples: implantar,\nproduzir e economizar.", 28, 18);
      subtitle(`O TPD coloca a fazenda no controle da própria nutrição. O projeto já tem área, dose, volume, lista de compras, bateladas e economia calculada.`, 68);
      const steps = [
        { n: "1. VALIDAR OPERAÇÃO", label: "Unidade TPD", sub: "Conferir estrutura, água, mistura, compatibilidade e logística." },
        { n: "2. COMPRAR INSUMOS", label: moeda(custInsumos), sub: "Ureia branca, Life Grow, KCl e TSH nas quantidades calculadas." },
        { n: "3. PRODUZIR E APLICAR", label: `${numBR(volN180Total + volK180Total)} L`, sub: `N180 + K180 para cobrir ${numBR(p.area)} ha de ${p.cultura}.` },
      ];
      let sy = 105;
      steps.forEach(s => {
        card(10, sy, W - 20, 34, WHITE);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7); doc.text(s.n, 16, sy + 8);
        doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(14); doc.text(s.label, 16, sy + 20);
        doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(8); doc.text(s.sub, 16, sy + 28);
        sy += 39;
      });
      doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]); doc.roundedRect(10, sy, W - 20, 44, 3, 3, "F");
      doc.setTextColor(...GOLD).setFont("helvetica", "bold").setFontSize(9); doc.text("FECHAMENTO", 16, sy + 10);
      doc.setTextColor(...GREEN_DARK).setFont("helvetica", "bold").setFontSize(11);
      const lines9 = doc.splitTextToSize(`O argumento central é a economia: ${moeda(economiaTotal)}. Esse é o número que precisa guiar a decisão.`, W - 36);
      doc.text(lines9, 16, sy + 20);
      footer(9);

      // Remove a última página em branco adicionada automaticamente
      // (não há addPage depois do último slide)

      doc.save(`Proposta_TPD_${p.produtor.replace(/\s+/g, "_")}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    } finally {
      setGerandoPdf(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="px-4 pt-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Proposta Comercial TPD</h1>
          <p className="text-xs text-muted-foreground">Gera PDF de 9 slides · custo atual vs TPD · economia projetada</p>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Produtor */}
        <Card><CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Dados do Produtor</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do Produtor *">
              <Input value={p.produtor} onChange={e => set("produtor", e.target.value)} placeholder="Ex.: João Pedro Castro" />
            </Field>
            <Field label="Área (ha) *">
              <Input type="number" value={p.area} onChange={e => set("area", Number(e.target.value))} />
            </Field>
            <Field label="Cultura">
              <Select value={p.cultura} onValueChange={v => set("cultura", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cana-de-açúcar","Soja","Milho","Café","Eucalipto","Algodão","Laranja","Arroz"].map(c =>
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent></Card>

        {/* Base atual */}
        <Card><CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Base Atual (Formulado)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Fórmula">
              <Select value={formulaCustom ? "Outra (manual)" : p.formula} onValueChange={v => {
                const f = FORMULAS.find(x => x.label === v);
                if (!f || v === "Outra (manual)") { setFormulaCustom(true); return; }
                setFormulaCustom(false);
                set("formula", v); set("nPct", f.n); set("kPct", f.k);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMULAS.map(f => <SelectItem key={f.label} value={f.label}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {formulaCustom && <>
              <Field label="% N"><Input type="number" value={p.nPct} onChange={e => set("nPct", Number(e.target.value))} /></Field>
              <Field label="% K"><Input type="number" value={p.kPct} onChange={e => set("kPct", Number(e.target.value))} /></Field>
            </>}
            <Field label="Dose (kg/ha)">
              <Input type="number" value={p.doseKgHa} onChange={e => set("doseKgHa", Number(e.target.value))} />
            </Field>
            <Field label="Preço (R$/t)">
              <Input type="number" value={p.precoTon} onChange={e => set("precoTon", Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1 border-t">
            <div className="text-xs text-muted-foreground">Custo atual: <span className="font-bold text-foreground">{moeda(custoAtualHa)}/ha</span> · Total: <span className="font-bold text-foreground">{moeda(custoAtualTotal)}</span></div>
          </div>
        </CardContent></Card>

        {/* TPD */}
        <Card><CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Programa TPD</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="N180 dose (L/ha)"><Input type="number" value={p.n180LHa} onChange={e => set("n180LHa", Number(e.target.value))} /></Field>
            <Field label="N180 custo (R$/ha)"><Input type="number" value={p.n180CustoHa} onChange={e => set("n180CustoHa", Number(e.target.value))} /></Field>
            <Field label="K180 dose (L/ha)"><Input type="number" value={p.k180LHa} onChange={e => set("k180LHa", Number(e.target.value))} /></Field>
            <Field label="K180 custo (R$/ha)"><Input type="number" value={p.k180CustoHa} onChange={e => set("k180CustoHa", Number(e.target.value))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1 border-t text-xs text-muted-foreground">
            <div>Custo TPD: <span className="font-bold text-foreground">{moeda(custoTpdHa)}/ha</span> · Total: <span className="font-bold text-foreground">{moeda(custoTpdTotal)}</span></div>
            <div className="text-green-700 font-bold">Economia: {moeda(economiaHa)}/ha · {moeda(economiaTotal)} total ({economiaPct}%)</div>
          </div>
        </CardContent></Card>

        {/* Insumos */}
        <Card><CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Insumos (lista de compra)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Ureia (kg/ha)"><Input type="number" value={p.ureiaKgHa} onChange={e => set("ureiaKgHa", Number(e.target.value))} /></Field>
            <Field label="Ureia (R$/t)"><Input type="number" value={p.ureiaPrecoTon} onChange={e => set("ureiaPrecoTon", Number(e.target.value))} /></Field>
            <Field label="Life Grow (L/ha)"><Input type="number" value={p.lifeGrowLHa} onChange={e => set("lifeGrowLHa", Number(e.target.value))} /></Field>
            <Field label="Life Grow (R$/L)"><Input type="number" value={p.lifeGrowPrecoL} onChange={e => set("lifeGrowPrecoL", Number(e.target.value))} /></Field>
            <Field label="KCl (kg/ha)"><Input type="number" value={p.kclKgHa} onChange={e => set("kclKgHa", Number(e.target.value))} /></Field>
            <Field label="KCl (R$/t)"><Input type="number" value={p.kclPrecoTon} onChange={e => set("kclPrecoTon", Number(e.target.value))} /></Field>
            <Field label="TSH (L/ha)"><Input type="number" value={p.tshLHa} onChange={e => set("tshLHa", Number(e.target.value))} /></Field>
            <Field label="TSH (R$/L)"><Input type="number" value={p.tshPrecoL} onChange={e => set("tshPrecoL", Number(e.target.value))} /></Field>
          </div>
          <Field label="Volume por batelada (L)">
            <Input type="number" value={p.volBatelada} onChange={e => set("volBatelada", Number(e.target.value))} className="max-w-xs" />
          </Field>
        </CardContent></Card>

        {/* Resumo + CTA */}
        <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-3">Resumo da Proposta</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Produtor</p><p className="font-bold">{p.produtor || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Área / Cultura</p><p className="font-bold">{numBR(p.area)} ha · {p.cultura}</p></div>
            <div><p className="text-xs text-muted-foreground">Custo atual</p><p className="font-bold">{moeda(custoAtualHa)}/ha</p></div>
            <div><p className="text-xs text-muted-foreground">Custo TPD</p><p className="font-bold text-green-700">{moeda(custoTpdHa)}/ha</p></div>
            <div><p className="text-xs text-muted-foreground">Economia</p><p className="font-bold text-green-700">{moeda(economiaHa)}/ha</p></div>
            <div><p className="text-xs text-muted-foreground">Economia total</p><p className="font-bold text-green-700">{moeda(economiaTotal)}</p></div>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={gerarPdf} disabled={gerandoPdf}>
            <FileDown className="h-4 w-4" />
            {gerandoPdf ? "Gerando PDF..." : "Gerar Proposta PDF (9 slides)"}
          </Button>
        </CardContent></Card>

      </div>
    </div>
  );
}
