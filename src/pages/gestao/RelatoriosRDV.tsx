import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBRL } from "@/lib/nutrir/format";
import { Receipt, Download, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Linha = {
  id: string;
  user_id: string;
  user_nome?: string;
  data: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  status: string;
  cidade?: string | null;
  uf?: string | null;
  km_inicial?: number | null;
  km_final?: number | null;
};

const hoje = new Date();
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export default function RelatoriosRDV() {
  const { current } = useOrg();
  const [inicio, setInicio] = useState(fmtDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [fim, setFim] = useState(fmtDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    if (!current) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("nutrir_rdv")
      .select("id,user_id,data,categoria,descricao,valor,status,cidade,uf,km_inicial,km_final")
      .eq("organization_id", current.id)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setLoading(false); return; }
    const userIds = Array.from(new Set((data ?? []).map((d: any) => d.user_id).filter(Boolean)));
    const { data: profs } = userIds.length
      ? await (supabase as any).from("profiles").select("id,full_name,email").in("id", userIds)
      : { data: [] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));
    setLinhas((data ?? []).map((d: any) => ({ ...d, user_nome: (map.get(d.user_id) as string) || "—" })));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [current?.id]);

  const porColaborador = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; itens: Linha[] }>();
    linhas.forEach(l => {
      const k = l.user_id;
      if (!m.has(k)) m.set(k, { nome: l.user_nome || "—", total: 0, itens: [] });
      const o = m.get(k)!; o.total += Number(l.valor || 0); o.itens.push(l);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [linhas]);

  const total = linhas.reduce((s, l) => s + Number(l.valor || 0), 0);
  const aprovados = linhas.filter(l => l.status === "aprovado").reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendentes = linhas.filter(l => l.status === "pendente").reduce((s, l) => s + Number(l.valor || 0), 0);

  const gerarPDF = (filtroUserId?: string) => {
    const dados = filtroUserId ? linhas.filter(l => l.user_id === filtroUserId) : linhas;
    if (dados.length === 0) { toast({ title: "Sem dados no período" }); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFillColor(27, 67, 50); doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(14);
    doc.text("Relatório de RDV", 10, 14);
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(`Período: ${inicio} a ${fim}`, 200, 14, { align: "right" });
    doc.setTextColor(0);
    if (filtroUserId) {
      const u = porColaborador.find(p => p.id === filtroUserId);
      doc.setFontSize(11).setFont("helvetica", "bold").text(`Colaborador: ${u?.nome ?? ""}`, 10, 32);
    }
    autoTable(doc, {
      startY: 38,
      head: [["Data", "Colaborador", "Categoria", "Descrição", "Local", "Valor", "Status"]],
      body: dados.map(l => [
        new Date(l.data).toLocaleDateString("pt-BR"),
        l.user_nome || "—",
        l.categoria,
        l.descricao ?? "—",
        [l.cidade, l.uf].filter(Boolean).join("/") || "—",
        fmtBRL(l.valor),
        l.status,
      ]),
      headStyles: { fillColor: [27, 67, 50], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });
    const tot = dados.reduce((s, l) => s + Number(l.valor || 0), 0);
    const y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(`Total: ${fmtBRL(tot)}`, 200, y, { align: "right" });
    doc.save(`rdv_${inicio}_${fim}${filtroUserId ? "_" + filtroUserId.slice(0, 6) : ""}.pdf`);
  };

  const exportCSV = () => {
    const header = "data,colaborador,categoria,descricao,cidade,uf,valor,status\n";
    const rows = linhas.map(l =>
      [l.data, l.user_nome, l.categoria, (l.descricao || "").replace(/,/g, ";"), l.cidade ?? "", l.uf ?? "", l.valor, l.status].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `rdv_${inicio}_${fim}.csv`; a.click();
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6 text-primary"/>Relatórios RDV</h1>
        <p className="text-muted-foreground text-sm">Consolidação mensal de despesas dos colaboradores</p>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-end gap-3">
          <div><Label>Início</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></div>
          <div><Label>Fim</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} /></div>
          <Button onClick={carregar} disabled={loading}>{loading ? "Carregando..." : "Atualizar"}</Button>
          <Button variant="outline" onClick={() => gerarPDF()}><FileText className="w-4 h-4 mr-1"/>PDF Geral</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1"/>CSV</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{fmtBRL(total)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Aprovado</p><p className="text-2xl font-bold text-[#b08826]">{fmtBRL(aprovados)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-2xl font-bold text-amber-600">{fmtBRL(pendentes)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Por Colaborador</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {porColaborador.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum lançamento no período.</TableCell></TableRow>
              ) : porColaborador.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell><Badge variant="outline">{p.itens.length}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{fmtBRL(p.total)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => gerarPDF(p.id)}><FileText className="w-3 h-3 mr-1"/>PDF</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
