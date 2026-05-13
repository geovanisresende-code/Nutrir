import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, fmtNum } from "@/lib/nutrir/format";
import { toast } from "@/hooks/use-toast";
import { History, Trash2, FileDown, Eye, Leaf, TrendingDown, MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";

interface HistoricoRow {
  id: string;
  titulo: string;
  produtor: string | null;
  fazenda: string | null;
  cultura: string | null;
  area_ha: number;
  nivel: string;
  complexador: string;
  numero_batidas: number;
  aplicacao_foliar_l_ha: number;
  custo_nutrir_rs_ha: number;
  custo_convencional_rs_ha: number;
  economia_rs_ha: number;
  economia_total_rs: number;
  created_at: string;
  inputs: any;
  resultado: any;
}

export default function HistoricoFoliar() {
  const navigate = useNavigate();
  const { data: rows, loading, reload } = useOrgTable<HistoricoRow>(
    "nutrir_foliar_historico",
    { orderBy: "created_at", ascending: false },
  );

  const excluir = async (id: string) => {
    if (!confirm("Excluir este cálculo do histórico?")) return;
    const { error } = await (supabase as any).from("nutrir_foliar_historico").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cálculo excluído" });
    reload();
  };

  const reabrir = (row: HistoricoRow) => {
    sessionStorage.setItem("nutrir.foliar_restore", JSON.stringify({
      id: row.id, inputs: row.inputs, resultado: row.resultado,
    }));
    navigate("/app/nutrir/calculadora-foliar?restore=" + row.id);
  };

  const exportarPDF = async (row: HistoricoRow) => {
    try {
      const { gerarPdfFoliar } = await import("@/lib/nutrir/foliar-pdf");
      await gerarPdfFoliar(row.resultado, {
        produtor: row.produtor ?? "",
        fazenda: row.fazenda ?? "",
        cultura: row.cultura ?? "",
        areaHa: Number(row.area_ha),
      });
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><History className="w-5 h-5 text-primary" />Histórico de Cálculos Foliares</span> as any}
        description="Todos os cálculos salvos da Calculadora Foliar NUTRIR"
      />

      <div className="p-4 md:p-6">
        <Card className="overflow-x-auto"><div className="min-w-[640px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Título</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cultura</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Área (ha)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Programa</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">R$/ha NUTRIR</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Economia/ha</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                  <Leaf className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  Nenhum cálculo salvo ainda. Faça uma simulação na Calculadora Foliar e clique em <strong>Salvar no histórico</strong>.
                </td></tr>
              ) : rows.map((r) => {
                const economiaPositiva = Number(r.economia_rs_ha) >= 0;
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 font-medium">{r.titulo}
                      {r.fazenda && <div className="text-xs text-muted-foreground">{r.fazenda}{r.produtor ? ` · ${r.produtor}` : ""}</div>}
                    </td>
                    <td className="px-3 py-2">{r.cultura ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(Number(r.area_ha), 1)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="uppercase text-[10px]">{r.complexador}</Badge>
                      <Badge variant="secondary" className="ml-1 text-[10px]">{r.nivel}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-primary">{fmtBRL(Number(r.custo_nutrir_rs_ha))}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${economiaPositiva ? "text-emerald-600" : "text-destructive"}`}>
                      <span className="inline-flex items-center gap-1">
                        {economiaPositiva && <TrendingDown className="w-3 h-3" />}
                        {fmtBRL(Math.abs(Number(r.economia_rs_ha)))}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" title="Reabrir cálculo" onClick={() => reabrir(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Exportar PDF" onClick={() => exportarPDF(r)}>
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Enviar por WhatsApp" onClick={() => abrirWhatsApp({
                        contexto: "foliar",
                        cliente: r.produtor || r.fazenda || null,
                        cultura: r.cultura || null,
                        identificador: r.titulo,
                        total: Number(r.economia_total_rs ?? 0),
                        observacao: `Custo NUTRIR: ${fmtBRL(Number(r.custo_nutrir_rs_ha))}/ha · Economia: ${fmtBRL(Number(r.economia_rs_ha))}/ha`,
                      })}>
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => excluir(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </>
  );
}
