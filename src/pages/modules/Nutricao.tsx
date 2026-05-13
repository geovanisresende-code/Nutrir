import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FlaskConical, Upload, Sparkles, FileText, Brain, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type AnalysisType = "soil" | "leaf";

const CROPS = [
  { v: "soja", l: "Soja" }, { v: "milho", l: "Milho" }, { v: "cafe", l: "Café" },
  { v: "sorgo", l: "Sorgo" }, { v: "cana", l: "Cana" }, { v: "algodao", l: "Algodão" },
  { v: "trigo", l: "Trigo" }, { v: "citrus", l: "Citrus" }, { v: "pastagem", l: "Pastagem" },
  { v: "girassol", l: "Girassol" },
];

const SOIL_FIELDS = [
  { k: "ph", l: "pH", u: "" },
  { k: "organic_matter", l: "M.O.", u: "g/kg" },
  { k: "phosphorus", l: "P (Fósforo)", u: "mg/dm³" },
  { k: "potassium", l: "K (Potássio)", u: "mg/dm³" },
  { k: "calcium", l: "Ca (Cálcio)", u: "cmolc/dm³" },
  { k: "magnesium", l: "Mg (Magnésio)", u: "cmolc/dm³" },
  { k: "sulfur", l: "S (Enxofre)", u: "mg/dm³" },
  { k: "cec", l: "CTC", u: "cmolc/dm³" },
  { k: "nitrogen", l: "N (Nitrogênio)", u: "mg/dm³" },
];

const LEAF_FIELDS = [
  { k: "n", l: "N", u: "g/kg" }, { k: "p", l: "P", u: "g/kg" }, { k: "k", l: "K", u: "g/kg" },
  { k: "ca", l: "Ca", u: "g/kg" }, { k: "mg", l: "Mg", u: "g/kg" }, { k: "s", l: "S", u: "g/kg" },
  { k: "b", l: "B", u: "mg/kg" }, { k: "cu", l: "Cu", u: "mg/kg" }, { k: "fe", l: "Fe", u: "mg/kg" },
  { k: "mn", l: "Mn", u: "mg/kg" }, { k: "zn", l: "Zn", u: "mg/kg" },
];

const levelStyle: Record<string, string> = {
  baixo: "bg-destructive/15 text-destructive border-destructive/30",
  medio: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-300",
  adequado: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  alto: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
};

const Nutricao = () => {
  const { current } = useOrg();
  const [tab, setTab] = useState<AnalysisType>("soil");
  const [fields, setFieldsList] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [soilSamples, setSoilSamples] = useState<any[]>([]);
  const [leafSamples, setLeafSamples] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!current) return;
    const [f, c, s, l] = await Promise.all([
      supabase.from("fields").select("id,name").eq("organization_id", current.id),
      supabase.from("clients").select("id,name").eq("organization_id", current.id),
      supabase.from("soil_samples").select("*, fields(name), clients(name)").eq("organization_id", current.id).order("collected_at", { ascending: false }).limit(30),
      supabase.from("leaf_samples").select("*, fields(name), clients(name)").eq("organization_id", current.id).order("collected_at", { ascending: false }).limit(30),
    ]);
    setFieldsList((f.data ?? []) as any);
    setClients((c.data ?? []) as any);
    setSoilSamples((s.data ?? []) as any);
    setLeafSamples((l.data ?? []) as any);
  }, [current]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Nutrição" description="Análises de solo e foliar — entrada manual ou via laudo (PDF + IA)" />
      <div className="p-6 space-y-6">
        <Tabs value={tab} onValueChange={v => setTab(v as AnalysisType)}>
          <TabsList>
            <TabsTrigger value="soil"><FlaskConical className="h-4 w-4 mr-2" />Solo</TabsTrigger>
            <TabsTrigger value="leaf"><FlaskConical className="h-4 w-4 mr-2" />Foliar</TabsTrigger>
          </TabsList>

          <TabsContent value="soil" className="mt-4">
            <SampleSection
              type="soil"
              fields={fields}
              clients={clients}
              samples={soilSamples}
              fieldDefs={SOIL_FIELDS}
              onSaved={load}
            />
          </TabsContent>

          <TabsContent value="leaf" className="mt-4">
            <SampleSection
              type="leaf"
              fields={fields}
              clients={clients}
              samples={leafSamples}
              fieldDefs={LEAF_FIELDS}
              onSaved={load}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

interface SectionProps {
  type: AnalysisType;
  fields: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  samples: any[];
  fieldDefs: { k: string; l: string; u: string }[];
  onSaved: () => void;
}

