import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Leaf, FileSpreadsheet, FlaskConical, Plus, Trash2, Download,
  Sprout, Ruler, Calculator, Wand2, ChevronRight, Database,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { formatBRL } from "@/lib/nutrir/precos-engine";

/*
  Orçamento Consultoria + Nutrição (wizard unificado)
  ─────────────────────────────────────────────────────
  4 passos:
   1. Cliente & Fazendas (importa cadastro ou manual)
   2. Cultivos por fazenda  (cultura, área, gride/talhão, nº amostras)
   3. Recomendação Nutricional (N180, N180+B, N180+micros, NPK, Foliar, etc.)
   4. Resumo & PDF Canva-style
*/

type CulturaTipo = "soja" | "milho" | "perene" | "anual";

interface Cultivo {
  id: string;
  fazenda_id: string;     // referência local
  cultura_id: string;
  cultura_nome: string;
  cultura_tipo: CulturaTipo;
  area_ha: number;
  modo_grid: "gride" | "talhao";
  grid_ha: number;        // só usado se modo_grid === "gride"
  n_talhoes: number;      // só usado se modo_grid === "talhao"
  n_amostras_ciclo: number;
  // Nutrição
  vazao_pulverizador: number;
  adubacoes: {
    n180: boolean;
    n180_boro: boolean;
    n180_micros: boolean;
    n32: boolean;
    n32_boro: boolean;
    npk: boolean;
    foliar: boolean;
  };
  obs: string;
}

interface FazendaLocal {
  id: string;          // local UUID
  nome: string;
  ie?: string;
  endereco?: string;
}

interface ClienteRef {
  id: string;
  nome: string;
  doc: string;
}

const AMOSTRAS_PADRAO = (tipo: CulturaTipo): number => {
  switch (tipo) {
    case "soja":   return 5;
    case "milho":  return 4;
    case "perene": return 8;
    default:       return 4; // demais anuais
  }
};

