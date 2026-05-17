import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Camera, Sparkles, FileText, Trash2, FlaskConical,
  ImagePlus, X, Map as MapIcon, Satellite, ChevronRight, Leaf, Scale,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MapaTalhao } from "@/components/nutrir/MapaTalhao";

/* ─── tipos ─────────────────────────────────────────────── */
type Produto = {
  produto_id: string | null;
  nome: string;
  area_ha: number;
  dose: string;
  estagio: string;
  observacao: string;
};

type LadoItem = {
  produto_id: string | null;
  nome: string;
  dose: string;
  garantias: string;
};

const TIPOS_TESTE = [
  "TS (Tratamento de Sementes)",
  "Condicionador de Solos",
  "Tecnologia de Aplicação",
  "Bioestimulantes",
  "Nutrição Foliar",
  "Biológicos",
  "Complexação",
  "Outro",
] as const;

const NUTRIENTES = ["N", "P", "K", "Boro", "Micronutrientes"] as const;

const ADUBOS_POR_NUTRIENTE: Record<string, string[]> = {
  N: ["Ureia (46% N)", "MAP", "DAP", "Nitrato de Amônio", "Sulfato de Amônio", "UAN (Solução Nitrogenada)"],
  P: ["MAP (48% P₂O₅)", "DAP", "Superfosfato Simples (18%)", "Superfosfato Triplo (41%)", "Termofosfato"],
  K: ["KCl (60% K₂O)", "K₂SO₄ — Sulfato de Potássio", "KNO₃ — Nitrato de Potássio"],
  Boro: ["Ácido Bórico (17,4% B)", "Bórax (11,3% B)", "Borogran", "Ulexita"],
  Micronutrientes: ["Zinco Sulfato", "Manganês Sulfato", "Cobre Sulfato", "Molibdato de Sódio", "FTE BR-12", "Zinco + Manganês (combo)"],
};

// Para cada nutriente — qual produto Nutrir substitui (auto-fill tratamento)
const NUTRIR_POR_NUTRIENTE: Record<string, string> = {
  N:              "N180 Complexado",
  P:              "Complexador Fosfatado Nutrir",
  K:              "Complexador Potássico Nutrir",
  Boro:           "N180+B (Boro Complexado)",
  Micronutrientes:"Foliar Micro Nutrir",
};

const ESTAGIOS_APLICACAO = [
  "TS (Tratamento de Sementes)",
  "Sulco de Plantio",
  "Vegetativo",
  "Reprodutivo",
] as const;

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  em_andamento: "default", finalizado: "secondary", cancelado: "destructive",
};

