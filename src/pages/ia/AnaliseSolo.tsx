import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type SoloForm = {
  cultura: string;
  produtividade_esperada: string;
  v_perc_desejado: string;
  prnt_calcario: string;
  ph: string;
  mo: string;
  p: string;
  k: string;
  ca: string;
  mg: string;
  al: string;
  ctc: string;
  v_atual: string;
  s: string;
  b: string;
  zn: string;
  cu: string;
  fe: string;
  mn: string;
  observacoes: string;
};

const empty: SoloForm = {
  cultura: "Soja", produtividade_esperada: "60", v_perc_desejado: "70", prnt_calcario: "85",
  ph: "", mo: "", p: "", k: "", ca: "", mg: "", al: "", ctc: "", v_atual: "",
  s: "", b: "", zn: "", cu: "", fe: "", mn: "", observacoes: "",
};

export default function IASolo() {
  const { current } = useOrg();
  const [form, setForm] = useState<SoloForm>(empty);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const set = (k: keyof SoloForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const analisar = async () => {
    if (!current) return;
    setLoading(true); setResultado(null);
    try {
      const prompt = buildPrompt(form);
      const { data, error } = await supabase.functions.invoke("ai-solo-recipe", {
        body: { organization_id: current.id, prompt },
      });
      if (error) throw error;
      setResultado(data?.content || JSON.stringify(data));
    } catch (e: any) {
      toast.error(e.message || "Falha na análise");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          IA · Análise de Solo
        </h1>
        <p className="text-muted-foreground text-sm">Receita de correção via calcário, gesso e NPK gerada por IA</p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Preenchimento manual</TabsTrigger>
          <TabsTrigger value="pdf">Importar PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Dados gerais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Cultura"><Input value={form.cultura} onChange={set("cultura")} /></Field>
              <Field label="Produtividade esperada (sc/ha)"><Input value={form.produtividade_esperada} onChange={set("produtividade_esperada")} /></Field>
              <Field label="V% desejado"><Input value={form.v_perc_desejado} onChange={set("v_perc_desejado")} /></Field>
              <Field label="PRNT do calcário (%)"><Input value={form.prnt_calcario} onChange={set("prnt_calcario")} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Resultado da análise</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="pH"><Input value={form.ph} onChange={set("ph")} /></Field>
              <Field label="M.O. (g/dm³)"><Input value={form.mo} onChange={set("mo")} /></Field>
              <Field label="P (mg/dm³)"><Input value={form.p} onChange={set("p")} /></Field>
              <Field label="K (cmolc/dm³)"><Input value={form.k} onChange={set("k")} /></Field>
              <Field label="Ca (cmolc/dm³)"><Input value={form.ca} onChange={set("ca")} /></Field>
              <Field label="Mg (cmolc/dm³)"><Input value={form.mg} onChange={set("mg")} /></Field>
              <Field label="Al (cmolc/dm³)"><Input value={form.al} onChange={set("al")} /></Field>
              <Field label="CTC"><Input value={form.ctc} onChange={set("ctc")} /></Field>
              <Field label="V% atual"><Input value={form.v_atual} onChange={set("v_atual")} /></Field>
              <Field label="S (mg/dm³)"><Input value={form.s} onChange={set("s")} /></Field>
              <Field label="B"><Input value={form.b} onChange={set("b")} /></Field>
              <Field label="Zn"><Input value={form.zn} onChange={set("zn")} /></Field>
              <Field label="Cu"><Input value={form.cu} onChange={set("cu")} /></Field>
              <Field label="Fe"><Input value={form.fe} onChange={set("fe")} /></Field>
              <Field label="Mn"><Input value={form.mn} onChange={set("mn")} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={3} value={form.observacoes} onChange={set("observacoes")} placeholder="Histórico, sintomas observados, restrições..." />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pdf">
          <Card>
            <CardContent className="p-6 space-y-3">
              <Label>PDF da análise de solo</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
              {pdfFile && <p className="text-sm text-muted-foreground">Arquivo: {pdfFile.name}</p>}
              <p className="text-xs text-muted-foreground">
                <FileUp className="inline h-3 w-3 mr-1" />
                Após escolher o arquivo, preencha os campos básicos na aba "manual" e clique em Analisar.
                A extração automatizada de PDFs estará disponível em breve.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button size="lg" onClick={analisar} disabled={loading} className="bg-gradient-primary">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calculando recomendação...</> : "Gerar receita de correção"}
      </Button>

      {resultado && (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader><CardTitle>Receita de correção</CardTitle></CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{resultado}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

function buildPrompt(f: SoloForm): string {
  return `Analise a seguinte amostra de solo e gere uma RECEITA DE CORREÇÃO completa.

DADOS GERAIS
- Cultura: ${f.cultura}
- Produtividade esperada: ${f.produtividade_esperada} sc/ha
- V% desejado: ${f.v_perc_desejado}
- PRNT do calcário disponível: ${f.prnt_calcario}%

RESULTADO DA ANÁLISE
- pH: ${f.ph} | M.O.: ${f.mo} g/dm³
- P: ${f.p} mg/dm³ | K: ${f.k} cmolc/dm³
- Ca: ${f.ca} | Mg: ${f.mg} | Al: ${f.al} | CTC: ${f.ctc} | V% atual: ${f.v_atual}
- S: ${f.s} | B: ${f.b} | Zn: ${f.zn} | Cu: ${f.cu} | Fe: ${f.fe} | Mn: ${f.mn}

OBSERVAÇÕES: ${f.observacoes || "—"}

Estruture a resposta em Markdown PT-BR com:
## Diagnóstico (faixas baixo/médio/adequado/alto + impacto)
## Calagem (NC = (V%des - V%atual) × CTC ÷ PRNT, dose final t/ha)
## Gessagem (necessidade de Ca em profundidade)
## Adubação NPK (tabela com dose kg/ha por nutriente, fonte e modo de aplicação, considerando produtividade esperada)
## Micronutrientes
## Observações finais (parcelamento, época, riscos)`;
}
