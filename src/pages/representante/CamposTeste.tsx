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
                <div className="space-y-1.5">
                  <Label>Estágio de aplicação</Label>
                  <Select value={estagioAplicacao} onValueChange={(v) => { setEstagioAplicacao(v); setEstagioDetalhe(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ESTAGIOS_APLICACAO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {precisaDetalheEstagio && (
                    <Input
                      className="mt-1.5"
                      value={estagioDetalhe}
                      onChange={(e) => setEstagioDetalhe(e.target.value)}
                      placeholder={estagioAplicacao === "Vegetativo" ? "Ex.: V4, V6…" : "Ex.: R1, R3, R5…"}
                    />
                  )}
                </div>

                {/* 7. Lado a lado: Testemunha vs Tratamento */}
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    Testemunha × Tratamento (lado a lado)
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Testemunha */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Testemunha</div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={testemunha.produto_id ?? (testemunha.nome ? "__outro__" : "")}
                          onValueChange={(v) => {
                            if (v === "__outro__") setTestemunha((t) => ({ ...t, produto_id: null, nome: "" }));
                            else {
                              const p = produtosDB.find((x) => x.id === v);
                              setTestemunha((t) => ({ ...t, produto_id: v, nome: p?.nome ?? "" }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent className="max-h-52">
                            {produtosDB.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                            <SelectItem value="__outro__">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        {testemunha.produto_id === null && (
                          <Input className="h-8 text-xs" placeholder="Nome do produto" value={testemunha.nome}
                            onChange={(e) => setTestemunha((t) => ({ ...t, nome: e.target.value }))} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dose/ha</Label>
                        <Input className="h-8 text-xs" value={testemunha.dose} placeholder="L/ha ou kg/ha"
                          onChange={(e) => setTestemunha((t) => ({ ...t, dose: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Garantias</Label>
                        <Input className="h-8 text-xs" value={testemunha.garantias} placeholder="Ex.: 5% N, 3% Zn"
                          onChange={(e) => setTestemunha((t) => ({ ...t, garantias: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><Camera className="h-3 w-3" /> Foto do rótulo</Label>
                        <Input type="file" accept="image/*" capture="environment" className="h-8 text-xs"
                          onChange={(e) => setFotoTestemunha(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>

                    {/* Tratamento */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-primary uppercase tracking-wider">Tratamento</div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={tratamento.produto_id ?? (tratamento.nome ? "__outro__" : "")}
                          onValueChange={(v) => {
                            if (v === "__outro__") setTratamento((t) => ({ ...t, produto_id: null, nome: "" }));
                            else {
                              const p = produtosDB.find((x) => x.id === v);
                              setTratamento((t) => ({ ...t, produto_id: v, nome: p?.nome ?? "" }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent className="max-h-52">
                            {produtosDB.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                            <SelectItem value="__outro__">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        {tratamento.produto_id === null && (
                          <Input className="h-8 text-xs" placeholder="Nome do produto" value={tratamento.nome}
                            onChange={(e) => setTratamento((t) => ({ ...t, nome: e.target.value }))} />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dose/ha</Label>
                        <Input className="h-8 text-xs" value={tratamento.dose} placeholder="L/ha ou kg/ha"
                          onChange={(e) => setTratamento((t) => ({ ...t, dose: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Garantias</Label>
                        <Input className="h-8 text-xs" value={tratamento.garantias} placeholder="Ex.: 5% N, 3% Zn"
                          onChange={(e) => setTratamento((t) => ({ ...t, garantias: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><Camera className="h-3 w-3" /> Foto do rótulo</Label>
                        <Input type="file" accept="image/*" capture="environment" className="h-8 text-xs"
                          onChange={(e) => setFotoTratamento(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8. Produtos adicionais */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Produtos adicionais</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addProduto}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {produtos.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={p.produto_id ?? (p.nome ? "__outro__" : "")}
                          onValueChange={(v) => {
                            if (v === "__outro__") updProduto(i, { produto_id: null, nome: "" });
                            else {
                              const prod = produtosDB.find((x) => x.id === v);
                              updProduto(i, { produto_id: v, nome: prod?.nome ?? "" });
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent className="max-h-64">
                            {produtosDB.map((pp) => <SelectItem key={pp.id} value={pp.id}>{pp.nome}</SelectItem>)}
                            <SelectItem value="__outro__">Outro (digitar)</SelectItem>
                          </SelectContent>
                        </Select>
                        {p.produto_id === null && (
                          <Input className="mt-1" placeholder="Nome do produto" value={p.nome}
                            onChange={(e) => updProduto(i, { nome: e.target.value })} />
                        )}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Área</Label>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="pr-8"
                            value={p.area_ha ? String(p.area_ha) : ""}
                            onChange={(e) => updProduto(i, { area_ha: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">ha</span>
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Dose/ha</Label>
                        <Input value={p.dose} onChange={(e) => updProduto(i, { dose: e.target.value })} placeholder="L/ha" />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Estágio</Label>
                        <Input value={p.estagio} onChange={(e) => updProduto(i, { estagio: e.target.value })} placeholder="V4, R1…" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {produtos.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => rmProduto(i)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="col-span-12 space-y-1">
                        <Label className="text-xs">Observação</Label>
                        <Input value={p.observacao} onChange={(e) => updProduto(i, { observacao: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 9. Observações gerais */}
                <div className="space-y-1.5">
                  <Label>Observações gerais</Label>
                  <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>

                {/* 10. Mapa */}
                <div className="space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Área no mapa</Label>
                      <div className="text-xs text-muted-foreground">
                        {novaGeo ? "Talhão definido ✔" : "Opcional — desenhe a área do teste"}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowMapaNovo((v) => !v)}>
                      <MapIcon className="h-4 w-4 mr-1" /> {showMapaNovo ? "Ocultar" : "Selecionar área"}
                    </Button>
                  </div>
                  {showMapaNovo && (
                    <MapaTalhao
                      geometria={novaGeo}
                      centro={novoCentro}
                      onSave={(geo, centro) => {
                        setNovaGeo(geo); setNovoCentro(centro);
                        toast.success("Área definida — será salva ao criar o teste");
                      }}
                      height={300}
                    />
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={saving} className="bg-gradient-primary">
                    {saving ? "Salvando…" : "Criar teste"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ─── conteúdo principal ─── */}
      <div className="p-6 space-y-4">

        {/* cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total de testes</div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Em andamento</div><div className="text-2xl font-bold">{ativos}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Finalizados</div><div className="text-2xl font-bold">{total - ativos}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* lista de testes */}
          <Card className="lg:col-span-1">
            <CardContent className="p-0 divide-y max-h-[70vh] overflow-y-auto">
              {items.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">Nenhum teste cadastrado.</div>
              )}
              {items.map((i) => (
                <button
                  key={i.id}
                  onClick={() => { setSelected(i); loadRelatorios(i.id); loadNdvi(i.id); }}
                  className={`w-full text-left p-3 hover:bg-muted/40 transition ${selected?.id === i.id ? "bg-muted/60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{i.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {i.tipo_teste && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded mr-1">{i.tipo_teste}</span>}
                        {i.cultura ?? "—"} · {Number(i.area_total_ha).toLocaleString("pt-BR")} ha
                      </div>
                    </div>
                    <Badge variant={STATUS_COLORS[i.status]} className="text-[10px] shrink-0">
                      {i.status.replace("_", " ")}
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* detalhe do teste */}
          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              {!selected ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FlaskConical className="h-10 w-10 mb-3 opacity-40" />
                  <div className="text-sm">Selecione um teste à esquerda</div>
                </div>
              ) : (
                <>
                  {/* cabeçalho do teste */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-lg leading-tight">{selected.titulo}</h3>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                        {selected.tipo_teste && <span className="font-medium text-foreground">{selected.tipo_teste}</span>}
                        {selected.cultura && <span>{selected.cultura}</span>}
                        <span>{Number(selected.area_total_ha).toLocaleString("pt-BR")} ha</span>
                        {selected.estagio_aplicacao && (
                          <span>{selected.estagio_aplicacao}{selected.estagio_detalhe ? ` ${selected.estagio_detalhe}` : ""}</span>
                        )}
                        {selected.data_plantio && <span>plantio {selected.data_plantio}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {selected.status === "em_andamento" && (
                        <Button size="sm" onClick={finalizarComIA} disabled={genIA} className="bg-gradient-primary">
                          <Sparkles className="h-4 w-4 mr-1" /> {genIA ? "Gerando…" : "Finalizar com IA"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removerTeste(selected.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue="acomp">
                    <TabsList className="flex-wrap h-auto">
                      <TabsTrigger value="acomp">Acompanhamentos ({relatorios.length})</TabsTrigger>
                      <TabsTrigger value="ladoalado"><Scale className="h-3.5 w-3.5 mr-1" />T×T</TabsTrigger>
                      <TabsTrigger value="mapa"><MapIcon className="h-3.5 w-3.5 mr-1" />Mapa/NDVI</TabsTrigger>
                      <TabsTrigger value="produtos">Produtos</TabsTrigger>
                      <TabsTrigger value="relatorio">Relatório IA</TabsTrigger>
                    </TabsList>

                    {/* aba: acompanhamentos */}
                    <TabsContent value="acomp" className="space-y-3 mt-3">
                      <Dialog open={openRel} onOpenChange={setOpenRel}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-1" /> Novo acompanhamento
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader><DialogTitle>Acompanhamento de campo</DialogTitle></DialogHeader>
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

                            {/* nova aplicação */}
                            <div className="border rounded-lg p-3 space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={relNovaAplicacao}
                                  onCheckedChange={(c) => setRelNovaAplicacao(!!c)}
                                />
                                <span className="text-sm font-medium">Nova aplicação neste acompanhamento?</span>
                              </label>
                              {relNovaAplicacao && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Produto aplicado</Label>
                                    <Input className="h-8 text-xs" value={relProdutoAplicado}
                                      onChange={(e) => setRelProdutoAplicado(e.target.value)}
                                      placeholder="Nome do produto" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Dose/ha</Label>
                                    <Input className="h-8 text-xs" value={relDoseAplicada}
                                      onChange={(e) => setRelDoseAplicada(e.target.value)}
                                      placeholder="L/ha ou kg/ha" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* biometria */}
                            <div className="border rounded-lg p-3 space-y-3">
                              <div className="text-sm font-semibold flex items-center gap-2">
                                <Leaf className="h-4 w-4 text-muted-foreground" /> Biometria (opcional)
                              </div>
                              {/* Linha 1: altura, stand, peso 1000 */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Altura planta</Label>
                                  <div className="relative">
                                    <Input className="h-8 text-xs pr-7" inputMode="decimal" value={relAlturaPlanta}
                                      onChange={(e) => setRelAlturaPlanta(e.target.value)} placeholder="0" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">cm</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Stand/m linear</Label>
                                  <Input className="h-8 text-xs" inputMode="decimal" value={relStandMLinear}
                                    onChange={(e) => setRelStandMLinear(e.target.value)} placeholder="plantas/m" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Peso 1000 grãos</Label>
                                  <div className="relative">
                                    <Input className="h-8 text-xs pr-5" inputMode="decimal" value={relPeso1000Graos}
                                      onChange={(e) => setRelPeso1000Graos(e.target.value)} placeholder="0" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">g</span>
                                  </div>
                                </div>
                              </div>
                              {/* Linha 2: comp. raiz, diâm. caule, nº trifólios */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Comp. raiz</Label>
                                  <div className="relative">
                                    <Input className="h-8 text-xs pr-7" inputMode="decimal" value={relComprimentoRaiz}
                                      onChange={(e) => setRelComprimentoRaiz(e.target.value)} placeholder="0" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">cm</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Diâm. caule</Label>
                                  <div className="relative">
                                    <Input className="h-8 text-xs pr-7" inputMode="decimal" value={relDiametroCaule}
                                      onChange={(e) => setRelDiametroCaule(e.target.value)} placeholder="0" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Nº trifólios</Label>
                                  <Input className="h-8 text-xs" inputMode="numeric" value={relNumTrifolios}
                                    onChange={(e) => setRelNumTrifolios(e.target.value)} placeholder="0" />
                                </div>
                              </div>
                              {/* Linha 3: ramos, vagens, grãos/vagem */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Ramos produtivos</Label>
                                  <Input className="h-8 text-xs" inputMode="numeric" value={relNumRamos}
                                    onChange={(e) => setRelNumRamos(e.target.value)} placeholder="0" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Nº vagens</Label>
                                  <Input className="h-8 text-xs" inputMode="numeric" value={relNumVagens}
                                    onChange={(e) => setRelNumVagens(e.target.value)} placeholder="0" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Grãos/vagem</Label>
                                  <Input className="h-8 text-xs" inputMode="decimal" value={relNumGraosPorVagem}
                                    onChange={(e) => setRelNumGraosPorVagem(e.target.value)} placeholder="0" />
                                </div>
                              </div>
                              {/* Fotos de biometria */}
                              <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-1"><Camera className="h-3 w-3" /> Fotos de biometria</Label>
                                <Input type="file" multiple accept="image/*" capture="environment" className="h-8 text-xs"
                                  onChange={(e) => setRelBiometriaFotos(Array.from(e.target.files ?? []))} />
                                {relBiometriaFotos.length > 0 && (
                                  <div className="text-xs text-muted-foreground">{relBiometriaFotos.length} foto(s)</div>
                                )}
                              </div>
                            </div>

                            {/* Deficiência / ponto de atenção */}
                            <div className="border rounded-lg p-3 space-y-2 bg-orange-50/40">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={relTemDeficiencia}
                                  onCheckedChange={(c) => setRelTemDeficiencia(!!c)}
                                />
                                <span className="text-sm font-medium text-orange-800">
                                  Possui deficiência / ponto de atenção visual?
                                </span>
                              </label>
                              {relTemDeficiencia && (
                                <div className="text-xs text-muted-foreground bg-white border rounded p-2">
                                  Adicione fotos abaixo e use o <strong>Diagnóstico IA</strong> para identificar a deficiência automaticamente.
                                </div>
                              )}
                            </div>

                            {/* NDVI */}
                            <div className="space-y-1.5">
                              <Label>NDVI médio (opcional)</Label>
                              <Input inputMode="decimal" value={relNdvi}
                                onChange={(e) => setRelNdvi(e.target.value)} placeholder="0.78" />
                            </div>

                            {/* observações */}
                            <div className="space-y-1.5">
                              <Label>Observações</Label>
                              <Textarea rows={3} value={relObs} onChange={(e) => setRelObs(e.target.value)} />
                            </div>

                            {/* fotos campo */}
                            <div className="space-y-1.5">
                              <Label className="flex items-center gap-1.5">
                                <Camera className="h-4 w-4" /> Fotos de campo
                              </Label>
                              <Input type="file" multiple accept="image/*" capture="environment"
                                onChange={(e) => setRelFotos(Array.from(e.target.files ?? []))} />
                              {relFotos.length > 0 && (
                                <div className="text-xs text-muted-foreground">{relFotos.length} foto(s) selecionada(s)</div>
                              )}
                            </div>

                            {/* diagnóstico IA */}
                            <div className="border rounded-lg p-3 space-y-2 bg-purple-50/40">
                              <div className="text-sm font-semibold flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500" /> Diagnóstico IA — Deficiências foliares
                              </div>
                              <Input type="file" multiple accept="image/*" capture="environment"
                                onChange={(e) => setFotosDiag(Array.from(e.target.files ?? []))}
                                className="text-xs" />
                              <Button type="button" size="sm" variant="outline"
                                disabled={diagLoading || fotosDiag.length === 0}
                                onClick={rodarDiagnosticoIA}
                                className="w-full">
                                {diagLoading ? "Analisando…" : "Diagnosticar com IA"}
                              </Button>
                              {diagIA && (
                                <div className="text-xs bg-white border rounded p-2 prose prose-xs max-w-none">
                                  <ReactMarkdown>{diagIA}</ReactMarkdown>
                                </div>
                              )}
                            </div>

                            <DialogFooter>
                              <Button type="submit" disabled={saving} className="bg-gradient-primary">
                                {saving ? "Salvando…" : "Salvar acompanhamento"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {relatorios.length === 0 && (
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          Nenhum acompanhamento registrado ainda.
                        </div>
                      )}

                      {relatorios.map((r) => (
                        <div key={r.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                              {r.data}
                              {r.estagio && <span className="text-xs text-muted-foreground ml-2">· {r.estagio}</span>}
                              {r.nova_aplicacao && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  <ChevronRight className="h-2.5 w-2.5 mr-0.5" />Aplicação
                                </Badge>
                              )}
                            </div>
                            {r.ndvi_medio != null && (
                              <Badge variant="outline">NDVI {Number(r.ndvi_medio).toFixed(2)}</Badge>
                            )}
                          </div>

                          {r.nova_aplicacao && r.produto_aplicado && (
                            <div className="text-xs bg-amber-50 border border-amber-100 rounded px-2 py-1">
                              Aplicado: <strong>{r.produto_aplicado}</strong>
                              {r.dose_aplicada && ` — ${r.dose_aplicada}`}
                            </div>
                          )}

                          {r.biometria && (
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {r.biometria.altura_planta_cm != null && (
                                <span>↕ Altura: {r.biometria.altura_planta_cm} cm</span>
                              )}
                              {r.biometria.stand_m_linear != null && (
                                <span>Stand: {r.biometria.stand_m_linear}/m</span>
                              )}
                              {r.biometria.peso_1000_graos != null && (
                                <span>PMG: {r.biometria.peso_1000_graos} g</span>
                              )}
                              {r.biometria.comprimento_raiz_cm != null && (
                                <span>Raiz: {r.biometria.comprimento_raiz_cm} cm</span>
                              )}
                              {r.biometria.diametro_caule_mm != null && (
                                <span>Caule: {r.biometria.diametro_caule_mm} mm</span>
                              )}
                              {r.biometria.num_trifolios != null && (
                                <span>Trifólios: {r.biometria.num_trifolios}</span>
                              )}
                              {r.biometria.num_ramos_produtivos != null && (
                                <span>Ramos: {r.biometria.num_ramos_produtivos}</span>
                              )}
                              {r.biometria.num_vagens != null && (
                                <span>Vagens: {r.biometria.num_vagens}</span>
                              )}
                              {r.biometria.num_graos_por_vagem != null && (
                                <span>Grãos/vag: {r.biometria.num_graos_por_vagem}</span>
                              )}
                            </div>
                          )}

                          {r.observacoes && (
                            <div className="text-sm text-muted-foreground">{r.observacoes}</div>
                          )}

                          {r.diag_ia && (
                            <div className="text-xs bg-purple-50 border border-purple-100 rounded px-2 py-1.5 prose prose-xs max-w-none">
                              <div className="font-semibold text-purple-700 mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Diagnóstico IA
                              </div>
                              <ReactMarkdown>{r.diag_ia}</ReactMarkdown>
                            </div>
                          )}

                          {Array.isArray(r.fotos) && r.fotos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {r.fotos.map((f: any, i: number) => (
                                <button key={i} onClick={() => verFoto(f.path)}
                                  className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/70">
                                  <ImagePlus className="h-3 w-3" /> Foto {i + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </TabsContent>

                    {/* aba: lado a lado */}
                    <TabsContent value="ladoalado" className="mt-3">
                      {(selected.testemunha || selected.tratamento) ? (
                        <div className="grid grid-cols-2 gap-4">
                          {/* testemunha */}
                          <div className="border rounded-lg p-3 space-y-2">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Testemunha</div>
                            {selected.testemunha?.nome && <div className="text-sm font-medium">{selected.testemunha.nome}</div>}
                            {selected.testemunha?.dose && <div className="text-xs text-muted-foreground">Dose: {selected.testemunha.dose}</div>}
                            {selected.testemunha?.garantias && <div className="text-xs text-muted-foreground">Garantias: {selected.testemunha.garantias}</div>}
                            {selected.foto_rotulo_testemunha && (
                              <button onClick={() => verFoto(selected.foto_rotulo_testemunha)}
                                className="text-xs flex items-center gap-1 bg-muted px-2 py-1 rounded hover:bg-muted/70">
                                <Camera className="h-3 w-3" /> Ver rótulo
                              </button>
                            )}
                          </div>

                          {/* tratamento */}
                          <div className="border rounded-lg p-3 space-y-2 border-primary/40 bg-primary/5">
                            <div className="text-xs font-bold text-primary uppercase tracking-wider">Tratamento</div>
                            {selected.tratamento?.nome && <div className="text-sm font-medium">{selected.tratamento.nome}</div>}
                            {selected.tratamento?.dose && <div className="text-xs text-muted-foreground">Dose: {selected.tratamento.dose}</div>}
                            {selected.tratamento?.garantias && <div className="text-xs text-muted-foreground">Garantias: {selected.tratamento.garantias}</div>}
                            {selected.foto_rotulo_tratamento && (
                              <button onClick={() => verFoto(selected.foto_rotulo_tratamento)}
                                className="text-xs flex items-center gap-1 bg-muted px-2 py-1 rounded hover:bg-muted/70">
                                <Camera className="h-3 w-3" /> Ver rótulo
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          Nenhum dado de testemunha/tratamento cadastrado para este teste.
                        </div>
                      )}

                      {/* complexação */}
                      {selected.nutrientes_substituir?.length > 0 && (
                        <div className="mt-4 border rounded-lg p-3 bg-amber-50/40">
                          <div className="text-xs font-semibold text-amber-800 mb-2">Complexação — Nutrientes substituídos</div>
                          <div className="space-y-1">
                            {selected.nutrientes_substituir.map((n: string) => (
                              <div key={n} className="text-xs flex items-center gap-2">
                                <span className="font-medium">{n}</span>
                                {selected.adubos_substituir?.[n] && (
                                  <>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">{selected.adubos_substituir[n]}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* aba: mapa/ndvi */}
                    <TabsContent value="mapa" className="mt-3 space-y-3">
                      <MapaTalhao
                        geometria={selected.geometria}
                        centro={
                          selected.centro_lat && selected.centro_lng
                            ? [Number(selected.centro_lat), Number(selected.centro_lng)]
                            : null
                        }
                        onSave={salvarGeometria}
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        <Button size="sm" variant="outline" disabled={ndviLoading || !selected.geometria}
                          onClick={() => gerarNdvi("latest")}>
                          <Satellite className="h-4 w-4 mr-1" /> NDVI atual
                        </Button>
                        <Button size="sm" disabled={ndviLoading || !selected.geometria}
                          onClick={() => gerarNdvi("history")} className="bg-gradient-primary">
                          <Satellite className="h-4 w-4 mr-1" /> {ndviLoading ? "Carregando…" : "Série 12 meses"}
                        </Button>
                        {!selected.geometria && (
                          <span className="text-xs text-muted-foreground">Desenhe e salve o talhão para liberar NDVI.</span>
                        )}
                      </div>
                      {ndviSerie.length > 0 && (
                        <div className="border rounded-md p-3">
                          <div className="text-sm font-medium mb-2">Histórico NDVI ({ndviSerie[0]?.fonte})</div>
                          <div className="space-y-1">
                            {ndviSerie.map((n) => (
                              <div key={n.id} className="flex items-center gap-2 text-xs">
                                <span className="w-20 text-muted-foreground">{n.data}</span>
                                <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 via-lime-500 to-emerald-600"
                                    style={{ width: `${Math.max(5, Math.min(100, Number(n.ndvi_mean) * 100))}%` }}
                                  />
                                </div>
                                <span className="w-12 text-right font-mono">{Number(n.ndvi_mean).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* aba: produtos */}
                    <TabsContent value="produtos" className="mt-3">
                      <div className="space-y-2">
                        {(selected.produtos ?? []).map((p: any, i: number) => (
                          <div key={i} className="border rounded-md p-3">
                            <div className="font-medium text-sm">{p.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.area_ha} ha · dose {p.dose || "—"} {p.observacao && `· ${p.observacao}`}
                            </div>
                          </div>
                        ))}
                        {selected.observacoes && (
                          <div className="text-sm pt-2">
                            <span className="text-muted-foreground">Obs.: </span>{selected.observacoes}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* aba: relatório IA */}
                    <TabsContent value="relatorio" className="mt-3">
                      {selected.relatorio_final_resumo ? (
                        <div className="space-y-3">
                          <div className="flex justify-end">
                            <Button size="sm" variant="outline" onClick={baixarRelatorioPDF}>
                              <FileText className="h-4 w-4 mr-1.5" /> Baixar PDF
                            </Button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{selected.relatorio_final_resumo}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground py-6 text-center">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          Nenhum relatório gerado. Use "Finalizar com IA" no cabeçalho acima.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