/* ─── formatação de área ─────────────────────────────────── */
function formatArea(raw: string): string {
  const num = parseFloat(raw.replace(",", "."));
  if (isNaN(num)) return raw;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

/* ═══════════════════════════════════════════════════════════ */
export default function CamposTeste() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const clienteFiltroDaUrl = searchParams.get("cliente");

  const [items, setItems] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtosDB, setProdutosDB] = useState<{ id: string; nome: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [openRel, setOpenRel] = useState(false);
  const [genIA, setGenIA] = useState(false);
  const [ndviSerie, setNdviSerie] = useState<any[]>([]);
  const [ndviLoading, setNdviLoading] = useState(false);

  /* ── form principal ── */
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [cultura, setCultura] = useState("");
  const [variedade, setVariedade] = useState("");
  const [dataPlantio, setDataPlantio] = useState("");
  const [areaTotal, setAreaTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([
    { produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" },
  ]);
  const [novaGeo, setNovaGeo] = useState<any | null>(null);
  const [novoCentro, setNovoCentro] = useState<[number, number] | null>(null);
  const [showMapaNovo, setShowMapaNovo] = useState(false);

  /* ── novos campos ── */
  const [tipoTeste, setTipoTeste] = useState("");
  const [nutrientesSubstituir, setNutrientesSubstituir] = useState<string[]>([]);
  const [adubosSubstituir, setAdubosSubstituir] = useState<Record<string, string>>({});
  const [adubosNPKFormulado, setAdubosNPKFormulado] = useState(false);
  const [adubosNPKGrade, setAdubosNPKGrade] = useState(""); // "20-05-20"
  const [boroKgHa, setBoroKgHa] = useState("");
  const [microGrHa, setMicroGrHa] = useState<Record<string, string>>({}); // micronutriente → gr/ha
  const [estagioAplicacao, setEstagioAplicacao] = useState("");
  const [estagioDetalhe, setEstagioDetalhe] = useState("");

  /* ── lado a lado (testemunha vs tratamento) ── */
  const [testemunha, setTestemunha] = useState<LadoItem>({ produto_id: null, nome: "", dose: "", garantias: "" });
  const [tratamento, setTratamento] = useState<LadoItem>({ produto_id: null, nome: "", dose: "", garantias: "" });
  const [fotoTestemunha, setFotoTestemunha] = useState<File | null>(null);
  const [fotoTratamento, setFotoTratamento] = useState<File | null>(null);

  /* ── form acompanhamento ── */
  const [relData, setRelData] = useState(new Date().toISOString().slice(0, 10));
  const [relEstagio, setRelEstagio] = useState("");
  const [relObs, setRelObs] = useState("");
  const [relNdvi, setRelNdvi] = useState("");
  const [relFotos, setRelFotos] = useState<File[]>([]);
  const [relNovaAplicacao, setRelNovaAplicacao] = useState(false);
  const [relProdutoAplicado, setRelProdutoAplicado] = useState("");
  const [relDoseAplicada, setRelDoseAplicada] = useState("");
  // Biometria completa
  const [relAlturaPlanta, setRelAlturaPlanta] = useState("");
  const [relStandMLinear, setRelStandMLinear] = useState("");
  const [relPeso1000Graos, setRelPeso1000Graos] = useState("");
  const [relComprimentoRaiz, setRelComprimentoRaiz] = useState("");
  const [relDiametroCaule, setRelDiametroCaule] = useState("");
  const [relNumTrifolios, setRelNumTrifolios] = useState("");
  const [relNumRamos, setRelNumRamos] = useState("");
  const [relNumVagens, setRelNumVagens] = useState("");
  const [relNumGraosPorVagem, setRelNumGraosPorVagem] = useState("");
  const [relBiometriaFotos, setRelBiometriaFotos] = useState<File[]>([]);
  // Deficiência / IA
  const [relTemDeficiencia, setRelTemDeficiencia] = useState(false);
  const [diagIA, setDiagIA] = useState("");
  const [diagLoading, setDiagLoading] = useState(false);
  const [fotosDiag, setFotosDiag] = useState<File[]>([]);

  /* ─── carregamento ─── */
  const load = async () => {
    if (!current) return;
    const { data } = await supabase
      .from("nutrir_campos_teste" as any)
      .select("*")
      .eq("organization_id", current.id)
      .order("created_at", { ascending: false });
    setItems((data as any[]) ?? []);

    const { data: cli } = await supabase
      .from("nutrir_clientes")
      .select("id, razao_social")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("razao_social");
    setClientes(cli ?? []);

    const { data: prods } = await supabase
      .from("nutrir_produtos")
      .select("id, nome")
      .eq("organization_id", current.id)
      .eq("ativo", true)
      .order("nome");
    setProdutosDB((prods as any[]) ?? []);
  };

  useEffect(() => { load(); }, [current?.id]);

  useEffect(() => {
    if (!clienteFiltroDaUrl || items.length === 0) return;
    const ativo =
      items.find((i) => i.cliente_id === clienteFiltroDaUrl && i.status === "em_andamento") ??
      items.find((i) => i.cliente_id === clienteFiltroDaUrl);
    if (ativo) {
      setSelected(ativo);
      loadRelatorios(ativo.id);
      loadNdvi(ativo.id);
      toast.info("Teste do cliente carregado automaticamente");
    }
  }, [clienteFiltroDaUrl, items.length]); // eslint-disable-line

  const loadRelatorios = async (campoId: string) => {
    const { data } = await supabase
      .from("nutrir_campos_teste_relatorios" as any)
      .select("*")
      .eq("campo_teste_id", campoId)
      .order("data", { ascending: true });
    setRelatorios((data as any[]) ?? []);
  };

  const loadNdvi = async (campoId: string) => {
    const { data } = await supabase
      .from("nutrir_campos_teste_ndvi" as any)
      .select("*")
      .eq("campo_teste_id", campoId)
      .order("data", { ascending: true });
    setNdviSerie((data as any[]) ?? []);
  };

  const salvarGeometria = async (geo: any, centro: [number, number]) => {
    if (!selected) return;
    const { error } = await supabase
      .from("nutrir_campos_teste" as any)
      .update({ geometria: geo, centro_lat: centro[0], centro_lng: centro[1] })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Talhão salvo!");
    const { data } = await supabase.from("nutrir_campos_teste" as any).select("*").eq("id", selected.id).single();
    setSelected(data);
    load();
  };

  const gerarNdvi = async (mode: "latest" | "history") => {
    if (!selected) return;
    if (!selected.geometria) return toast.error("Desenhe e salve o talhão antes.");
    setNdviLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("campo-teste-ndvi", {
        body: { campo_teste_id: selected.id, mode },
      });
      if (error) throw error;
      toast.success(`NDVI atualizado (${data?.count ?? 0} pontos)`);
      loadNdvi(selected.id);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao buscar NDVI");
    } finally { setNdviLoading(false); }
  };

  /* ─── reset form ─── */
  const reset = () => {
    setTitulo(""); setClienteId(""); setCultura(""); setVariedade("");
    setDataPlantio(""); setAreaTotal(""); setObservacoes("");
    setProdutos([{ produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" }]);
    setNovaGeo(null); setNovoCentro(null); setShowMapaNovo(false);
    setTipoTeste(""); setNutrientesSubstituir([]); setAdubosSubstituir({});
    setEstagioAplicacao(""); setEstagioDetalhe("");
    setTestemunha({ produto_id: null, nome: "", dose: "", garantias: "" });
    setTratamento({ produto_id: null, nome: "", dose: "", garantias: "" });
    setFotoTestemunha(null); setFotoTratamento(null);
  };

  /* ─── helpers produtos ─── */
  const addProduto = () => setProdutos([...produtos, { produto_id: null, nome: "", area_ha: 0, dose: "", estagio: "", observacao: "" }]);
  const rmProduto = (i: number) => setProdutos(produtos.filter((_, k) => k !== i));
  const updProduto = (i: number, p: Partial<Produto>) =>
    setProdutos(produtos.map((x, k) => (k === i ? { ...x, ...p } : x)));

  /* ─── toggle nutriente (Complexação) ─── */
  const toggleNutriente = (n: string) => {
    setNutrientesSubstituir((prev) => {
      if (prev.includes(n)) {
        const next = prev.filter((x) => x !== n);
        setAdubosSubstituir((a) => { const c = { ...a }; delete c[n]; return c; });
        return next;
      }
      const next = [...prev, n];
      // Auto-fill tratamento com o produto Nutrir correspondente (se ainda não preenchido)
      if (!tratamento.nome) {
        const nutrir = next.map(x => NUTRIR_POR_NUTRIENTE[x]).filter(Boolean).join(" + ");
        setTratamento(t => ({ ...t, nome: nutrir, produto_id: null }));
      }
      return next;
    });
  };

  /* ─── ao selecionar adubo convencional → auto-fill testemunha ─── */
  const onAduboChange = (nutriente: string, adubo: string) => {
    setAdubosSubstituir((a) => ({ ...a, [nutriente]: adubo }));
    // Concatena todos os adubos selecionados como nome da testemunha
    const todosAdubos = { ...adubosSubstituir, [nutriente]: adubo };
    const nomeTest = nutrientesSubstituir
      .map(n => todosAdubos[n])
      .filter(Boolean)
      .join(" + ");
    setTestemunha(t => ({ ...t, nome: nomeTest, produto_id: null }));
    // Atualiza tratamento com todos os Nutrir correspondentes
    const nomeTrat = nutrientesSubstituir
      .map(n => NUTRIR_POR_NUTRIENTE[n])
      .filter(Boolean)
      .join(" + ");
    if (nomeTrat) setTratamento(t => ({ ...t, nome: nomeTrat, produto_id: null }));
  };

  /* ─── upload foto rotulo ─── */
  const uploadFotoRotulo = async (file: File, tipo: "testemunha" | "tratamento", campoId: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${campoId}/rotulo-${tipo}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("campos-teste-fotos").upload(path, file);
    if (error) { toast.error(`Erro ao enviar foto do rótulo: ${error.message}`); return null; }
    return path;
  };

  /* ─── submit novo teste ─── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    setSaving(true);
    try {
      const payload: any = {
        organization_id: current.id,
        user_id: user.id,
        cliente_id: clienteId || null,
        titulo,
        cultura: cultura || null,
        variedade: variedade || null,
        data_plantio: dataPlantio || null,
        area_total_ha: parseFloat(areaTotal.replace(/\./g, "").replace(",", ".")) || 0,
        produtos,
        observacoes: observacoes || null,
        status: "em_andamento" as const,
        tipo_teste: tipoTeste || null,
        estagio_aplicacao: estagioAplicacao || null,
        estagio_detalhe: estagioDetalhe || null,
        nutrientes_substituir: nutrientesSubstituir.length > 0 ? nutrientesSubstituir : null,
        adubos_substituir: Object.keys(adubosSubstituir).length > 0 ? adubosSubstituir : null,
        testemunha: testemunha.nome ? testemunha : null,
        tratamento: tratamento.nome ? tratamento : null,
      };
      if (novaGeo && novoCentro) {
        payload.geometria = novaGeo;
        payload.centro_lat = novoCentro[0];
        payload.centro_lng = novoCentro[1];
      }
      const { data: inserted, error } = await supabase.from("nutrir_campos_teste" as any).insert(payload).select().single();
      if (error) throw error;

      // upload fotos dos rótulos
      const campoId = (inserted as any).id;
      const pathTest = fotoTestemunha ? await uploadFotoRotulo(fotoTestemunha, "testemunha", campoId) : null;
      const pathTrat = fotoTratamento ? await uploadFotoRotulo(fotoTratamento, "tratamento", campoId) : null;
      if (pathTest || pathTrat) {
        await supabase.from("nutrir_campos_teste" as any).update({
          foto_rotulo_testemunha: pathTest,
          foto_rotulo_tratamento: pathTrat,
        }).eq("id", campoId);
      }

      toast.success("Campo de teste criado");
      setOpen(false); reset(); load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  /* ─── submit acompanhamento ─── */
  const submitRelatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user || !selected) return;
    setSaving(true);
    try {
      // upload fotos
      const fotos: { path: string; legenda: string }[] = [];
      for (const f of relFotos) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${selected.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("campos-teste-fotos").upload(path, f);
        if (upErr) throw upErr;
        fotos.push({ path, legenda: f.name });
      }

      const p = (v: string) => v ? parseFloat(v.replace(",", ".")) : null;
      const biometria = (relAlturaPlanta || relStandMLinear || relPeso1000Graos || relComprimentoRaiz || relDiametroCaule || relNumTrifolios)
        ? {
            altura_planta_cm:        p(relAlturaPlanta),
            stand_m_linear:          p(relStandMLinear),
            peso_1000_graos:         p(relPeso1000Graos),
            comprimento_raiz_cm:     p(relComprimentoRaiz),
            diametro_caule_mm:       p(relDiametroCaule),
            num_trifolios:           p(relNumTrifolios),
            num_ramos_produtivos:    p(relNumRamos),
            num_vagens:              p(relNumVagens),
            num_graos_por_vagem:     p(relNumGraosPorVagem),
          }
        : null;

      const { error } = await supabase.from("nutrir_campos_teste_relatorios" as any).insert({
        organization_id: current.id,
        campo_teste_id: selected.id,
        user_id: user.id,
        data: relData,
        estagio: relEstagio || null,
        observacoes: relObs || null,
        ndvi_medio: relNdvi ? parseFloat(relNdvi.replace(",", ".")) : null,
        fotos,
        nova_aplicacao: relNovaAplicacao,
        produto_aplicado: relNovaAplicacao ? (relProdutoAplicado || null) : null,
        dose_aplicada: relNovaAplicacao ? (relDoseAplicada || null) : null,
        biometria,
        diag_ia: diagIA || null,
      });
      if (error) throw error;

      toast.success("Acompanhamento salvo");
      setOpenRel(false);
      setRelEstagio(""); setRelObs(""); setRelNdvi(""); setRelFotos([]);
      setRelNovaAplicacao(false); setRelProdutoAplicado(""); setRelDoseAplicada("");
      setRelAlturaPlanta(""); setRelStandMLinear(""); setRelPeso1000Graos("");
      setDiagIA(""); setFotosDiag([]);
      loadRelatorios(selected.id);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar acompanhamento");
    } finally { setSaving(false); }
  };

  /* ─── diagnóstico IA por foto ─── */
  const rodarDiagnosticoIA = async () => {
    if (fotosDiag.length === 0) return toast.error("Adicione ao menos uma foto para diagnóstico.");
    setDiagLoading(true);
    try {
      const imagens: string[] = [];
      for (const f of fotosDiag) {
        const b64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(",")[1]);
          reader.onerror = rej;
          reader.readAsDataURL(f);
        });
        imagens.push(b64);
      }
      const { data, error } = await supabase.functions.invoke("ia-diagnostico-foliar", {
        body: { imagens, cultura: selected?.cultura ?? "" },
      });
      if (error) throw error;
      setDiagIA(data?.diagnostico ?? "Sem resposta da IA.");
    } catch (err: any) {
      toast.error(err.message ?? "Erro no diagnóstico IA");
    } finally { setDiagLoading(false); }
  };

  /* ─── finalizar com IA ─── */
  const finalizarComIA = async () => {
    if (!selected) return;
    if (!confirm("Gerar relatório final com IA e finalizar este teste?")) return;
    setGenIA(true);
    try {
      const { error } = await supabase.functions.invoke("campo-teste-relatorio", {
        body: { campo_teste_id: selected.id },
      });
      if (error) throw error;
      toast.success("Relatório IA gerado! Gerando PDF…");

      const { data: refreshed } = await supabase
        .from("nutrir_campos_teste" as any).select("*").eq("id", selected.id).single();
      setSelected(refreshed);

      const { data: cli } = await supabase
        .from("nutrir_clientes" as any).select("razao_social, cidade, uf")
        .eq("id", (refreshed as any)?.cliente_id).maybeSingle();
      const { data: rels } = await supabase
        .from("nutrir_campos_teste_relatorios" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { data: ndvi } = await supabase
        .from("nutrir_campos_teste_ndvi" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });

      const { gerarCampoTestePDF, baixarBlob } = await import("@/lib/nutrir/campo-teste-pdf");
      const blob = await gerarCampoTestePDF({
        campo: refreshed,
        cliente: cli as any,
        relatorios: (rels as any[]) ?? [],
        ndvi_serie: (ndvi as any[]) ?? [],
      });
      baixarBlob(blob, `campo-teste-${((refreshed as any)?.titulo ?? "relatorio").replace(/\s+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF baixado!");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar relatório");
    } finally { setGenIA(false); }
  };

  const baixarRelatorioPDF = async () => {
    if (!selected) return;
    try {
      toast.info("Gerando PDF…");
      const { data: cli } = await supabase
        .from("nutrir_clientes" as any).select("razao_social, cidade, uf")
        .eq("id", (selected as any)?.cliente_id).maybeSingle();
      const { data: rels } = await supabase
        .from("nutrir_campos_teste_relatorios" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { data: ndvi } = await supabase
        .from("nutrir_campos_teste_ndvi" as any).select("*")
        .eq("campo_teste_id", selected.id).order("data", { ascending: true });
      const { gerarCampoTestePDF, baixarBlob } = await import("@/lib/nutrir/campo-teste-pdf");
      const blob = await gerarCampoTestePDF({
        campo: selected,
        cliente: cli as any,
        relatorios: (rels as any[]) ?? [],
        ndvi_serie: (ndvi as any[]) ?? [],
      });
      baixarBlob(blob, `campo-teste-${((selected as any)?.titulo ?? "relatorio").replace(/\s+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF baixado!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar PDF");
    }
  };

  const removerTeste = async (id: string) => {
    if (!confirm("Excluir este campo de teste?")) return;
    const { error } = await supabase.from("nutrir_campos_teste" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const verFoto = async (path: string) => {
    const { data } = await supabase.storage.from("campos-teste-fotos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const total = items.length;
  const ativos = useMemo(() => items.filter((i) => i.status === "em_andamento").length, [items]);

  const precisaDetalheEstagio = estagioAplicacao === "Vegetativo" || estagioAplicacao === "Reprodutivo";

  /* ════════════════════════════════════════════════════════ */
  return (
    <>
      <PageHeader
        title="Campos de Teste"
        description="Acompanhe testes em campo com fotos e relatório final por IA"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-1" /> Novo teste
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Novo campo de teste</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">

                {/* 1. Título */}
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Teste foliar — Soja Fazenda Boa Vista" required />
                </div>

                {/* 2. Cliente + Cultura */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cultura</Label>
                    <Input value={cultura} onChange={(e) => setCultura(e.target.value)} placeholder="Soja, Milho…" />
                  </div>
                </div>

                {/* 3. Variedade + Data plantio */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Variedade / Material</Label>
                    <Input value={variedade} onChange={(e) => setVariedade(e.target.value)} placeholder="Ex.: TMG 7062 IPRO" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de plantio</Label>
                    <Input type="date" value={dataPlantio} onChange={(e) => setDataPlantio(e.target.value)} />
                  </div>
                </div>

                {/* 4. Área total */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Área total de teste</Label>
                    <div className="relative">
                      <Input
                        inputMode="decimal"
                        className="pr-10"
                        value={areaTotal}
                        onChange={(e) => setAreaTotal(e.target.value.replace(/[^\d,.]/g, ""))}
                        onBlur={(e) => { if (e.target.value) setAreaTotal(formatArea(e.target.value)); }}
                        placeholder="0,000"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">ha</span>
                    </div>
                  </div>
                </div>

                {/* 5. Tipo de teste */}
                <div className="space-y-1.5">
                  <Label>Tipo de teste</Label>
                  <Select value={tipoTeste} onValueChange={setTipoTeste}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_TESTE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* 5a. Complexação: nutrientes + adubos */}
                {tipoTeste === "Complexação" && (
                  <div className="border rounded-lg p-3 space-y-3 bg-amber-50/50">
                    <div className="text-sm font-semibold text-amber-900">
                      Complexação — Selecione os nutrientes a substituir
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {NUTRIENTES.map((n) => (
                        <label key={n} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={nutrientesSubstituir.includes(n)}
                            onCheckedChange={() => toggleNutriente(n)}
                          />
                          <span className="text-sm font-medium">{n}</span>
                        </label>
                      ))}
                    </div>

                    {nutrientesSubstituir.length > 0 && (
                      <div className="space-y-3">
                        {/* N, P, K — seleção de adubo convencional */}
                        {(["N", "P", "K"] as const).filter(n => nutrientesSubstituir.includes(n)).map((n) => (
                          <div key={n} className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-xs text-muted-foreground">Adubo convencional ({n})</Label>
                            <Select value={adubosSubstituir[n] ?? ""} onValueChange={(v) => onAduboChange(n, v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {ADUBOS_POR_NUTRIENTE[n].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}

                        {/* N+P+K juntos → Adubo Formulado? */}
                        {(["N","P","K"] as const).every(n => nutrientesSubstituir.includes(n)) && (
                          <div className="rounded-md border bg-white p-3 space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                              <input type="checkbox" checked={adubosNPKFormulado}
                                onChange={(e) => { setAdubosNPKFormulado(e.target.checked); setAdubosNPKGrade(""); }}
                                className="rounded" />
                              Usar adubo formulado (ex.: 20-05-20)?
                            </label>
                            {adubosNPKFormulado && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Gradação N-P-K (formato ##-##-##)</Label>
                                <Input
                                  value={adubosNPKGrade}
                                  onChange={(e) => {
                                    // Auto-format ##-##-##
                                    let v = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                                    if (v.length > 4) v = v.slice(0,2) + "-" + v.slice(2,4) + "-" + v.slice(4);
                                    else if (v.length > 2) v = v.slice(0,2) + "-" + v.slice(2);
                                    setAdubosNPKGrade(v);
                                  }}
                                  placeholder="04-14-08"
                                  className="font-mono w-32"
                                  maxLength={8}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Boro — kg/ha */}
                        {nutrientesSubstituir.includes("Boro") && (
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <Label className="text-xs text-muted-foreground">Boro — dose</Label>
                            <div className="relative">
                              <Input
                                inputMode="decimal"
                                value={boroKgHa}
                                onChange={(e) => setBoroKgHa(e.target.value.replace(/[^\d,.]/g, ""))}
                                placeholder="0,500"
                                className="pr-16 h-8 text-xs"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kg/ha</span>
                            </div>
                          </div>
                        )}

                        {/* Micronutrientes — gr/ha por elemento */}
                        {nutrientesSubstituir.includes("Micronutrientes") && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Micronutrientes (gr/ha)</Label>
                            {["Zinco (Zn)", "Manganês (Mn)", "Cobre (Cu)", "Molibdênio (Mo)", "Cobalto (Co)"].map((m) => (
                              <div key={m} className="grid grid-cols-2 gap-2 items-center">
                                <span className="text-xs">{m}</span>
                                <div className="relative">
                                  <Input
                                    inputMode="decimal"
                                    value={microGrHa[m] ?? ""}
                                    onChange={(e) => setMicroGrHa(prev => ({ ...prev, [m]: e.target.value.replace(/[^\d,.]/g, "") }))}
                                    placeholder="0"
                                    className="pr-14 h-8 text-xs"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">gr/ha</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Preview auto-fill */}
                        <div className="rounded-md border bg-white p-2 text-xs space-y-1">
                          <div><span className="text-muted-foreground">Testemunha (auto):</span> <strong>{testemunha.nome || "—"}</strong></div>
                          <div><span className="text-muted-foreground">Tratamento Nutrir (auto):</span> <strong className="text-primary">{tratamento.nome || "—"}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Estágio de aplicação */}
                {/* 6. Estágio de aplicação */}
                <div className="space-y-1.5">
                  <Label>Estágio de aplicação</Label>
                  <Select value={estagioAplicacao} onValueChange={(v) => { setEstagioAplicacao(v); setEstagioDetalhe(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ESTAGIOS_APLICACAO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {precisaDetalheEstagio && (
                    <Input value={estagioDetalhe} onChange={(e) => setEstagioDetalhe(e.target.value)} placeholder="Ex.: V4, R1, R3…" className="mt-1" />
                  )}
                </div>

                {/* 7. Mapa GPS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Mapa do talhão (GPS)</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowMapaNovo(!showMapaNovo)}>
                      <MapIcon className="h-3.5 w-3.5 mr-1" /> {showMapaNovo ? "Ocultar mapa" : "Abrir mapa"}
                    </Button>
                  </div>
                  {showMapaNovo && (
                    <div className="rounded-md overflow-hidden border h-64">
                      <MapaTalhao geometria={novaGeo} centro={novoCentro}
                        onSave={(geo, centro) => { setNovaGeo(geo); setNovoCentro(centro); toast.success("Área marcada"); }} />
                    </div>
                  )}
                  {novaGeo && <p className="text-xs text-emerald-600 flex items-center gap-1"><Leaf className="h-3 w-3" /> Área desenhada</p>}
                </div>

                {/* 8. Observações */}
                <div className="space-y-1.5">
                  <Label>Detalhamento do teste</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Descreva o protocolo, aplicações previstas…" />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
                  <Button type="submit" disabled={saving} className="bg-gradient-primary">
                    {saving ? "Salvando…" : "Criar teste"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total de testes</div>
            <div className="text-2xl font-bold">{total}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Em andamento</div>
            <div className="text-2xl font-bold text-primary">{ativos}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {items.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Nenhum campo de teste cadastrado.</p>}
          {items.map((item) => {
            const cli = clientes.find((c) => c.id === item.cliente_id);
            return (
              <Card key={item.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selected?.id === item.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => { setSelected(item); loadRelatorios(item.id); loadNdvi(item.id); }}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm leading-tight">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cli?.razao_social ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[item.status] ?? "outline"}>{item.status?.replace("_", " ")}</Badge>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                        onClick={(e) => { e.stopPropagation(); removerTeste(item.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {item.cultura && <span>🌱 {item.cultura}</span>}
                    {item.area_total_ha > 0 && <span><Scale className="inline h-3 w-3" /> {Number(item.area_total_ha).toLocaleString("pt-BR")} ha</span>}
                    {item.tipo_teste && <span><FlaskConical className="inline h-3 w-3" /> {item.tipo_teste}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selected && (
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="acompanhamento">
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b flex-wrap gap-2">
                  <span className="font-semibold text-sm">{selected.titulo}</span>
                  <TabsList>
                    <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
                    <TabsTrigger value="mapa"><MapIcon className="h-3.5 w-3.5 mr-1" />Mapa / NDVI</TabsTrigger>
                    <TabsTrigger value="relatorio"><FileText className="h-3.5 w-3.5 mr-1" />Relatório</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    {selected.status === "em_andamento" && (
                      <Button size="sm" onClick={finalizarComIA} disabled={genIA} className="bg-gradient-primary text-xs">
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> {genIA ? "Gerando…" : "Finalizar com IA"}
                      </Button>
                    )}
                    {selected.status === "finalizado" && (
                      <Button size="sm" variant="outline" onClick={baixarRelatorioPDF} className="text-xs">
                        <FileText className="h-3.5 w-3.5 mr-1" /> Baixar PDF
                      </Button>
                    )}
                  </div>
                </div>

                <TabsContent value="acompanhamento" className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{relatorios.length} acompanhamento(s)</span>
                    {selected.status === "em_andamento" && (
                      <Dialog open={openRel} onOpenChange={setOpenRel}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Novo acompanhamento</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader><DialogTitle>Novo acompanhamento</DialogTitle></DialogHeader>
                          <form onSubmit={submitRelatorio} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label>Data</Label>
                                <Input type="date" value={relData} onChange={(e) => setRelData(e.target.value)} required />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Estágio fenológico</Label>
                                <Input value={relEstagio} onChange={(e) => setRelEstagio(e.target.value)} placeholder="V4, R1…" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label>NDVI médio</Label>
                              <Input inputMode="decimal" value={relNdvi} onChange={(e) => setRelNdvi(e.target.value)} placeholder="0,00 – 1,00" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox id="nova-ap" checked={relNovaAplicacao} onCheckedChange={(v) => setRelNovaAplicacao(!!v)} />
                              <label htmlFor="nova-ap" className="text-sm">Nova aplicação?</label>
                            </div>
                            {relNovaAplicacao && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Produto aplicado</Label>
                                  <Input value={relProdutoAplicado} onChange={(e) => setRelProdutoAplicado(e.target.value)} placeholder="Nome do produto" />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Dose / ha</Label>
                                  <Input value={relDoseAplicada} onChange={(e) => setRelDoseAplicada(e.target.value)} placeholder="Ex.: 200 mL/ha" />
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biometria</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { l: "Altura da planta (cm)", s: relAlturaPlanta, fn: setRelAlturaPlanta },
                                  { l: "Stand (plantas/m)", s: relStandMLinear, fn: setRelStandMLinear },
                                  { l: "Peso 1000 grãos (g)", s: relPeso1000Graos, fn: setRelPeso1000Graos },
                                  { l: "Comprimento raiz (cm)", s: relComprimentoRaiz, fn: setRelComprimentoRaiz },
                                  { l: "Diâm. caule (mm)", s: relDiametroCaule, fn: setRelDiametroCaule },
                                  { l: "Nº trifólios", s: relNumTrifolios, fn: setRelNumTrifolios },
                                  { l: "Nº ramos produtivos", s: relNumRamos, fn: setRelNumRamos },
                                  { l: "Nº vagens", s: relNumVagens, fn: setRelNumVagens },
                                  { l: "Grãos/vagem", s: relNumGraosPorVagem, fn: setRelNumGraosPorVagem },
                                ].map(({ l, s, fn }) => (
                                  <div key={l} className="space-y-1">
                                    <Label className="text-[11px]">{l}</Label>
                                    <Input inputMode="decimal" value={s} onChange={(e) => fn(e.target.value)} placeholder="—" className="h-8 text-xs" />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox id="def" checked={relTemDeficiencia} onCheckedChange={(v) => setRelTemDeficiencia(!!v)} />
                              <label htmlFor="def" className="text-sm">Possui deficiência ou ponto de atenção?</label>
                            </div>
                            {relTemDeficiencia && (
                              <div className="space-y-2">
                                <Label className="text-xs">Fotos para diagnóstico IA</Label>
                                <div className="flex flex-wrap gap-2">
                                  {fotosDiag.map((f, i) => (
                                    <div key={i} className="relative">
                                      <img src={URL.createObjectURL(f)} className="w-16 h-16 object-cover rounded border" />
                                      <button type="button" onClick={() => setFotosDiag(prev => prev.filter((_, k) => k !== i))}
                                        className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
                                    </div>
                                  ))}
                                  <label className="w-16 h-16 rounded border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted">
                                    <Camera className="h-5 w-5 text-muted-foreground" />
                                    <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => setFotosDiag(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                                  </label>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={rodarDiagnosticoIA} disabled={diagLoading}>
                                  <Sparkles className="h-3.5 w-3.5 mr-1" /> {diagLoading ? "Analisando…" : "Diagnosticar com IA"}
                                </Button>
                                {diagIA && <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs"><ReactMarkdown>{diagIA}</ReactMarkdown></div>}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label>Descrição / observações</Label>
                              <Textarea value={relObs} onChange={(e) => setRelObs(e.target.value)} rows={2} placeholder="O que foi feito, observado…" />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Fotos</Label>
                              <div className="flex flex-wrap gap-2">
                                {relFotos.map((f, i) => (
                                  <div key={i} className="relative">
                                    <img src={URL.createObjectURL(f)} className="w-16 h-16 object-cover rounded border" />
                                    <button type="button" onClick={() => setRelFotos(prev => prev.filter((_, k) => k !== i))}
                                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">✕</button>
                                  </div>
                                ))}
                                <label className="w-16 h-16 rounded border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted">
                                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                                  <input type="file" accept="image/*" className="hidden" multiple onChange={(e) => setRelFotos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
                                </label>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar acompanhamento"}</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  {relatorios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum acompanhamento registrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {relatorios.map((r) => (
                        <div key={r.id} className="rounded-lg border p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{r.data}</span>
                            {r.estagio && <Badge variant="outline">{r.estagio}</Badge>}
                          </div>
                          {r.ndvi_medio != null && <div className="text-xs text-muted-foreground">NDVI: <strong>{r.ndvi_medio}</strong></div>}
                          {r.nova_aplicacao && <div className="text-xs">💊 {r.produto_aplicado} — {r.dose_aplicada}</div>}
                          {r.observacoes && <p className="text-xs text-muted-foreground">{r.observacoes}</p>}
                          {r.diag_ia && <div className="rounded bg-emerald-50 border border-emerald-100 p-2 text-xs mt-1"><ReactMarkdown>{r.diag_ia}</ReactMarkdown></div>}
                          {Array.isArray(r.fotos) && r.fotos.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-1">
                              {r.fotos.map((f: any) => (
                                <button key={f.path} type="button" onClick={() => verFoto(f.path)} className="text-xs text-primary underline flex items-center gap-1">
                                  <Camera className="h-3 w-3" /> {f.legenda}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="mapa" className="p-4 space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => gerarNdvi("latest")} disabled={ndviLoading}>
                      <Satellite className="h-3.5 w-3.5 mr-1" /> {ndviLoading ? "Buscando…" : "Atualizar NDVI"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => gerarNdvi("history")} disabled={ndviLoading}>Histórico NDVI</Button>
                  </div>
                  <div className="rounded-md overflow-hidden border h-72">
                    <MapaTalhao geometria={selected?.geometria}
                      centro={selected?.centro_lat ? [selected.centro_lat, selected.centro_lng] : null}
                      onSave={salvarGeometria} />
                  </div>
                  {ndviSerie.length > 0 && (
                    <div className="rounded-md border p-3">
                      <div className="text-xs font-semibold mb-2">Histórico NDVI</div>
                      <div className="space-y-1">
                        {ndviSerie.map((n) => (
                          <div key={n.id} className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground w-24">{n.data}</span>
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, (n.ndvi_medio ?? 0) * 100))}%` }} />
                            </div>
                            <span className="font-mono w-12 text-right">{(n.ndvi_medio ?? 0).toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="relatorio" className="p-4 space-y-3">
                  {selected?.relatorio_ia ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold flex items-center gap-1"><Sparkles className="h-4 w-4 text-primary" /> Relatório Final IA</span>
                        <Button size="sm" variant="outline" onClick={baixarRelatorioPDF}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> Baixar PDF
                        </Button>
                      </div>
                      <div className="rounded-md bg-muted/40 border p-4 text-sm prose prose-sm max-w-none">
                        <ReactMarkdown>{selected.relatorio_ia}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Relatório ainda não gerado.<br />Clique em <strong>"Finalizar com IA"</strong> para gerar.</p>
                      {selected.status === "em_andamento" && (
                        <Button size="sm" onClick={finalizarComIA} disabled={genIA} className="bg-gradient-primary">
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> {genIA ? "Gerando…" : "Finalizar com IA"}
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
