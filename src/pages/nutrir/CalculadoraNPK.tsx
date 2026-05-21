import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/AppShell";
import { useOrgTable, useGlobalTable } from "@/lib/nutrir/useNutrirData";
import { useSaisNPK } from "@/lib/nutrir/useCatalogoQuimico";
import { useMotorConfig, paramMap } from "@/lib/nutrir/useMotorConfig";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  calcularNPK, formulaParaDemanda, type NPKInput, type NPKResult, type NPKDemanda, type SalDisponivel,
  type ModoEntradaNPK, type ModoProducao, type ModoAplicacao,
} from "@/lib/nutrir/npk-foliar-engine";
import { Calculator, FileDown, AlertTriangle, TrendingDown, Sprout, FlaskConical, Atom, Save, History, MessageCircle, ShoppingCart } from "lucide-react";
import { abrirWhatsApp } from "@/lib/nutrir/whatsapp";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { ImportarLaudoButton } from "@/components/nutrir/ImportarLaudoButton";
import { fmtBRL, fmtNum } from "@/lib/nutrir/format";


const moeda = (v: number) => fmtBRL(v);
const num = (v: number, d = 2) => fmtNum(v, d);

interface MateriaPrima { id: string; nome: string; preco_atual: number | null; }
interface Cultura { id: string; nome: string; }

