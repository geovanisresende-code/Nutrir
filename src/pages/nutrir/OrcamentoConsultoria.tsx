import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrg } from "@/contexts/OrganizationContext";
import { useOrgTable, useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Map, Save, FileDown, MessageCircle, Lock } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";
import {
  calcularItem, calcularValorAmostraOperacional, type ParametrosConsultoria, type CulturaConsultoria,
  type MetodoAmostragem, type ItemOrcamento,
} from "@/lib/nutrir/orcamento-consultoria-engine";
import { DescontoInput, descontoBloqueado, nivelDesconto, LIMITE_DESCONTO_APROVACAO } from "@/components/nutrir/DescontoInput";
import { fmtBRL } from "@/lib/nutrir/format";

interface Field { id: string; name: string; hectares: number | null; cultura: string | null; client_id: string | null; }
interface Cultura { id: string; nome: string; }
interface ClienteN { id: string; razao_social: string; }
interface Param { custo_amostra: number; meta_lucratividade: number; rendimento_ref_soja: number; piso_amostra: number; piso_hectare: number; grid_min_cereais: number; }

interface Linha extends ItemOrcamento { _key: string; field_id?: string | null; cultura_id?: string; }

const novaLinha = (): Linha => ({
  _key: crypto.randomUUID(),
  cultura_nome: "Soja", area_ha: 0, metodo_amostragem: "grade", grid_ha: 5,
  numero_talhoes: 0, amostras_por_talhao: 1, numero_amostragens: 1,
  total_amostras: 0, valor_amostra: 0, valor_ha: 0, subtotal: 0, field_id: null,
});