export default function OrcamentoConsultoriaNutricao() {
  const { current } = useOrg();

  // ── Step 1: cliente ─────────────────────────────────────────────────────
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteManualNome, setClienteManualNome] = useState("");
  const [usaCadastro, setUsaCadastro] = useState(true);
  const cliente = useMemo(() => clientes.find(c => c.id === clienteId), [clientes, clienteId]);

  // ── Step 2: fazendas & cultivos ─────────────────────────────────────────
  const [fazendas, setFazendas] = useState<FazendaLocal[]>([
    { id: crypto.randomUUID(), nome: "Fazenda 1" },
  ]);
  const [cultivos, setCultivos] = useState<Cultivo[]>([]);
  const [culturasCatalogo, setCulturasCatalogo] = useState<{ id: string; nome: string; tipo: CulturaTipo }[]>([]);

  // ── Step 3: parâmetros admin ────────────────────────────────────────────
  const [paramAdm, setParamAdm] = useState<{ custo_amostra: number; meta_lucratividade: number }>({
    custo_amostra: 350, meta_lucratividade: 45,
  });
  const precoAmostra = paramAdm.custo_amostra * (1 + paramAdm.meta_lucratividade / 100);

  // ── Step 4: desconto ────────────────────────────────────────────────────
  const [descontoPct, setDescontoPct] = useState(0);

  // Step UI
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Carregamento ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    (async () => {
      const [{ data: c }, { data: cu }, { data: pc }] = await Promise.all([
        (supabase as any).from("nutrir_clientes").select("id, razao_social, nome_fantasia, cnpj, cpf").eq("organization_id", current.id).order("razao_social"),
        (supabase as any).from("nutrir_culturas").select("id, nome, tipo").eq("organization_id", current.id),
        (supabase as any).from("nutrir_parametros_consultoria").select("*").eq("organization_id", current.id).maybeSingle(),
      ]);
      setClientes(
        (c ?? []).map((x: any) => ({
          id: x.id,
          nome: x.nome_fantasia || x.razao_social,
          doc:  x.cnpj || x.cpf || "",
        })),
      );
      setCulturasCatalogo(
        (cu ?? []).map((x: any) => ({
          id: x.id, nome: x.nome,
          tipo: classificarCultura(x.nome, x.tipo),
        })),
      );
      if (pc) setParamAdm({
        custo_amostra: pc.custo_amostra ?? 350,
        meta_lucratividade: pc.meta_lucratividade ?? 45,
      });
    })();
  }, [current?.id]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const addFazenda = () => setFazendas(f => [...f, { id: crypto.randomUUID(), nome: `Fazenda ${f.length + 1}` }]);
  const removeFazenda = (id: string) => {
    setFazendas(f => f.filter(x => x.id !== id));
    setCultivos(c => c.filter(x => x.fazenda_id !== id));
  };

  const addCultivo = (fazendaId: string) => {
    setCultivos(c => [
      ...c,
      {
        id: crypto.randomUUID(),
        fazenda_id: fazendaId,
        cultura_id: "",
        cultura_nome: "",
        cultura_tipo: "anual",
        area_ha: 0,
        modo_grid: "gride",
        grid_ha: 50,
        n_talhoes: 1,
        n_amostras_ciclo: 4,
        vazao_pulverizador: 100,
        adubacoes: {
          n180: false, n180_boro: false, n180_micros: false,
          n32: false, n32_boro: false, npk: false, foliar: false,
        },
        obs: "",
      },
    ]);
  };

  const updateCultivo = (id: string, patch: Partial<Cultivo>) => {
    setCultivos(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const removeCultivo = (id: string) => setCultivos(cs => cs.filter(c => c.id !== id));

  // ── Cálculos ────────────────────────────────────────────────────────────
  const calcAmostras = (c: Cultivo): number => {
    const grid = c.modo_grid === "gride" ? c.grid_ha : (c.area_ha / Math.max(1, c.n_talhoes));
    if (!grid || !c.area_ha) return 0;
    return Math.ceil((c.area_ha / grid) * (c.n_amostras_ciclo / 4)); // proporcional ao padrão soja/anual
  };
  const calcCustoHa = (c: Cultivo): number => {
    const amostras = calcAmostras(c);
    if (!c.area_ha) return 0;
    return (amostras * precoAmostra) / c.area_ha;
  };

  const resumoGeral = useMemo(() => {
    const totalArea = cultivos.reduce((s, c) => s + (c.area_ha || 0), 0);
    const totalAmostras = cultivos.reduce((s, c) => s + calcAmostras(c), 0);
    const subtotalConsultoria = totalAmostras * precoAmostra;
    const valor_medio_ha = totalArea > 0 ? subtotalConsultoria / totalArea : 0;
    const desconto = subtotalConsultoria * (descontoPct / 100);
    const total = subtotalConsultoria - desconto;
    return { totalArea, totalAmostras, subtotalConsultoria, valor_medio_ha, desconto, total };
  }, [cultivos, precoAmostra, descontoPct]);

  const adubacaoSelecionada = (c: Cultivo) =>
    Object.entries(c.adubacoes).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(" + ") || "—";

  const podeAvancar = () => {
    if (step === 1) return usaCadastro ? !!clienteId : clienteManualNome.length >= 3;
    if (step === 2) return cultivos.length > 0 && cultivos.every(c => c.cultura_id && c.area_ha > 0);
    return true;
  };

  const gerarPDF = async () => {
    toast.info("Geração de PDF unificado: chamando motor /lib/nutrir/pdf-unified");
    try {
      const { gerarOrcamentoCompletoPDF } = await import("@/lib/nutrir/pdf-unified");
      await gerarOrcamentoCompletoPDF({
        cliente: cliente?.nome || clienteManualNome,
        cliente_doc: cliente?.doc || "",
        fazendas: fazendas.map(f => ({ ...f, cultivos: cultivos.filter(c => c.fazenda_id === f.id) })),
        resumo: resumoGeral,
        preco_amostra: precoAmostra,
        desconto_pct: descontoPct,
      } as any);
      toast.success("PDF gerado com sucesso");
    } catch (e: any) {
      toast.error("Não foi possível gerar o PDF: " + (e?.message ?? "erro desconhecido"));
    }
  };

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Leaf className="w-6 h-6 text-primary" /> Orçamento Consultoria + Nutrição</span>}
        description="Wizard unificado: consultoria (amostragem) + recomendação nutricional → PDF Canva"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/nutrir/orcamento"><FileSpreadsheet className="w-4 h-4 mr-1" />Só Consultoria</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/nutrir/orcamentos">Salvos</Link>
            </Button>
          </div>
        }
      />

      <div className="p-3 md:p-6 space-y-4 max-w-6xl">
        {/* ── Stepper ────────────────────────────────────────────────── */}
        <Card className="shadow-soft">
          <CardContent className="py-3 flex flex-wrap items-center gap-2 text-xs">
            {([1, 2, 3, 4] as const).map((n, i, arr) => (
              <span key={n} className="flex items-center gap-2">
                <Badge variant={step === n ? "default" : step > n ? "secondary" : "outline"} className="rounded-full w-6 h-6 grid place-items-center p-0">{n}</Badge>
                <span className={step === n ? "font-bold" : "text-muted-foreground"}>
                  {["Cliente", "Fazendas & Cultivos", "Nutrição & Adubação", "Resumo / PDF"][i]}
                </span>
                {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </span>
            ))}
          </CardContent>
        </Card>

        {/* ── Step 1 ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Cliente</CardTitle>
              <CardDescription>Importe um cliente cadastrado ou preencha manualmente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-center">
                <Checkbox checked={usaCadastro} onCheckedChange={v => setUsaCadastro(v as boolean)} id="usacad" />
                <Label htmlFor="usacad" className="cursor-pointer">Usar cliente cadastrado</Label>
              </div>
              {usaCadastro ? (
                <div>
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente cadastrado…" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} — {c.doc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Nome do cliente</Label>
                  <Input value={clienteManualNome} onChange={e => setClienteManualNome(e.target.value)} placeholder="Ex: Fazendas São João" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 2 ─────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Fazendas e Cultivos</h3>
              <Button size="sm" onClick={addFazenda}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar Fazenda</Button>
            </div>

            {fazendas.map((f, fi) => (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={f.nome}
                      onChange={e => setFazendas(fs => fs.map(x => x.id === f.id ? { ...x, nome: e.target.value } : x))}
                      className="font-bold border-none px-0 h-auto py-0 text-base focus-visible:ring-0"
                    />
                    {fazendas.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeFazenda(f.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cultivos.filter(c => c.fazenda_id === f.id).map(c => (
                    <CultivoForm
                      key={c.id} c={c}
                      culturasCatalogo={culturasCatalogo}
                      onChange={(p) => updateCultivo(c.id, p)}
                      onRemove={() => removeCultivo(c.id)}
                      preco_amostra={precoAmostra}
                    />
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addCultivo(f.id)}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Adicionar cultivo nessa fazenda
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Step 3 ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Recomendação Nutricional por Cultivo</CardTitle>
              <CardDescription>
                Selecione os tipos de adubação. Para cálculo detalhado de cada formulação use as calculadoras
                <Link to="/app/nutrir/calculadora-npk" className="text-primary mx-1">NPK</Link> e
                <Link to="/app/nutrir/calculadora-foliar" className="text-primary mx-1">Foliar</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cultivos.map(c => (
                <div key={c.id} className="border rounded p-3 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{c.cultura_nome || "(sem cultura)"} — {c.area_ha} ha</div>
                      <div className="text-xs text-muted-foreground">{adubacaoSelecionada(c)}</div>
                    </div>
                    <Badge variant="secondary">{calcAmostras(c)} amostras</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {(["n180","n180_boro","n180_micros","n32","n32_boro","npk","foliar"] as const).map(k => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-accent">
                        <Checkbox
                          checked={c.adubacoes[k]}
                          onCheckedChange={v => updateCultivo(c.id, { adubacoes: { ...c.adubacoes, [k]: v as boolean } })}
                        />
                        <span className="uppercase font-mono text-[10px]">{k.replace("_", "+")}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Vazão pulverizador (L/ha)</Label>
                      <Input type="number" value={c.vazao_pulverizador}
                        onChange={e => updateCultivo(c.id, { vazao_pulverizador: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Observação técnica</Label>
                      <Textarea rows={2} value={c.obs} onChange={e => updateCultivo(c.id, { obs: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              {cultivos.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Volte ao Passo 2 para adicionar cultivos.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 4 ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" />Resumo do Orçamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Cliente" value={cliente?.nome || clienteManualNome} bold />
                <Row label="Fazendas" value={String(fazendas.length)} />
                <Row label="Cultivos" value={String(cultivos.length)} />
                <Row label="Área total" value={`${resumoGeral.totalArea.toLocaleString("pt-BR")} ha`} />
                <Row label="Amostras totais" value={String(resumoGeral.totalAmostras)} />
                <div className="border-t pt-2 mt-2">
                  <Row label="Preço por amostra" value={formatBRL(precoAmostra)} subdued />
                  <Row label="Subtotal consultoria" value={formatBRL(resumoGeral.subtotalConsultoria)} />
                </div>
                <div className="border-t pt-2 mt-2 flex items-center gap-2">
                  <Label className="text-xs">Desconto (consultoria + complexadores):</Label>
                  <Input
                    type="number" min={0} max={50} step="0.5"
                    value={descontoPct} onChange={e => setDescontoPct(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Row label="Desconto aplicado" value={`- ${formatBRL(resumoGeral.desconto)}`} subdued />
                <div className="border-t pt-2 mt-2">
                  <Row label="TOTAL CONSULTORIA" value={formatBRL(resumoGeral.total)} bold />
                  <Row label="Valor médio /ha" value={formatBRL(resumoGeral.valor_medio_ha)} subdued />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximos passos</CardTitle>
                <CardDescription>Para cada cultivo, complete a recomendação nutricional nas calculadoras e gere o PDF</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Link to="/app/nutrir/calculadora-npk"><FlaskConical className="w-5 h-5" /><span>Detalhar NPK</span></Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
                  <Link to="/app/nutrir/calculadora-foliar"><Leaf className="w-5 h-5" /><span>Detalhar Foliar</span></Link>
                </Button>
                <Button onClick={gerarPDF} className="h-auto py-4 flex-col gap-2 bg-gradient-primary">
                  <Download className="w-5 h-5" /><span>Gerar PDF unificado</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="py-3 text-xs text-muted-foreground flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Comparativo Convencional vs Programa Nutrir é gerado no PDF (usa preços do Painel Custo de Análise).
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Navegação ──────────────────────────────────────────────── */}
        <div className="flex justify-between sticky bottom-0 bg-background py-3">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1) as any)}>
            ← Voltar
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(s => Math.min(4, s + 1) as any)} disabled={!podeAvancar()}>
              Próximo →
            </Button>
          ) : (
            <Button onClick={gerarPDF} className="bg-gradient-primary">
              <Wand2 className="w-4 h-4 mr-1" />Gerar Orçamento
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function CultivoForm({
  c, culturasCatalogo, onChange, onRemove, preco_amostra,
}: {
  c: Cultivo;
  culturasCatalogo: { id: string; nome: string; tipo: CulturaTipo }[];
  onChange: (p: Partial<Cultivo>) => void;
  onRemove: () => void;
  preco_amostra: number;
}) {
  const grid = c.modo_grid === "gride" ? c.grid_ha : (c.area_ha / Math.max(1, c.n_talhoes));
  const n_amostras = grid && c.area_ha ? Math.ceil((c.area_ha / grid) * (c.n_amostras_ciclo / 4)) : 0;
  const custo_ha = c.area_ha ? (n_amostras * preco_amostra) / c.area_ha : 0;

  return (
    <div className="border rounded p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <Sprout className="w-4 h-4 text-primary" />
        <Button size="icon" variant="ghost" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
      <div className="grid md:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Cultura</Label>
          <Select
            value={c.cultura_id}
            onValueChange={v => {
              const cu = culturasCatalogo.find(x => x.id === v);
              if (cu) onChange({
                cultura_id: cu.id, cultura_nome: cu.nome, cultura_tipo: cu.tipo,
                n_amostras_ciclo: AMOSTRAS_PADRAO(cu.tipo),
              });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
            <SelectContent>
              {culturasCatalogo.map(cu => <SelectItem key={cu.id} value={cu.id}>{cu.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Área</Label>
          <div className="relative">
            <Input
              type="number" value={c.area_ha}
              onChange={e => onChange({ area_ha: parseFloat(e.target.value) || 0 })}
              className="pr-8"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ha</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">Modo</Label>
          <Select value={c.modo_grid} onValueChange={v => onChange({ modo_grid: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gride">GRIDE</SelectItem>
              <SelectItem value="talhao">Talhão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          {c.modo_grid === "gride" ? (
            <>
              <Label className="text-xs">GRIDE (ha)</Label>
              <Input type="number" value={c.grid_ha} onChange={e => onChange({ grid_ha: parseFloat(e.target.value) || 0 })} />
            </>
          ) : (
            <>
              <Label className="text-xs">Nº Talhões</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={c.n_talhoes} onChange={e => onChange({ n_talhoes: parseInt(e.target.value) || 1 })} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  <Ruler className="inline w-3 h-3" /> {c.area_ha && c.n_talhoes ? (c.area_ha / c.n_talhoes).toFixed(1) : 0} ha
                </span>
              </div>
            </>
          )}
        </div>
        <div className="md:col-span-1">
          <Label className="text-xs">Nº amostras / ciclo</Label>
          <Input type="number" value={c.n_amostras_ciclo} onChange={e => onChange({ n_amostras_ciclo: parseInt(e.target.value) || 4 })} />
        </div>
      </div>
      <div className="bg-primary/5 rounded px-3 py-2 text-xs flex flex-wrap items-baseline gap-4">
        <span><b>Amostras calculadas:</b> {n_amostras}</span>
        <span><b>Custo/ha:</b> {formatBRL(custo_ha)}</span>
        <span className="text-muted-foreground">Fórmula: ⌈(área / gride) × (n / 4)⌉</span>
      </div>
    </div>
  );
}

const Row = ({ label, value, subdued, bold }: { label: string; value: string; subdued?: boolean; bold?: boolean }) => (
  <div className={`flex justify-between items-baseline ${subdued ? "text-muted-foreground" : ""} ${bold ? "font-bold" : ""}`}>
    <span className="text-sm">{label}</span>
    <span className={`font-mono ${bold ? "text-base text-primary" : "text-sm"}`}>{value}</span>
  </div>
);

// Heurística para classificar cultura quando o tipo no DB não traz o esperado
function classificarCultura(nome: string, tipo?: string): CulturaTipo {
  const n = (nome || "").toLowerCase();
  if (n.includes("soja")) return "soja";
  if (n.includes("milho")) return "milho";
  if (tipo === "perene") return "perene";
  if (["café", "cafe", "cana", "citros", "laranja", "mamao", "mamão", "uva", "abacate", "manga", "banana", "eucalipto"].some(k => n.includes(k))) return "perene";
  return "anual";
}
