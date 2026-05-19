import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable, useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { useFatoresComplexacao, useSaisCatalog } from "@/lib/nutrir/useCatalogoQuimico";
import { toast } from "@/hooks/use-toast";
import {
  calcularFoliar, TEMPLATE_NUTRIENTES_BASE, type FoliarInput,
  type NutrienteEntrada, type FoliarResultado, type SalCatalogo, type FatorComplexacao,
  type NivelComplexacao, type ComplexadorPrincipal,
} from "@/lib/nutrir/foliar-engine";
import { FlaskConical, Sparkles, FileDown, Calculator, AlertTriangle, TrendingDown, Leaf, Beaker, ShoppingCart, Save, MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { ImportarLaudoButton } from "@/components/nutrir/ImportarLaudoButton";
import { fmtBRL, fmtInt, fmtNum, fmtQty, arredondaAplicacao } from "@/lib/nutrir/format";

const moeda = (v: number) => fmtBRL(v);
const num = (v: number, d = 2) => fmtNum(v, d);

interface MateriaPrima { id: string; nome: string; preco_atual: number | null; }
interface Cultura { id: string; nome: string; }

export default function CalculadoraFoliar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { current } = useOrg();
  const { data: mp } = useOrgTable<MateriaPrima>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const [salvandoHistorico, setSalvandoHistorico] = useState(false);

  const irParaPedido = () => {
    if (!resultado) return;
    const itensDraft = (resultado.listaCompras ?? []).map((lc: any) => ({
      produto_nome: lc.produto,
      quantidade: lc.arredondado || lc.quantidadeArea,
      unidade: lc.unidade,
      preco_unitario: lc.precoUnit ?? 0,
    }));
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_foliar",
      titulo: `Foliar — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha: meta.areaHa,
      observacoes: `Receita foliar (${config.nivel} · ${config.complexador}) · ${meta.areaHa} ha`,
      itens: itensDraft,
    }));
    navigate("/app/rep/pedidos");
  };

  // ─── Inputs principais ───
  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Milho", areaHa: 100 });
  const [config, setConfig] = useState({
    vazaoPulverizadorLHa: 55,
    numeroEntradas: 4,
    aplicacaoDiariaHa: 1000,
    volumeBatidaL: 6000,
    nivel: "padrao" as NivelComplexacao,
    complexador: "leg" as ComplexadorPrincipal,
    custoFoliarConvencionalRsHa: 350,
    extratoAlgasMlHa: 0,
    condicionadorSoloMlHa: 0,
  });
  const [precos, setPrecos] = useState({
    legPorL: 22, tshPorL: 28, ionPorL: 25, borPorL: 18,
    estimullPorL: 32, aminoPorL: 38, carboAlgaPorL: 24, lifeGrowPorL: 19,
  });
  const [nutrientes, setNutrientes] = useState<NutrienteEntrada[]>(TEMPLATE_NUTRIENTES_BASE);
  const [resultado, setResultado] = useState<FoliarResultado | null>(null);
  const [calculando, setCalculando] = useState(false);

  // Catálogo químico vindo do banco (substitui as heurísticas antigas)
  const { sais: saisDB } = useSaisCatalog(mp);
  const { fatores: fatoresDB } = useFatoresComplexacao();

  // Fallback heurístico caso a MP não tenha garantia cadastrada ainda
  const sais: SalCatalogo[] = useMemo(() => saisDB.map(s => (
    s.nutrienteSimbolo !== "?" && s.garantiaPercent > 0
      ? s
      : { ...s, nutrienteSimbolo: detectarSimbolo(s.nome), garantiaPercent: garantiaPadrao(s.nome) }
  )), [saisDB]);

  const fatores: FatorComplexacao[] = fatoresDB;

  const calcular = () => {
    setCalculando(true);
    try {
      const input: FoliarInput = {
        ...meta, ...config, precos, nutrientes,
        estagios: [], microNoSolo: "nao", sais, fatores,
      };
      const r = calcularFoliar(input);
      setResultado(r);
      toast({ title: "Cálculo concluído", description: `${r.numeroBatidas} batidas · ${r.aplicacaoFoliarLHa} L/ha` });
    } catch (e: any) {
      toast({ title: "Erro no cálculo", description: e.message, variant: "destructive" });
    } finally { setCalculando(false); }
  };

  const exportarPDF = async () => {
    if (!resultado) return;
    const { gerarPdfFoliar } = await import("@/lib/nutrir/foliar-pdf");
    await gerarPdfFoliar(resultado, meta);
  };

  // ─── Salvar no histórico ───
  const salvarHistorico = async () => {
    if (!resultado || !current) {
      toast({ title: "Nada para salvar", description: "Calcule primeiro a receita.", variant: "destructive" });
      return;
    }
    setSalvandoHistorico(true);
    try {
      const titulo = `Foliar — ${meta.fazenda || meta.produtor || meta.cultura} (${config.complexador.toUpperCase()}/${config.nivel})`;
      const { error } = await (supabase as any).from("nutrir_foliar_historico").insert({
        organization_id: current.id,
        titulo,
        produtor: meta.produtor || null,
        fazenda: meta.fazenda || null,
        cultura: meta.cultura || null,
        area_ha: meta.areaHa,
        nivel: config.nivel,
        complexador: config.complexador,
        numero_batidas: resultado.numeroBatidas,
        aplicacao_foliar_l_ha: resultado.aplicacaoFoliarLHa,
        custo_nutrir_rs_ha: resultado.comparativo.nutrirRsHa,
        custo_convencional_rs_ha: resultado.comparativo.convencionalRsHa,
        economia_rs_ha: resultado.comparativo.economiaRsHa,
        economia_total_rs: resultado.comparativo.economiaTotalRs,
        inputs: { meta, config, precos, nutrientes },
        resultado,
      });
      if (error) throw error;
      toast({ title: "Cálculo salvo no histórico", description: "Veja em Histórico Foliar." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvandoHistorico(false);
    }
  };

  // ─── Restaurar de histórico via ?restore=ID ───
  useEffect(() => {
    const restoreId = searchParams.get("restore");
    if (!restoreId) return;
    const raw = sessionStorage.getItem("nutrir.foliar_restore");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data?.inputs) {
        if (data.inputs.meta) setMeta(data.inputs.meta);
        if (data.inputs.config) setConfig(data.inputs.config);
        if (data.inputs.precos) setPrecos(data.inputs.precos);
        if (data.inputs.nutrientes) setNutrientes(data.inputs.nutrientes);
      }
      if (data?.resultado) setResultado(data.resultado);
      sessionStorage.removeItem("nutrir.foliar_restore");
      toast({ title: "Cálculo restaurado", description: "Você pode editar e recalcular." });
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateNutriente = (sym: string, dose: number) =>
    setNutrientes(ns => ns.map(n => n.simbolo === sym ? { ...n, doseGrHa: dose } : n));

  // Dados gráfico comparativo
  const chartData = resultado ? [
    { name: "Convencional", valor: resultado.comparativo.convencionalRsHa, fill: "hsl(var(--muted-foreground))" },
    { name: "NUTRIR", valor: resultado.comparativo.nutrirRsHa, fill: "hsl(var(--primary))" },
  ] : [];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Leaf className="w-5 h-5 text-primary"/>Calculadora Foliar NUTRIR</span> as any}
        description="Programa de adubação foliar complexada · micronutrientes + benéficos + extras"
        actions={<>
          <ImportarLaudoButton onLaudo={(laudo) => {
            // Auto-preenche cultura/área/aplicação/complexador/nível
            if (laudo.cultura) setMeta(m => ({ ...m, cultura: laudo.cultura! }));
            if (laudo.area_ha) setMeta(m => ({ ...m, areaHa: laudo.area_ha! }));
            if (laudo.produtor) setMeta(m => ({ ...m, produtor: laudo.produtor! }));
            if (laudo.fazenda) setMeta(m => ({ ...m, fazenda: laudo.fazenda! }));
            const cx = (laudo.complexador_sugerido && laudo.complexador_sugerido !== "bor")
              ? laudo.complexador_sugerido as ComplexadorPrincipal : "leg";
            setConfig(c => ({
              ...c,
              complexador: cx,
              nivel: (laudo.nivel_complexacao_sugerido ?? "padrao") as NivelComplexacao,
            }));
            // Auto-preenche doses dos nutrientes (gr/ha; converte kg/ha → gr/ha)
            setNutrientes(prev => prev.map(n => {
              const found = laudo.nutrientes.find(x => x.simbolo === n.simbolo);
              if (!found) return n;
              const dose = found.unidade === "kg/ha" ? found.valor * 1000 : found.valor;
              return { ...n, doseGrHa: Math.round(dose) };
            }));
          }}/>
          {resultado && <Button variant="outline" onClick={irParaPedido}><ShoppingCart className="w-4 h-4 mr-1"/>Criar pedido</Button>}
          {resultado && <Button variant="outline" onClick={exportarPDF}><FileDown className="w-4 h-4 mr-1"/>PDF</Button>}
          {resultado && <Button variant="outline" onClick={() => abrirWhatsApp({
            contexto: "foliar",
            cliente: meta.produtor || meta.fazenda || null,
            cultura: meta.cultura || null,
            identificador: `${config.complexador?.toUpperCase()}/${config.nivel} · ${resultado.numeroBatidas} batidas`,
            total: resultado.comparativo.nutrirRsHa * (meta.areaHa || 1),
            observacao: `Custo NUTRIR: R$ ${resultado.comparativo.nutrirRsHa.toFixed(2)}/ha · Economia: R$ ${resultado.comparativo.economiaRsHa.toFixed(2)}/ha`,
          })}><MessageCircle className="w-4 h-4 mr-1"/>WhatsApp</Button>}
          {resultado && <Button variant="outline" onClick={salvarHistorico} disabled={salvandoHistorico}>
            <Save className="w-4 h-4 mr-1"/>{salvandoHistorico ? "Salvando…" : "Salvar no histórico"}
          </Button>}
          <Button onClick={calcular} disabled={calculando} className="bg-gradient-to-r from-primary to-primary/80">
            <Calculator className="w-4 h-4 mr-1"/>{calculando ? "Calculando…" : "Calcular"}
          </Button>
        </>}/>

      <div className="p-4 md:p-6 grid lg:grid-cols-12 gap-4">
        {/* ─── COLUNA ESQ — INPUTS ─── */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/>Identificação</h3>
            <div className="grid grid-cols-2 gap-3">
              <Lbl t="Produtor"><Input value={meta.produtor} onChange={e => setMeta({ ...meta, produtor: e.target.value })}/></Lbl>
              <Lbl t="Fazenda"><Input value={meta.fazenda} onChange={e => setMeta({ ...meta, fazenda: e.target.value })}/></Lbl>
              <Lbl t="Cultura">
                <Select value={meta.cultura} onValueChange={v => setMeta({ ...meta, cultura: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{culturas.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Lbl>
              <Lbl t="Área (ha)"><Input type="number" value={meta.areaHa} onChange={e => setMeta({ ...meta, areaHa: parseFloat(e.target.value) || 0 })}/></Lbl>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary"/>Configuração de aplicação</h3>
            <div className="grid grid-cols-2 gap-3">
              <Lbl t="Vazão pulv. (L/ha)"><Input type="number" value={config.vazaoPulverizadorLHa} onChange={e => setConfig({ ...config, vazaoPulverizadorLHa: parseFloat(e.target.value) || 0 })}/></Lbl>
              <Lbl t="Volume batida (L)"><Input type="number" value={config.volumeBatidaL} onChange={e => setConfig({ ...config, volumeBatidaL: parseFloat(e.target.value) || 0 })}/></Lbl>
              <Lbl t="Nº entradas"><Input type="number" value={config.numeroEntradas} onChange={e => setConfig({ ...config, numeroEntradas: parseInt(e.target.value) || 1 })}/></Lbl>
              <Lbl t="Apl. diária (ha)"><Input type="number" value={config.aplicacaoDiariaHa} onChange={e => setConfig({ ...config, aplicacaoDiariaHa: parseFloat(e.target.value) || 0 })}/></Lbl>
              <Lbl t="Complexador">
                <Select value={config.complexador} onValueChange={v => setConfig({ ...config, complexador: v as ComplexadorPrincipal })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leg">Complex LEG</SelectItem>
                    <SelectItem value="tsh">Complex TSH</SelectItem>
                    <SelectItem value="ion">Complex íON</SelectItem>
                  </SelectContent>
                </Select>
              </Lbl>
              <Lbl t="Nível">
                <Select value={config.nivel} onValueChange={v => setConfig({ ...config, nivel: v as NivelComplexacao })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forte">Forte</SelectItem>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="fraca">Fraca</SelectItem>
                  </SelectContent>
                </Select>
              </Lbl>
            </div>
            <div className="mt-3">
              <Lbl t={`Custo convencional (R$/ha): ${config.custoFoliarConvencionalRsHa}`}>
                <Slider value={[config.custoFoliarConvencionalRsHa]} min={0} max={1500} step={10}
                  onValueChange={([v]) => setConfig({ ...config, custoFoliarConvencionalRsHa: v })}/>
              </Lbl>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Beaker className="w-4 h-4 text-primary"/>Doses por nutriente (gr/ha)</h3>
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
              {nutrientes.map(n => (
                <div key={n.simbolo} className="flex items-center gap-2 text-sm">
                  <Badge variant={n.grupo === "essencial" ? "default" : "secondary"} className="w-12 justify-center text-[10px]">{n.simbolo}</Badge>
                  <span className="flex-1 text-muted-foreground">{n.nome}</span>
                  <Input type="number" className="w-24 h-7 text-right" value={n.doseGrHa}
                    onChange={e => updateNutriente(n.simbolo, parseFloat(e.target.value) || 0)}/>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── COLUNA DIR — RESULTADO ─── */}
        <div className="lg:col-span-7 space-y-4">
          {!resultado ? (
            <Card className="p-12 text-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <Leaf className="w-16 h-16 mx-auto mb-4 text-primary/40"/>
              <h3 className="text-xl font-semibold mb-2">Pronto para calcular</h3>
              <p className="text-muted-foreground mb-4">Configure os parâmetros à esquerda e clique em <strong>Calcular</strong> para gerar a recomendação NUTRIR.</p>
              <Button onClick={calcular} size="lg" className="bg-gradient-to-r from-primary to-primary/80">
                <Calculator className="w-5 h-5 mr-2"/>Calcular agora
              </Button>
            </Card>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi t="R$/ha NUTRIR" v={moeda(resultado.comparativo.nutrirRsHa)} c="text-primary"/>
                <Kpi t="Economia/ha" v={moeda(Math.abs(resultado.comparativo.economiaRsHa))} sub={`${fmtNum(resultado.comparativo.economiaPercent, 1)}%`} c={resultado.comparativo.economiaRsHa >= 0 ? "text-[#b08826]" : "text-destructive"} icon={TrendingDown}/>
                <Kpi t="Volume foliar" v={fmtQty(arredondaAplicacao(resultado.aplicacaoFoliarLHa), "L/ha")}/>
                <Kpi t="Nº batidas" v={fmtInt(resultado.numeroBatidas)} sub={`${fmtInt(resultado.diasParaCobrir)} dias p/ cobrir`}/>
              </div>

              {/* Gráfico comparativo */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Comparativo de custos (R$/ha)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
                    <XAxis dataKey="name" fontSize={12}/>
                    <YAxis fontSize={11} tickFormatter={(v) => `R$${v}`}/>
                    <Tooltip formatter={(v: number) => moeda(v)}/>
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center text-sm text-muted-foreground mt-2">
                  Total na área: <strong className={resultado.comparativo.economiaRsHa >= 0 ? "text-[#b08826]" : "text-destructive"}>
                    {resultado.comparativo.economiaRsHa >= 0 ? "Economia " : "Investimento extra "}
                    {moeda(Math.abs(resultado.comparativo.economiaTotalRs))}
                  </strong>
                </div>
              </Card>

              {/* Abas detalhadas */}
              <Card className="p-4">
                <Tabs defaultValue="receita">
                  <TabsList>
                    <TabsTrigger value="receita">Receita</TabsTrigger>
                    <TabsTrigger value="sais">Sais ({resultado.sais.length})</TabsTrigger>
                    <TabsTrigger value="complexantes">Complexantes ({resultado.complexantes.length})</TabsTrigger>
                    <TabsTrigger value="compras">Compras</TabsTrigger>
                    {resultado.alertas.length > 0 && <TabsTrigger value="alertas" className="text-amber-600"><AlertTriangle className="w-3 h-3 mr-1"/>Alertas</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="receita">
                    <div className="text-xs text-muted-foreground mb-2">Por batida de {config.volumeBatidaL} L · adicionar na ordem listada</div>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {resultado.receita.map((r, i) => r.isInstrucao
                        ? <div key={i} className="text-xs italic p-2 bg-primary/5 rounded border-l-2 border-primary text-primary">{r.instrucao}</div>
                        : (
                          <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-b-0">
                            <span className="w-6 text-muted-foreground text-xs">{r.ordem}</span>
                            <span className="flex-1">{r.ingrediente}</span>
                            <span className="font-mono text-sm">{num(r.quantidade, 2)} {r.unidade}</span>
                            <span className="text-xs text-muted-foreground w-48 text-right truncate" title={r.instrucao}>{r.instrucao}</span>
                          </div>
                        ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="sais">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr><th className="text-left py-1">Nutriente</th><th className="text-left">Sal</th><th className="text-right">kg/ha</th><th className="text-right">kg total</th><th className="text-right">Custo</th></tr>
                      </thead>
                      <tbody>
                        {resultado.sais.map((s, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1.5"><Badge variant="outline">{s.simbolo}</Badge> <span className="text-xs text-muted-foreground ml-1">{s.nutrienteNome}</span></td>
                            <td className="text-xs">{s.salNome}</td>
                            <td className="text-right">{num(s.saisAreaKg / Math.max(1, meta.areaHa), 3)}</td>
                            <td className="text-right">{num(s.saisAreaKg, 0)}</td>
                            <td className="text-right font-mono">{moeda(s.custoTotalRs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TabsContent>

                  <TabsContent value="complexantes">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr><th className="text-left py-1">Produto</th><th className="text-right">L/batida</th><th className="text-right">L total</th><th className="text-right">R$/ha</th><th className="text-right">Custo</th></tr>
                      </thead>
                      <tbody>
                        {resultado.complexantes.map((c, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1.5 font-medium">{c.produto}</td>
                            <td className="text-right">{num(c.lPorBatida, 1)}</td>
                            <td className="text-right">{num(c.lTotal, 1)}</td>
                            <td className="text-right">{moeda(c.custoPorHa)}</td>
                            <td className="text-right font-mono">{moeda(c.custoTotalRs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TabsContent>

                  <TabsContent value="compras">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr><th className="text-left py-1">Produto</th><th className="text-right">Necessário</th><th className="text-right">Comprar</th><th className="text-right">Total</th></tr>
                      </thead>
                      <tbody>
                        {resultado.listaCompras.map((it, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1.5">{it.produto}<div className="text-xs text-muted-foreground">{it.embalagem}</div></td>
                            <td className="text-right">{num(it.quantidadeArea, 0)} {it.unidade}</td>
                            <td className="text-right">{num(it.arredondado, 0)} {it.unidade}</td>
                            <td className="text-right font-mono">{moeda(it.custoTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-bold">
                        <tr><td colSpan={3} className="py-2 text-right">TOTAL</td>
                          <td className="text-right font-mono text-primary">{moeda(resultado.listaCompras.reduce((a, b) => a + b.custoTotal, 0))}</td></tr>
                      </tfoot>
                    </table>
                  </TabsContent>

                  {resultado.alertas.length > 0 && <TabsContent value="alertas">
                    <ul className="space-y-2">
                      {resultado.alertas.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"/>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </TabsContent>}
                </Tabs>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{t}</label>
      {children}
    </div>
  );
}

function Kpi({ t, v, sub, c, icon: Icon }: { t: string; v: string; sub?: string; c?: string; icon?: any }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{Icon && <Icon className="w-3 h-3"/>}{t}</div>
      <div className={`text-xl font-bold mt-1 ${c ?? ""}`}>{v}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// Heurística simples para extrair símbolo do nutriente do nome do sal
function detectarSimbolo(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("manganes")) return "Mn";
  if (n.includes("magnesio") || n.includes("magnésio")) return "Mg";
  if (n.includes("zinco")) return "Zn";
  if (n.includes("cobre")) return "Cu";
  if (n.includes("borico") || n.includes("bórico") || n.includes("boro")) return "B";
  if (n.includes("molibd")) return "Mo";
  if (n.includes("cobalto")) return "Co";
  if (n.includes("niquel") || n.includes("níquel")) return "Ni";
  if (n.includes("map")) return "P";
  if (n.includes("kcl") || n.includes("potass")) return "K";
  if (n.includes("calcio") || n.includes("cálcio")) return "Ca";
  if (n.includes("silicato") || n.includes("silicio")) return "Si";
  if (n.includes("ferr")) return "Fe";
  if (n.includes("ureia") || n.includes("nitr")) return "N";
  if (n.includes("selen")) return "Se";
  return "?";
}

function garantiaPadrao(nome: string): number {
  const n = nome.toLowerCase();
  if (n.includes("manganes")) return 32;
  if (n.includes("magnesio") || n.includes("magnésio")) return 9;
  if (n.includes("zinco")) return 22;
  if (n.includes("cobre")) return 25;
  if (n.includes("borico") || n.includes("bórico")) return 17;
  if (n.includes("molibd")) return 39;
  if (n.includes("cobalto")) return 21;
  if (n.includes("niquel") || n.includes("níquel")) return 22;
  if (n.includes("map")) return 60;
  if (n.includes("kcl")) return 60;
  if (n.includes("calcio") || n.includes("cálcio")) return 19;
  if (n.includes("silicato")) return 12;
  if (n.includes("ureia")) return 45;
  if (n.includes("selen")) return 45;
  return 20;
}