export default function OrcamentoConsultoria() {
  const { current } = useOrg();
  const [searchParams] = useSearchParams();
  const { data: fields } = useOrgTable<Field>("fields", { orderBy: "name", select: "id,name,hectares,cultura,client_id" });
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { data: clientesN } = useOrgTable<ClienteN>("nutrir_clientes", { orderBy: "razao_social", select: "id,razao_social" });

  const [titulo, setTitulo] = useState("Orçamento de Consultoria");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [params, setParams] = useState<Param>({ custo_amostra: 50, meta_lucratividade: 30, rendimento_ref_soja: 8000, piso_amostra: 60, piso_hectare: 8, grid_min_cereais: 5 });
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [salvando, setSalvando] = useState(false);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [descontoPct, setDescontoPct] = useState<number>(0);

  // ── Carregar orçamento existente via ?id= ──
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    (async () => {
      const { data: orc } = await (supabase as any).from("nutrir_orcamentos").select("*").eq("id", id).maybeSingle();
      if (!orc) return;
      setOrcamentoId(orc.id);
      setTitulo(orc.titulo);
      setClienteId(orc.cliente_id);
      if (orc.parametros) {
        setParams({ ...params, ...orc.parametros });
        if (typeof orc.parametros.desconto_pct === "number") setDescontoPct(orc.parametros.desconto_pct);
      }
      const { data: its } = await (supabase as any).from("nutrir_orcamento_itens").select("*").eq("orcamento_id", id).order("ordem");
      setLinhas((its ?? []).map((i: any) => ({
        _key: crypto.randomUUID(), field_id: i.field_id, cultura_nome: i.cultura_nome,
        area_ha: Number(i.area_ha), metodo_amostragem: i.metodo_amostragem, grid_ha: Number(i.grid_ha),
        numero_talhoes: i.numero_talhoes, amostras_por_talhao: i.amostras_por_talhao,
        numero_amostragens: i.numero_amostragens, total_amostras: i.total_amostras,
        valor_amostra: Number(i.valor_amostra), valor_ha: Number(i.valor_ha), subtotal: Number(i.subtotal),
      })));
      toast({ title: "Orçamento carregado" });
    })();
  }, [searchParams]);

  // carrega parâmetros default da org
  useEffect(() => {
    if (!current) return;
    (async () => {
      const { data } = await (supabase as any).from("nutrir_parametros_consultoria")
        .select("*").eq("organization_id", current.id).maybeSingle();
      if (data) setParams({
        custo_amostra: Number(data.custo_amostra), meta_lucratividade: Number(data.meta_lucratividade),
        rendimento_ref_soja: Number(data.rendimento_ref_soja), piso_amostra: Number(data.piso_amostra),
        piso_hectare: Number(data.piso_hectare), grid_min_cereais: Number(data.grid_min_cereais),
      });
    })();
  }, [current?.id]);

  // recalcula linhas quando params/dados mudam
  const linhasCalc = useMemo<Linha[]>(() => {
    const p: ParametrosConsultoria = params;
    return linhas.map(l => {
      const cultura: CulturaConsultoria = { nome: l.cultura_nome, rendimento_bruto_ha: 0, grid_minimo: l.grid_ha, categoria: "" };
      const item = calcularItem(cultura, l.area_ha, l.metodo_amostragem, l.grid_ha, l.numero_talhoes, l.amostras_por_talhao, l.numero_amostragens, p);
      return { ...l, ...item };
    });
  }, [linhas, params]);

  const subtotalGeral = linhasCalc.reduce((s, l) => s + (l.subtotal || 0), 0);
  const areaTotal = linhasCalc.reduce((s, l) => s + (l.area_ha || 0), 0);
  const valorAmostra = calcularValorAmostraOperacional(params);
  const valorDesconto = subtotalGeral * (descontoPct / 100);
  const totalGeral = Math.max(0, subtotalGeral - valorDesconto);
  const bloqueado = descontoBloqueado(descontoPct);
  const exigeAprovacao = !bloqueado && descontoPct > LIMITE_DESCONTO_APROVACAO;

  const update = (key: string, patch: Partial<Linha>) =>
    setLinhas(ls => ls.map(l => l._key === key ? { ...l, ...patch } : l));

  const importarTalhao = (linhaKey: string, fieldId: string) => {
    const f = fields.find(x => x.id === fieldId);
    if (!f) return;
    update(linhaKey, {
      field_id: f.id,
      cultura_nome: f.cultura || "Soja",
      area_ha: Number(f.hectares ?? 0),
    });
  };

  const importarTodosTalhoes = () => {
    if (fields.length === 0) { toast({ title: "Nenhum talhão cadastrado", description: "Cadastre talhões em Mapas primeiro" }); return; }
    setLinhas(fields.map(f => ({
      ...novaLinha(),
      _key: crypto.randomUUID(),
      field_id: f.id,
      cultura_nome: f.cultura || "Soja",
      area_ha: Number(f.hectares ?? 0),
    })));
    toast({ title: `${fields.length} talhões importados` });
  };

  const salvar = async () => {
    if (!current) return;
    if (bloqueado) {
      toast({ title: "Desconto bloqueado", description: "Acima de 15% — ajuste o desconto antes de salvar.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const orcPayload: any = {
      organization_id: current.id, titulo, cliente_id: clienteId,
      parametros: { ...params, desconto_pct: descontoPct, exige_aprovacao: exigeAprovacao },
      total_geral: totalGeral, area_total_ha: areaTotal,
    };
    let orcId = orcamentoId;
    if (orcId) {
      await (supabase as any).from("nutrir_orcamentos").update(orcPayload).eq("id", orcId);
      await (supabase as any).from("nutrir_orcamento_itens").delete().eq("orcamento_id", orcId);
    } else {
      const { data, error } = await (supabase as any).from("nutrir_orcamentos").insert(orcPayload).select().single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setSalvando(false); return; }
      orcId = data.id; setOrcamentoId(orcId);
    }
    const itens = linhasCalc.map((l, i) => ({
      orcamento_id: orcId, field_id: l.field_id || null, cultura_nome: l.cultura_nome, area_ha: l.area_ha,
      metodo_amostragem: l.metodo_amostragem, grid_ha: l.grid_ha, numero_talhoes: l.numero_talhoes,
      amostras_por_talhao: l.amostras_por_talhao, numero_amostragens: l.numero_amostragens,
      total_amostras: l.total_amostras, valor_amostra: l.valor_amostra, valor_ha: l.valor_ha, subtotal: l.subtotal, ordem: i,
    }));
    if (itens.length) await (supabase as any).from("nutrir_orcamento_itens").insert(itens);
    setSalvando(false);
    toast({ title: "Orçamento salvo" });
  };

  const exportarPDF = async () => {
    const { gerarOrcamentoPDF } = await import("@/lib/nutrir/orcamento-consultoria-pdf");
    const totais = {
      area_total: areaTotal,
      total_amostras: linhasCalc.reduce((s, l) => s + l.total_amostras, 0),
      valor_total: totalGeral,
      valor_medio_ha: areaTotal > 0 ? totalGeral / areaTotal : 0,
    };
    const blob = await gerarOrcamentoPDF({
      cliente_nome: clientesN.find((c) => c.id === clienteId)?.razao_social ?? "—",
      area_total: areaTotal,
      itens: linhasCalc as ItemOrcamento[],
      totais,
      data: new Date(),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${titulo.replace(/\s+/g, "_")}.pdf`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "PDF gerado", description: "Download iniciado" });
  };

  return (
    <>
      <PageHeader
        title="Orçamento de Consultoria"
        description="Integrado com talhões cadastrados em Mapas"
        actions={<>
          <Button variant="outline" onClick={exportarPDF}><FileDown className="w-4 h-4 mr-1"/>PDF</Button>
          <Button variant="outline" onClick={() => abrirWhatsApp({
            contexto: "consultoria",
            cliente: clientesN.find((c) => c.id === clienteId)?.razao_social ?? null,
            identificador: titulo,
            total: totalGeral,
            observacao: `Área total: ${areaTotal.toFixed(1)} ha · ${linhasCalc.reduce((s,l)=>s+l.total_amostras,0)} amostras`,
          })}><MessageCircle className="w-4 h-4 mr-1"/>WhatsApp</Button>
          <Button onClick={salvar} disabled={salvando || bloqueado}><Save className="w-4 h-4 mr-1"/>{salvando?"Salvando…":bloqueado?"Desconto bloqueado":"Salvar"}</Button>
        </>}
      />
      <div className="p-4 md:p-6 space-y-4">
        <Card className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)}/>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              <Select value={clienteId ?? "none"} onValueChange={v => setClienteId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem cliente —</SelectItem>
                  {clientesN.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={importarTodosTalhoes}>
                <Map className="w-4 h-4 mr-1"/>Importar todos os talhões ({fields.length})
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Parâmetros operacionais</h3>
            <span className="text-[11px] text-muted-foreground">(somente leitura — controlados pelo ADM no Motor)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Valor por amostra</div>
              <div className="font-mono font-semibold">{fmtBRL(valorAmostra)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Meta de lucratividade</div>
              <div className="font-mono">{params.meta_lucratividade.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Grid mínimo cereais</div>
              <div className="font-mono">{params.grid_min_cereais} ha/amostra</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <DescontoInput value={descontoPct} onChange={setDescontoPct} />
            </div>
            <div className="md:col-span-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Subtotal</div>
                <div className="font-mono font-semibold">{fmtBRL(subtotalGeral)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Desconto</div>
                <div className="font-mono text-destructive">− {fmtBRL(valorDesconto)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-mono text-primary text-lg font-semibold">{fmtBRL(totalGeral)}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Itens do orçamento</h3>
            <Button size="sm" variant="outline" onClick={() => setLinhas([...linhas, novaLinha()])}>
              <Plus className="w-4 h-4 mr-1"/>Adicionar linha
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {["Talhão","Cultura","Área (ha)","Método","Grid/Talhões","Amostras","Subtotal",""].map(h =>
                    <th key={h} className="px-2 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {linhasCalc.map(l => (
                  <tr key={l._key} className="border-b">
                    <td className="px-2 py-2 min-w-[160px]">
                      <Select value={l.field_id ?? "none"} onValueChange={v => v === "none" ? update(l._key, { field_id: null }) : importarTalhao(l._key, v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Manual"/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Manual —</SelectItem>
                          {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({Number(f.hectares ?? 0).toFixed(1)} ha)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <Select value={l.cultura_nome} onValueChange={v => update(l._key, { cultura_nome: v })}>
                        <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {culturas.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2"><Input type="number" step="0.1" className="h-8 w-24" value={l.area_ha} onChange={e => update(l._key, { area_ha: parseFloat(e.target.value) || 0 })}/></td>
                    <td className="px-2 py-2">
                      <Select value={l.metodo_amostragem} onValueChange={v => update(l._key, { metodo_amostragem: v as MetodoAmostragem })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grade">Grade</SelectItem>
                          <SelectItem value="talhoes">Talhões</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      {l.metodo_amostragem === "grade" ? (
                        <Input type="number" step="0.5" className="h-8 w-20" placeholder="grid" value={l.grid_ha} onChange={e => update(l._key, { grid_ha: parseFloat(e.target.value) || 0 })}/>
                      ) : (
                        <div className="flex gap-1">
                          <Input type="number" className="h-8 w-16" placeholder="t" value={l.numero_talhoes} onChange={e => update(l._key, { numero_talhoes: parseInt(e.target.value) || 0 })}/>
                          <Input type="number" className="h-8 w-16" placeholder="a/t" value={l.amostras_por_talhao} onChange={e => update(l._key, { amostras_por_talhao: parseInt(e.target.value) || 0 })}/>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <Input type="number" className="h-8 w-12" value={l.numero_amostragens} onChange={e => update(l._key, { numero_amostragens: parseInt(e.target.value) || 1 })}/>
                        <span className="text-xs text-muted-foreground">×</span>
                        <span className="text-xs">{l.total_amostras}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 font-medium font-mono">{fmtBRL(l.subtotal)}<div className="text-xs text-muted-foreground">{fmtBRL(l.valor_ha)}/ha</div></td>
                    <td className="px-2 py-2">
                      <Button size="icon" variant="ghost" onClick={() => setLinhas(ls => ls.filter(x => x._key !== l._key))}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={2} className="px-2 py-2">Subtotal</td>
                  <td className="px-2 py-2">{areaTotal.toFixed(1)} ha</td>
                  <td colSpan={3}></td>
                  <td className="px-2 py-2 font-mono">{fmtBRL(subtotalGeral)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-right text-muted-foreground">Desconto ({descontoPct.toFixed(1)}%)</td>
                  <td className="px-2 py-2 font-mono text-destructive">− {fmtBRL(valorDesconto)}</td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-right">Total</td>
                  <td className="px-2 py-3 text-primary text-lg font-mono">{fmtBRL(totalGeral)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