const SampleSection = ({ type, fields, clients, samples, fieldDefs, onSaved }: SectionProps) => {
  const { current } = useOrg();
  const [crop, setCrop] = useState("soja");
  const [clientId, setClientId] = useState<string>("");
  const [fieldId, setFieldId] = useState<string>("");
  const [collectedAt, setCollectedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportPath, setReportPath] = useState<string | null>(null);

  const handlePdfUpload = async (file: File) => {
    if (!current) return;
    if (file.type !== "application/pdf") { toast.error("Selecione um PDF"); return; }
    setExtracting(true);
    try {
      const path = `${current.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("lab-reports").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      setReportPath(path);

      const { data, error } = await supabase.functions.invoke("extract-lab-pdf", {
        body: { storage_path: path, analysis_type: type },
      });
      if (error) throw error;
      const vals: Record<string, number | null> = data?.values ?? {};
      const next: Record<string, string> = {};
      Object.entries(vals).forEach(([k, v]) => { if (v !== null && v !== undefined) next[k] = String(v); });
      setValues(prev => ({ ...prev, ...next }));
      const filled = Object.values(next).filter(Boolean).length;
      toast.success(`Laudo processado — ${filled} valor(es) extraído(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao extrair PDF");
    } finally {
      setExtracting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const numeric: Record<string, number> = {};
      fieldDefs.forEach(f => {
        const v = parseFloat(values[f.k] ?? "");
        if (!isNaN(v)) numeric[f.k] = v;
      });
      if (Object.keys(numeric).length === 0) {
        toast.error("Informe ao menos um valor"); setSaving(false); return;
      }

      const { data: cls, error: clsErr } = await supabase.functions.invoke("nutrition-classify", {
        body: { values: numeric, crop, analysis_type: type },
      });
      if (clsErr) throw clsErr;

      const base: any = {
        organization_id: current.id,
        client_id: clientId || null,
        field_id: fieldId || null,
        crop,
        collected_at: collectedAt,
        classification: cls?.classification ?? {},
        raw: numeric,
        report_path: reportPath,
        ...numeric,
      };
      const table = type === "soil" ? "soil_samples" : "leaf_samples";
      const { error } = await supabase.from(table).insert(base);
      if (error) throw error;

      toast.success("Amostra classificada e salva");
      setValues({}); setReportPath(null); setFieldId(""); setClientId("");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-2 shadow-soft">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Nova análise {type === "soil" ? "de solo" : "foliar"}
          </h3>

          <div className="space-y-1.5">
            <Label className="text-xs">Importar laudo (PDF) — extração com IA</Label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition">
              {extracting ? (
                <><Sparkles className="h-4 w-4 animate-pulse text-primary" /><span className="text-sm">Extraindo…</span></>
              ) : (
                <><Upload className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Selecionar PDF do laudo</span></>
              )}
              <input type="file" accept="application/pdf" className="hidden" disabled={extracting}
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = ""; }} />
            </label>
            {reportPath && <div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />Anexado</div>}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cultura</Label>
                <Select value={crop} onValueChange={setCrop}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CROPS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data da coleta</Label>
                <Input type="date" value={collectedAt} onChange={e => setCollectedAt(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente (opcional)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Talhão (opcional)</Label>
                <Select value={fieldId} onValueChange={setFieldId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {fieldDefs.map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-xs flex justify-between">
                    <span>{f.l}</span>
                    {f.u && <span className="text-muted-foreground font-normal">{f.u}</span>}
                  </Label>
                  <Input type="number" step="0.01" value={values[f.k] ?? ""}
                    onChange={e => setValues({ ...values, [f.k]: e.target.value })} />
                </div>
              ))}
            </div>

            <Button type="submit" disabled={saving} className="w-full bg-gradient-primary">
              {saving ? "Salvando…" : "Classificar e salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-3 space-y-3">
        <h3 className="font-semibold">Histórico ({samples.length})</h3>
        {samples.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground text-sm">Nenhuma análise ainda.</CardContent>
          </Card>
        )}
        {samples.map(s => (
          <SampleCard key={s.id} sample={s} type={type} fieldDefs={fieldDefs} />
        ))}
      </div>
    </div>
  );
};

function SampleCard({ sample: s, type, fieldDefs }: { sample: any; type: AnalysisType; fieldDefs: { k: string; l: string; u: string }[] }) {
  const [reco, setReco] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const gerar = async () => {
    setLoading(true);
    try {
      const dados: Record<string, number> = {};
      fieldDefs.forEach((f) => { if (s[f.k] != null) dados[f.k] = s[f.k]; });
      const { data, error } = await supabase.functions.invoke("nutrir-recomendacao", {
        body: { tipo: type === "soil" ? "solo" : "folha", cultura: s.crop || "soja", dados, area_ha: s.fields?.hectares },
      });
      if (error) throw error;
      setReco(data?.recomendacao);
      setOpen(true);
      toast.success("Recomendação gerada ✓");
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
    finally { setLoading(false); }
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              {s.fields?.name ?? s.clients?.name ?? "Sem vínculo"}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.collected_at} · {CROPS.find(c => c.v === s.crop)?.l ?? s.crop ?? "—"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {s.report_path && <Badge variant="outline" className="text-[10px]"><FileText className="h-3 w-3 mr-1" />PDF</Badge>}
            <Button size="sm" variant="outline" onClick={gerar} disabled={loading}>
              <Brain className="h-3 w-3 mr-1" />{loading ? "Gerando…" : "Gerar Recomendação IA"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.classification && Object.entries(s.classification as Record<string, any>).map(([k, v]) => {
            const item = v as { value: number; level: string; unit?: string };
            const def = fieldDefs.find(f => f.k === k);
            return (
              <Badge key={k} variant="outline" className={`text-[10px] border ${levelStyle[item.level] ?? ""}`}>
                {def?.l ?? k}: {item.value}{item.unit ? ` ${item.unit}` : ""} · {item.level}
              </Badge>
            );
          })}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Recomendação IA — {type === "soil" ? "Solo" : "Foliar"}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-3">
              {reco && (
                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded">{JSON.stringify(reco, null, 2)}</pre>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default Nutricao;