export default function CalculadoraNPK() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { current } = useOrg();
  const { user } = useAuth();
  const { data: mp } = useOrgTable<MateriaPrima>("nutrir_materias_primas", { orderBy: "nome" });
  const { data: culturas } = useGlobalTable<Cultura>("nutrir_culturas", "nome");
  const { sais: saisCatalogo, loading: loadingCatalogo } = useSaisNPK(mp);
  const { params: motorParams, loading: motorLoading } = useMotorConfig();

  const [meta, setMeta] = useState({ produtor: "", fazenda: "", cultura: "Soja", areaHa: 100 });
  const [modoEntrada, setModoEntrada] = useState<ModoEntradaNPK>("nutrientes");
  const [demanda, setDemanda] = useState<NPKDemanda>({ nKgHa: 90, p2o5KgHa: 60, k2oKgHa: 120 });
  const [formula, setFormula] = useState({ formula: "10-15-15", doseKgHa: 600, precoKg: 4.5 });
  const [modoProducao, setModoProducao] = useState<ModoProducao>("completa");
  const [modoAplicacao, setModoAplicacao] = useState<ModoAplicacao>("drench");
  const [entradasLavoura, setEntradasLavoura] = useState(2);
  const [vazao, setVazao] = useState(500);
  const [precos, setPrecos] = useState({ tsh: 18, lifeGrow: 22, leg: 22 });
  const [resultado, setResultado] = useState<NPKResult | null>(null);

  // Sincroniza preços com o Motor de Cálculos ao carregar
  useEffect(() => {
    if (motorLoading) return;
    const cfg = paramMap(motorParams);
    setPrecos({
      tsh:      cfg.preco_tsh_l      ?? 18,
      lifeGrow: cfg.preco_lifegrow_l ?? 22,
      leg:      cfg.preco_leg_l      ?? 22,
    });
  }, [motorLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [salvando, setSalvando] = useState(false);

  // Filtra sais que carregam cada nutriente (usa garantias reais do banco)
  const fontesN = useMemo(() => saisCatalogo.filter(s => (s.garantias["N"] ?? 0) > 0), [saisCatalogo]);
  const fontesP = useMemo(() => saisCatalogo.filter(s => (s.garantias["P2O5"] ?? 0) > 0), [saisCatalogo]);
  const fontesK = useMemo(() => saisCatalogo.filter(s => (s.garantias["K2O"] ?? 0) > 0), [saisCatalogo]);

  const [selecao, setSelecao] = useState<{ N?: string; P?: string; K?: string }>({});

  // Auto-seleciona a melhor fonte de cada nutriente assim que o catálogo chega
  useEffect(() => {
    if (loadingCatalogo) return;
    setSelecao(prev => {
      const next = { ...prev };
      if (!next.N && fontesN.length) next.N = [...fontesN].sort((a, b) => (b.garantias["N"] ?? 0) - (a.garantias["N"] ?? 0))[0].id;
      if (!next.P && fontesP.length) next.P = [...fontesP].sort((a, b) => (b.garantias["P2O5"] ?? 0) - (a.garantias["P2O5"] ?? 0))[0].id;
      if (!next.K && fontesK.length) next.K = [...fontesK].sort((a, b) => (b.garantias["K2O"] ?? 0) - (a.garantias["K2O"] ?? 0))[0].id;
      return next;
    });
  }, [loadingCatalogo, fontesN, fontesP, fontesK]);

  // Sais finais para o engine: usa catálogo real se disponível, com fallback genérico
  const sais: SalDisponivel[] = useMemo(() => {
    if (saisCatalogo.length > 0) return saisCatalogo as SalDisponivel[];
    return [
      { id: "ureia", nome: "Ureia Branca", precoKg: 4.2, garantias: { N: 45 } },
      { id: "map", nome: "MAP Purificado", precoKg: 7.5, garantias: { P2O5: 60, N: 11 } },
      { id: "kcl", nome: "KCl Branco", precoKg: 4.8, garantias: { K2O: 60 } },
    ];
  }, [saisCatalogo]);

  // Restore via querystring (?restore=ID)
  useEffect(() => {
    const restoreId = searchParams.get("restore");
    if (!restoreId) return;
    const raw = sessionStorage.getItem("nutrir.npk_restore");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.id !== restoreId) return;
      const inp = data.inputs ?? {};
      if (inp.meta) setMeta(inp.meta);
      if (inp.modoEntrada) setModoEntrada(inp.modoEntrada);
      if (inp.demanda) setDemanda(inp.demanda);
      if (inp.formula) setFormula(inp.formula);
      if (inp.modoProducao) setModoProducao(inp.modoProducao);
      if (inp.modoAplicacao) setModoAplicacao(inp.modoAplicacao);
      if (typeof inp.entradasLavoura === "number") setEntradasLavoura(inp.entradasLavoura);
      if (typeof inp.vazao === "number") setVazao(inp.vazao);
      if (inp.precos) setPrecos(inp.precos);
      if (inp.selecao) setSelecao(inp.selecao);
      if (data.resultado) setResultado(data.resultado);
      sessionStorage.removeItem("nutrir.npk_restore");
      toast({ title: "Cálculo restaurado", description: "Você pode editar e recalcular." });
    } catch { /* ignore */ }
  }, [searchParams]);

  const calcular = () => {
    const dem: NPKDemanda = modoEntrada === "formula"
      ? (formulaParaDemanda(formula.formula, formula.doseKgHa) ?? demanda)
      : demanda;

    const fonteNId = selecao.N ?? sais.find(s => (s.garantias.N ?? 0) > 0)?.id ?? sais[0]?.id;
    const fontePId = selecao.P ?? sais.find(s => (s.garantias.P2O5 ?? 0) > 0)?.id ?? sais[0]?.id;
    const fonteKId = selecao.K ?? sais.find(s => (s.garantias.K2O ?? 0) > 0)?.id ?? sais[0]?.id;

    if (!fonteNId || !fontePId || !fonteKId) {
      toast({ title: "Catálogo incompleto", description: "Cadastre matérias-primas com garantias de N, P₂O₅ e K₂O.", variant: "destructive" });
      return;
    }

    const input: NPKInput = {
      modoEntrada, modoProducao, modoAplicacao,
      vazaoEquipamentoLHa: vazao,
      entradasLavoura, demanda: dem, areaHa: meta.areaHa,
      sais, selecao: { fonteNId, fontePId, fonteKId },
      precoTshL: precos.tsh, precoLifeGrowL: precos.lifeGrow, precoLegL: precos.leg,
      formulaCliente: modoEntrada === "formula" ? { formula: formula.formula, doseKgHa: formula.doseKgHa, precoKg: formula.precoKg } : undefined,
    };
    try {
      const r = calcularNPK(input);
      setResultado(r);
      toast({ title: "Cálculo concluído", description: r.resumo });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const exportarPDF = async () => {
    if (!resultado) return;
    const { gerarPdfNPK } = await import("@/lib/nutrir/npk-pdf");
    await gerarPdfNPK(resultado, meta);
  };

  const irParaPedido = () => {
    if (!resultado) return;
    const itensDraft = (resultado.custos ?? [])
      .filter((c: any) => c.quantidade > 0)
      .map((c: any) => ({
        produto_nome: c.item,
        quantidade: c.quantidade * (meta.areaHa || 1),
        unidade: c.unidade,
        preco_unitario: c.precoUnitario ?? 0,
      }));
    sessionStorage.setItem("nutrir.pedido_draft", JSON.stringify({
      origem: "calc_npk",
      titulo: `NPK — ${meta.fazenda || meta.produtor || meta.cultura}`,
      cliente_nome: meta.produtor || meta.fazenda || null,
      area_ha: meta.areaHa,
      observacoes: `Fertirrigação NPK · ${meta.cultura} · ${meta.areaHa} ha`,
      itens: itensDraft,
    }));
    navigate("/app/rep/pedidos");
  };

  const salvarHistorico = async () => {
    if (!resultado || !current || !user) {
      toast({ title: "Calcule antes de salvar", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const titulo = `${meta.cultura || "Cultura"} · ${meta.fazenda || meta.produtor || "sem identificação"}`;
    const inputs = { meta, modoEntrada, demanda, formula, modoProducao, modoAplicacao, entradasLavoura, vazao, precos, selecao };
    const { error } = await (supabase as any).from("nutrir_npk_historico").insert({
      organization_id: current.id,
      user_id: user.id,
      titulo,
      produtor: meta.produtor || null,
      fazenda: meta.fazenda || null,
      cultura: meta.cultura || null,
      area_ha: meta.areaHa,
      modo_aplicacao: modoAplicacao,
      modo_producao: modoProducao,
      custo_por_ha: resultado.custoPorHa,
      custo_total: resultado.custoTotal,
      economia_vs_mp_pct: resultado.comparativo.economiaVsMPPct,
      economia_vs_formulado_pct: resultado.comparativo.economiaVsFormuladoPct ?? null,
      inputs,
      resultado,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo no histórico", description: "Disponível em Histórico NPK." });
  };


  const chartData = resultado ? [
    { name: "MP simples", valor: resultado.comparativo.mpEquivalentesCustoHa, fill: "hsl(var(--muted-foreground))" },
    ...(resultado.comparativo.formuladoClienteCustoHa !== undefined
      ? [{ name: "Formulado", valor: resultado.comparativo.formuladoClienteCustoHa, fill: "#a16207" }] : []),
    { name: "NUTRIR", valor: resultado.comparativo.nutrirCustoHa, fill: "hsl(var(--primary))" },
  ] : [];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Atom className="w-5 h-5 text-primary"/>Calculadora NPK Complexado</span> as any}
        description="Adubação NPK via drench, fertirrigação ou nonino · sempre máxima concentração"
        actions={<>
          <ImportarLaudoButton onLaudo={(laudo) => {
            if (laudo.cultura) setMeta(m => ({ ...m, cultura: laudo.cultura! }));
            if (laudo.area_ha) setMeta(m => ({ ...m, areaHa: laudo.area_ha! }));
            if (laudo.produtor) setMeta(m => ({ ...m, produtor: laudo.produtor! }));
            if (laudo.fazenda) setMeta(m => ({ ...m, fazenda: laudo.fazenda! }));
            // Aplicação sugerida → drench/fertirrigacao/nonino/localizada
            const apl = laudo.aplicacao_sugerida;
            if (apl === "drench" || apl === "fertirrigacao" || apl === "nonino" || apl === "localizada") {
              setModoAplicacao(apl as ModoAplicacao);
            }
            // Demanda NPK direto do laudo
            if (laudo.demanda_npk) {
              setModoEntrada("nutrientes");
              setDemanda({
                nKgHa: laudo.demanda_npk.N,
                p2o5KgHa: laudo.demanda_npk.P2O5,
                k2oKgHa: laudo.demanda_npk.K2O,
              });
            }
          }} label="Importar laudo NPK"/>
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/nutrir/historico-npk")}>
            <History className="w-4 h-4 mr-1"/>Histórico
          </Button>
          {resultado && <Button variant="outline" onClick={exportarPDF}><FileDown className="w-4 h-4 mr-1"/>PDF</Button>}
          {resultado && <Button variant="outline" onClick={() => abrirWhatsApp({
            contexto: "npk",
            cliente: meta.produtor || meta.fazenda || null,
            cultura: meta.cultura || null,
            identificador: resultado.resumo,
            total: resultado.custoTotal,
            observacao: `Custo: R$ ${resultado.custoPorHa.toFixed(2)}/ha · Economia vs MP: ${resultado.comparativo.economiaVsMPPct?.toFixed(1)}%`,
          })}><MessageCircle className="w-4 h-4 mr-1"/>WhatsApp</Button>}
          {resultado && (
            <Button variant="outline" onClick={salvarHistorico} disabled={salvando}>
              <Save className="w-4 h-4 mr-1"/>{salvando ? "Salvando…" : "Salvar"}
            </Button>
          )}
          {resultado && (
            <Button onClick={irParaPedido} className="gap-1.5">
              <ShoppingCart className="w-4 h-4"/>Criar Pedido
            </Button>
          )}
          <Button onClick={calcular} className="bg-gradient-to-r from-primary to-primary/80">
            <Calculator className="w-4 h-4 mr-1"/>Calcular
          </Button>
        </>}/>

      <div className="p-4 md:p-6 grid lg:grid-cols-12 gap-4">
        {/* INPUTS */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Sprout className="w-4 h-4 text-primary"/>Identificação</h3>
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
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary"/>Demanda nutricional</h3>
            <Tabs value={modoEntrada} onValueChange={v => setModoEntrada(v as ModoEntradaNPK)}>
              <TabsList className="w-full">
                <TabsTrigger value="nutrientes" className="flex-1">N-P-K direto</TabsTrigger>
                <TabsTrigger value="formula" className="flex-1">Fórmula NPK</TabsTrigger>
              </TabsList>
              <TabsContent value="nutrientes" className="grid grid-cols-3 gap-3 mt-3">
                <Lbl t="N (kg/ha)"><Input type="number" value={demanda.nKgHa} onChange={e => setDemanda({ ...demanda, nKgHa: parseFloat(e.target.value) || 0 })}/></Lbl>
                <Lbl t="P₂O₅ (kg/ha)"><Input type="number" value={demanda.p2o5KgHa} onChange={e => setDemanda({ ...demanda, p2o5KgHa: parseFloat(e.target.value) || 0 })}/></Lbl>
                <Lbl t="K₂O (kg/ha)"><Input type="number" value={demanda.k2oKgHa} onChange={e => setDemanda({ ...demanda, k2oKgHa: parseFloat(e.target.value) || 0 })}/></Lbl>
              </TabsContent>
              <TabsContent value="formula" className="grid grid-cols-3 gap-3 mt-3">
                <Lbl t="Fórmula"><Input value={formula.formula} onChange={e => setFormula({ ...formula, formula: e.target.value })} placeholder="10-15-15"/></Lbl>
                <Lbl t="Dose (kg/ha)"><Input type="number" value={formula.doseKgHa} onChange={e => setFormula({ ...formula, doseKgHa: parseFloat(e.target.value) || 0 })}/></Lbl>
                <Lbl t="Preço (R$/kg)"><Input type="number" step="0.01" value={formula.precoKg} onChange={e => setFormula({ ...formula, precoKg: parseFloat(e.target.value) || 0 })}/></Lbl>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Modo de produção e aplicação</h3>
            <div className="grid grid-cols-2 gap-3">
              <Lbl t="Produção">
                <Select value={modoProducao} onValueChange={v => setModoProducao(v as ModoProducao)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completa">NPK Completa</SelectItem>
                    <SelectItem value="individuais">N / P / K individuais</SelectItem>
                    <SelectItem value="fracionada">Fracionada</SelectItem>
                  </SelectContent>
                </Select>
              </Lbl>
              <Lbl t="Aplicação">
                <Select value={modoAplicacao} onValueChange={v => setModoAplicacao(v as ModoAplicacao)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="drench">Drench</SelectItem>
                    <SelectItem value="fertirrigacao">Fertirrigação</SelectItem>
                    <SelectItem value="nonino">Nonino</SelectItem>
                    <SelectItem value="localizada">Localizada</SelectItem>
                  </SelectContent>
                </Select>
              </Lbl>
              <Lbl t="Nº entradas"><Input type="number" value={entradasLavoura} onChange={e => setEntradasLavoura(parseInt(e.target.value) || 1)}/></Lbl>
              <Lbl t="Vazão (L/ha)"><Input type="number" value={vazao} onChange={e => setVazao(parseFloat(e.target.value) || 0)}/></Lbl>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Lbl t="TSH R$/L"><Input type="number" step="0.01" value={precos.tsh} onChange={e => setPrecos({ ...precos, tsh: parseFloat(e.target.value) || 0 })}/></Lbl>
              <Lbl t="Life Grow R$/L"><Input type="number" step="0.01" value={precos.lifeGrow} onChange={e => setPrecos({ ...precos, lifeGrow: parseFloat(e.target.value) || 0 })}/></Lbl>
              <Lbl t="LEG R$/L"><Input type="number" step="0.01" value={precos.leg} onChange={e => setPrecos({ ...precos, leg: parseFloat(e.target.value) || 0 })}/></Lbl>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary"/>Fontes N · P · K
              {loadingCatalogo && <span className="text-xs text-muted-foreground font-normal">(carregando catálogo…)</span>}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <Lbl t={`Fonte de N (${fontesN.length} disponíveis)`}>
                <Select value={selecao.N ?? ""} onValueChange={v => setSelecao(s => ({ ...s, N: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar matéria-prima"/></SelectTrigger>
                  <SelectContent>
                    {fontesN.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} · N {s.garantias.N}% · {fmtBRL(s.precoKg)}/kg
                      </SelectItem>
                    ))}
                    {fontesN.length === 0 && <SelectItem value="_none" disabled>Sem matérias-primas com N cadastradas</SelectItem>}
                  </SelectContent>
                </Select>
              </Lbl>
              <Lbl t={`Fonte de P₂O₅ (${fontesP.length} disponíveis)`}>
                <Select value={selecao.P ?? ""} onValueChange={v => setSelecao(s => ({ ...s, P: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar matéria-prima"/></SelectTrigger>
                  <SelectContent>
                    {fontesP.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} · P₂O₅ {s.garantias.P2O5}% · {fmtBRL(s.precoKg)}/kg
                      </SelectItem>
                    ))}
                    {fontesP.length === 0 && <SelectItem value="_none" disabled>Sem matérias-primas com P₂O₅ cadastradas</SelectItem>}
                  </SelectContent>
                </Select>
              </Lbl>
              <Lbl t={`Fonte de K₂O (${fontesK.length} disponíveis)`}>
                <Select value={selecao.K ?? ""} onValueChange={v => setSelecao(s => ({ ...s, K: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar matéria-prima"/></SelectTrigger>
                  <SelectContent>
                    {fontesK.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} · K₂O {s.garantias.K2O}% · {fmtBRL(s.precoKg)}/kg
                      </SelectItem>
                    ))}
                    {fontesK.length === 0 && <SelectItem value="_none" disabled>Sem matérias-primas com K₂O cadastradas</SelectItem>}
                  </SelectContent>
                </Select>
              </Lbl>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              As fontes vêm das matérias-primas cadastradas com garantias reais. A melhor concentração é pré-selecionada automaticamente.
            </p>
          </Card>
        </div>

        {/* RESULTADO */}
        <div className="lg:col-span-7 space-y-4">
          {!resultado ? (
            <Card className="p-12 text-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <Atom className="w-16 h-16 mx-auto mb-4 text-primary/40"/>
              <h3 className="text-xl font-semibold mb-2">Calculadora NPK NUTRIR</h3>
              <p className="text-muted-foreground">Configure a demanda nutricional e o modo de produção, depois clique em <strong>Calcular</strong>.</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi t="Custo NUTRIR" v={moeda(resultado.custoPorHa) + "/ha"} c="text-primary"/>
                <Kpi t="vs MP simples" v={`${resultado.comparativo.economiaVsMPPct.toFixed(1)}%`}
                  sub={`${moeda(Math.abs(resultado.comparativo.economiaVsMPHa))}/ha`}
                  c={resultado.comparativo.economiaVsMPHa >= 0 ? "text-[#b08826]" : "text-destructive"} icon={TrendingDown}/>
                {resultado.comparativo.economiaVsFormuladoPct !== undefined &&
                  <Kpi t="vs Formulado" v={`${resultado.comparativo.economiaVsFormuladoPct.toFixed(1)}%`}
                    sub={`${moeda(Math.abs(resultado.comparativo.economiaVsFormuladoHa ?? 0))}/ha`}
                    c={(resultado.comparativo.economiaVsFormuladoHa ?? 0) >= 0 ? "text-[#b08826]" : "text-destructive"}/>}
                <Kpi t="Total na área" v={moeda(resultado.custoTotal)}/>
              </div>

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
              </Card>

              <Card className="p-4">
                <Tabs defaultValue="massas">
                  <TabsList>
                    <TabsTrigger value="massas">Massas / Demanda</TabsTrigger>
                    <TabsTrigger value="batidas">Batidas ({resultado.batidas.length})</TabsTrigger>
                    <TabsTrigger value="custos">Custos</TabsTrigger>
                    {resultado.alertas.length > 0 && <TabsTrigger value="alertas" className="text-amber-600"><AlertTriangle className="w-3 h-3 mr-1"/>Alertas</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="massas">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr><th className="text-left py-1">Nutriente</th><th className="text-right">Demanda kg/ha</th><th className="text-right">NUTRIR (reduzido)</th></tr>
                      </thead>
                      <tbody>
                        <tr className="border-b"><td className="py-1.5"><Badge variant="outline">N</Badge></td><td className="text-right">{num(resultado.demanda.nKgHa)}</td><td className="text-right text-primary font-medium">{num(resultado.massas.nReduzidoKgHa)}</td></tr>
                        <tr className="border-b"><td className="py-1.5"><Badge variant="outline">P₂O₅</Badge></td><td className="text-right">{num(resultado.demanda.p2o5KgHa)}</td><td className="text-right text-primary font-medium">{num(resultado.massas.pReduzidoKgHa)}</td></tr>
                        <tr className="border-b"><td className="py-1.5"><Badge variant="outline">K₂O</Badge></td><td className="text-right">{num(resultado.demanda.k2oKgHa)}</td><td className="text-right text-primary font-medium">{num(resultado.massas.kReduzidoKgHa)}</td></tr>
                      </tbody>
                    </table>
                    <div className="mt-4 p-3 bg-primary/5 rounded text-sm">
                      <strong>Matérias-primas:</strong> {num(resultado.massas.ureiaKgHa)} kg Ureia + {num(resultado.massas.mapKgHa)} kg MAP + {num(resultado.massas.kclKgHa)} kg KCl por ha
                    </div>
                  </TabsContent>

                  <TabsContent value="batidas">
                    <div className="space-y-3 max-h-[420px] overflow-y-auto">
                      {resultado.batidas.map((b, i) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{b.nome}</h4>
                            <div className="text-xs text-muted-foreground">calda {num(b.volumeCaldaL, 0)} L · vazão {num(b.vazaoLHa, 0)} L/ha</div>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground border-b">
                              <tr><th className="text-left">#</th><th className="text-left">Ingrediente</th><th className="text-right">Qtd</th><th className="text-left pl-2">Instrução</th></tr>
                            </thead>
                            <tbody>
                              {b.receita1000L.map(r => (
                                <tr key={r.ordem} className="border-b last:border-b-0">
                                  <td className="py-1">{r.ordem}</td>
                                  <td>{r.ingrediente}</td>
                                  <td className="text-right font-mono">{num(r.quantidade, 1)} {r.unidade}</td>
                                  <td className="pl-2 text-muted-foreground">{r.instrucao}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="custos">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr><th className="text-left py-1">Item</th><th className="text-right">Quantidade</th><th className="text-right">R$/un</th><th className="text-right">Total</th></tr>
                      </thead>
                      <tbody>
                        {resultado.custos.map((c, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1.5">{c.item}</td>
                            <td className="text-right">{num(c.quantidade, 1)} {c.unidade}</td>
                            <td className="text-right">{moeda(c.precoUnitario)}</td>
                            <td className="text-right font-mono">{moeda(c.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="font-bold">
                        <tr><td colSpan={3} className="py-2 text-right">TOTAL/ha</td><td className="text-right font-mono text-primary">{moeda(resultado.custoPorHa)}</td></tr>
                      </tfoot>
                    </table>
                  </TabsContent>

                  {resultado.alertas.length > 0 && <TabsContent value="alertas">
                    <ul className="space-y-2">
                      {resultado.alertas.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"/><span>{a}</span>
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
  return <div><label className="text-xs font-medium text-muted-foreground">{t}</label>{children}</div>;
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
