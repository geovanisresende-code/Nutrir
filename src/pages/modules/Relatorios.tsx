import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, Loader2, FileText, Trash2, Download, Search, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  generateAnalysisReport,
  generateRecommendationReport,
  generateNdviReport,
  generateConsolidatedReport,
  type ReportContext,
} from "@/lib/pdf";
import {
  exportCSV, exportXLSX,
  SOIL_COLUMNS, LEAF_COLUMNS, FIELDS_COLUMNS, POINTS_COLUMNS, RECS_COLUMNS,
} from "@/lib/exporters";

type ReportRow = {
  id: string;
  kind: string;
  title: string;
  storage_path: string;
  created_at: string;
};

const SOIL_FIELDS = ["ph", "organic_matter", "phosphorus", "potassium", "calcium", "magnesium", "sulfur", "cec", "nitrogen"];
const LEAF_FIELDS = ["n", "p", "k", "ca", "mg", "s", "b", "cu", "fe", "mn", "zn"];

const Relatorios = () => {
  const { current } = useOrg();
  const { user } = useAuth();
  const { log } = useAuditLog();
  const [history, setHistory] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  // selectors
  const [clients, setClients] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [soilSamples, setSoilSamples] = useState<any[]>([]);
  const [leafSamples, setLeafSamples] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);

  const [analysisType, setAnalysisType] = useState<"soil" | "leaf">("soil");
  const [sampleId, setSampleId] = useState<string>("");
  const [recId, setRecId] = useState<string>("");
  const [ndviFieldId, setNdviFieldId] = useState<string>("");
  const [consClientId, setConsClientId] = useState<string>("all");

  // History filters
  const [hSearch, setHSearch] = useState("");
  const [hKind, setHKind] = useState<string>("all");
  const [hFrom, setHFrom] = useState<string>("");
  const [hTo, setHTo] = useState<string>("");

  // Export tab state
  const [expEntity, setExpEntity] = useState<"soil" | "leaf" | "fields" | "points" | "recs">("soil");
  const [expFormat, setExpFormat] = useState<"csv" | "xlsx">("xlsx");
  const [expClientId, setExpClientId] = useState<string>("all");
  const [expFieldId, setExpFieldId] = useState<string>("all");
  const [expFrom, setExpFrom] = useState<string>("");
  const [expTo, setExpTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const loadAll = async () => {
    if (!current) return;
    const [c, f, ss, ls, rr, hh] = await Promise.all([
      supabase.from("clients").select("id,name").eq("organization_id", current.id),
      supabase.from("fields").select("id,name,client_id").eq("organization_id", current.id),
      supabase.from("soil_samples").select("*").eq("organization_id", current.id).order("collected_at", { ascending: false }).limit(50),
      supabase.from("leaf_samples").select("*").eq("organization_id", current.id).order("collected_at", { ascending: false }).limit(50),
      supabase.from("ai_recommendations").select("*").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("reports").select("id,kind,title,storage_path,created_at").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setClients(c.data ?? []);
    setFields(f.data ?? []);
    setSoilSamples(ss.data ?? []);
    setLeafSamples(ls.data ?? []);
    setRecs(rr.data ?? []);
    setHistory((hh.data ?? []) as ReportRow[]);
  };

  useEffect(() => { loadAll(); }, [current]);

  const ctxFor = (clientId?: string | null, fieldId?: string | null): ReportContext => ({
    orgName: current?.name ?? "Organização",
    clientName: clients.find(c => c.id === clientId)?.name ?? null,
    fieldName: fields.find(f => f.id === fieldId)?.name ?? null,
  });

  const saveAndDownload = async (
    kind: string,
    title: string,
    blob: Blob,
    refs: { client_id?: string | null; field_id?: string | null; sample_id?: string | null } = {},
  ) => {
    if (!current || !user) return;
    const filename = `${kind}-${Date.now()}.pdf`;
    const path = `${current.id}/${filename}`;
    const { error: upErr } = await supabase.storage.from("reports").upload(path, blob, { contentType: "application/pdf" });
    if (upErr) { toast.error(`Falha no upload: ${upErr.message}`); return; }
    const { error: insErr } = await supabase.from("reports").insert({
      organization_id: current.id,
      created_by: user.id,
      kind, title, storage_path: path,
      ...refs,
    });
    if (insErr) { toast.error(insErr.message); return; }

    // browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    log({ action: "report.generate", entity_type: "report", description: title, client_id: refs.client_id ?? null, field_id: refs.field_id ?? null, metadata: { kind } });
    toast.success("Relatório gerado e salvo");
    loadAll();
  };

  const downloadFromStorage = async (r: ReportRow) => {
    const { data, error } = await supabase.storage.from("reports").createSignedUrl(r.storage_path, 60);
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    log({ action: "report.download", entity_type: "report", entity_id: r.id, description: r.title });
    window.open(data.signedUrl, "_blank");
  };

  const deleteReport = async (r: ReportRow) => {
    if (!confirm("Excluir este relatório?")) return;
    await supabase.storage.from("reports").remove([r.storage_path]);
    const { error } = await supabase.from("reports").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Relatório excluído");
    loadAll();
  };

  // === Generators ===
  const genAnalysis = async () => {
    if (!sampleId) { toast.warning("Selecione uma análise"); return; }
    const samples = analysisType === "soil" ? soilSamples : leafSamples;
    const s = samples.find((x: any) => x.id === sampleId);
    if (!s) return;
    setLoading(true);
    try {
      const fieldsToUse = analysisType === "soil" ? SOIL_FIELDS : LEAF_FIELDS;
      const values: Record<string, number | null> = {};
      fieldsToUse.forEach(k => values[k] = s[k] ?? null);
      const blob = generateAnalysisReport(
        ctxFor(s.client_id, s.field_id),
        {
          type: analysisType,
          collected_at: s.collected_at,
          crop: s.crop,
          values,
          classification: s.classification,
        },
      );
      const title = `Análise ${analysisType === "soil" ? "de solo" : "foliar"} — ${new Date(s.collected_at).toLocaleDateString("pt-BR")}`;
      await saveAndDownload("analysis", title, blob, { client_id: s.client_id, field_id: s.field_id, sample_id: s.id });
    } finally { setLoading(false); }
  };

  const genRecommendation = async () => {
    if (!recId) { toast.warning("Selecione uma recomendação"); return; }
    const r = recs.find((x: any) => x.id === recId);
    if (!r) return;
    setLoading(true);
    try {
      const blob = generateRecommendationReport(
        ctxFor(null, r.field_id),
        { prompt: r.prompt, response: r.response, model: r.model, created_at: r.created_at },
      );
      const title = `Recomendação IA — ${new Date(r.created_at).toLocaleDateString("pt-BR")}`;
      await saveAndDownload("recommendation", title, blob, { field_id: r.field_id });
    } finally { setLoading(false); }
  };

  const genNdvi = async () => {
    if (!ndviFieldId || !current) { toast.warning("Selecione um talhão"); return; }
    const f = fields.find(x => x.id === ndviFieldId);
    setLoading(true);
    try {
      const { data } = await supabase
        .from("ndvi_readings")
        .select("captured_at, ndvi_mean, ndvi_min, ndvi_max, source")
        .eq("organization_id", current.id)
        .eq("field_id", ndviFieldId)
        .order("captured_at");
      if (!data?.length) { toast.warning("Nenhuma leitura NDVI para este talhão"); return; }
      const blob = generateNdviReport(ctxFor(f?.client_id, ndviFieldId), data as any);
      const title = `NDVI — ${f?.name ?? "Talhão"}`;
      await saveAndDownload("ndvi", title, blob, { field_id: ndviFieldId });
    } finally { setLoading(false); }
  };

  const genConsolidated = async () => {
    if (!current) return;
    setLoading(true);
    try {
      const filterClient = (q: any) => consClientId === "all" ? q : q.eq("client_id", consClientId);
      const [s, l, n, r] = await Promise.all([
        filterClient(supabase.from("soil_samples").select("*").eq("organization_id", current.id)).order("collected_at", { ascending: false }).limit(50),
        filterClient(supabase.from("leaf_samples").select("*").eq("organization_id", current.id)).order("collected_at", { ascending: false }).limit(50),
        supabase.from("ndvi_readings").select("captured_at,ndvi_mean").eq("organization_id", current.id).order("captured_at", { ascending: false }).limit(1),
        supabase.from("ai_recommendations").select("created_at,response").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(5),
      ]);
      const clientName = consClientId === "all" ? null : clients.find(c => c.id === consClientId)?.name ?? null;
      const blob = generateConsolidatedReport(
        { orgName: current.name, clientName },
        {
          soil: s.data ?? [],
          leaf: l.data ?? [],
          ndviLast: (n.data?.[0] as any) ?? null,
          recommendations: (r.data ?? []) as any,
        },
      );
      const title = `Consolidado${clientName ? ` — ${clientName}` : ""}`;
      await saveAndDownload("consolidated", title, blob, { client_id: consClientId === "all" ? null : consClientId });
    } finally { setLoading(false); }
  };

  const samples = analysisType === "soil" ? soilSamples : leafSamples;

  // === Data export ===
  const runExport = async () => {
    if (!current) return;
    setExporting(true);
    try {
      const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));
      const fieldMap = new Map(fields.map((f: any) => [f.id, f.name]));
      const enrich = (rows: any[]) => rows.map(r => ({
        ...r,
        client_name: clientMap.get(r.client_id) ?? "",
        field_name: fieldMap.get(r.field_id) ?? "",
      }));
      const applyFilters = (q: any, dateField: string) => {
        let qq = q;
        if (expClientId !== "all") qq = qq.eq("client_id", expClientId);
        if (expFieldId !== "all") qq = qq.eq("field_id", expFieldId);
        if (expFrom) qq = qq.gte(dateField, expFrom);
        if (expTo) qq = qq.lte(dateField, expTo);
        return qq;
      };

      let rows: any[] = [];
      let columns = SOIL_COLUMNS;
      let baseName = "export";

      if (expEntity === "soil") {
        const { data, error } = await applyFilters(
          supabase.from("soil_samples").select("*").eq("organization_id", current.id),
          "collected_at",
        ).order("collected_at", { ascending: false });
        if (error) throw error;
        rows = enrich(data ?? []);
        columns = SOIL_COLUMNS;
        baseName = "amostras-solo";
      } else if (expEntity === "leaf") {
        const { data, error } = await applyFilters(
          supabase.from("leaf_samples").select("*").eq("organization_id", current.id),
          "collected_at",
        ).order("collected_at", { ascending: false });
        if (error) throw error;
        rows = enrich(data ?? []);
        columns = LEAF_COLUMNS;
        baseName = "amostras-foliares";
      } else if (expEntity === "fields") {
        let q: any = supabase.from("fields").select("*").eq("organization_id", current.id);
        if (expClientId !== "all") q = q.eq("client_id", expClientId);
        if (expFrom) q = q.gte("created_at", expFrom);
        if (expTo) q = q.lte("created_at", expTo);
        const { data, error } = await q.order("created_at", { ascending: false });
        if (error) throw error;
        rows = enrich(data ?? []);
        columns = FIELDS_COLUMNS;
        baseName = "talhoes";
      } else if (expEntity === "points") {
        const { data, error } = await applyFilters(
          supabase.from("collection_points").select("*").eq("organization_id", current.id),
          "created_at",
        ).order("created_at", { ascending: false });
        if (error) throw error;
        rows = enrich(data ?? []);
        columns = POINTS_COLUMNS;
        baseName = "coletas";
      } else if (expEntity === "recs") {
        let q: any = supabase.from("ai_recommendations").select("*").eq("organization_id", current.id);
        if (expFieldId !== "all") q = q.eq("field_id", expFieldId);
        if (expFrom) q = q.gte("created_at", expFrom);
        if (expTo) q = q.lte("created_at", expTo);
        const { data, error } = await q.order("created_at", { ascending: false });
        if (error) throw error;
        rows = enrich(data ?? []);
        columns = RECS_COLUMNS;
        baseName = "recomendacoes-ia";
      }

      if (!rows.length) { toast.warning("Nenhum registro para exportar com esses filtros"); return; }

      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${baseName}-${stamp}`;
      if (expFormat === "csv") exportCSV(rows, columns as any, filename);
      else exportXLSX(rows, columns as any, filename, baseName);

      log({ action: "data.export", entity_type: "data_export", description: `Exportou ${rows.length} registros (${expFormat}) — ${expEntity}`, metadata: { entity: expEntity, format: expFormat, count: rows.length } });
      toast.success(`${rows.length} registros exportados`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao exportar");
    } finally { setExporting(false); }
  };

  // History filtering
  const filteredHistory = history.filter(r => {
    if (hKind !== "all" && r.kind !== hKind) return false;
    if (hSearch && !r.title.toLowerCase().includes(hSearch.toLowerCase())) return false;
    if (hFrom && r.created_at < hFrom) return false;
    if (hTo && r.created_at > hTo + "T23:59:59") return false;
    return true;
  });
  const fieldsForExport = expClientId === "all" ? fields : fields.filter(f => f.client_id === expClientId);


  return (
    <>
      <PageHeader title="Relatórios" description="Gere PDFs profissionais de análises, recomendações, NDVI e consolidados" />
      <div className="p-6 space-y-6">
        <Tabs defaultValue="analysis">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 max-w-3xl">
            <TabsTrigger value="analysis">Análise</TabsTrigger>
            <TabsTrigger value="recommendation">Recomendação</TabsTrigger>
            <TabsTrigger value="ndvi">NDVI</TabsTrigger>
            <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
            <TabsTrigger value="export"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Exportar</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <Card><CardContent className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={analysisType} onValueChange={(v) => { setAnalysisType(v as any); setSampleId(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soil">Solo</SelectItem>
                      <SelectItem value="leaf">Foliar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Análise</Label>
                  <Select value={sampleId} onValueChange={setSampleId}>
                    <SelectTrigger><SelectValue placeholder={`${samples.length} disponíveis`} /></SelectTrigger>
                    <SelectContent>
                      {samples.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {new Date(s.collected_at).toLocaleDateString("pt-BR")} • {s.crop ?? "—"}
                          {fields.find(f => f.id === s.field_id)?.name ? ` • ${fields.find(f => f.id === s.field_id)?.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={genAnalysis} disabled={loading || !sampleId} className="bg-gradient-primary">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar PDF
              </Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="recommendation">
            <Card><CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Recomendação salva</Label>
                <Select value={recId} onValueChange={setRecId}>
                  <SelectTrigger><SelectValue placeholder={`${recs.length} disponíveis`} /></SelectTrigger>
                  <SelectContent>
                    {recs.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {new Date(r.created_at).toLocaleString("pt-BR")} • {r.prompt?.slice(0, 40)}…
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={genRecommendation} disabled={loading || !recId} className="bg-gradient-primary">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar PDF
              </Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="ndvi">
            <Card><CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Talhão</Label>
                <Select value={ndviFieldId} onValueChange={setNdviFieldId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {fields.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={genNdvi} disabled={loading || !ndviFieldId} className="bg-gradient-primary">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar PDF
              </Button>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="consolidated">
            <Card><CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={consClientId} onValueChange={setConsClientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={genConsolidated} disabled={loading} className="bg-gradient-primary">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                Gerar PDF
              </Button>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="export">
            <Card><CardContent className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de dado</Label>
                  <Select value={expEntity} onValueChange={(v) => setExpEntity(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soil">Amostras de solo</SelectItem>
                      <SelectItem value="leaf">Amostras foliares</SelectItem>
                      <SelectItem value="fields">Talhões</SelectItem>
                      <SelectItem value="points">Pontos de coleta</SelectItem>
                      <SelectItem value="recs">Recomendações IA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Formato</Label>
                  <Select value={expFormat} onValueChange={(v) => setExpFormat(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cliente</Label>
                  <Select value={expClientId} onValueChange={(v) => { setExpClientId(v); setExpFieldId("all"); }} disabled={expEntity === "recs"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Talhão</Label>
                  <Select value={expFieldId} onValueChange={setExpFieldId} disabled={expEntity === "fields"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {fieldsForExport.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data inicial</Label>
                  <Input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data final</Label>
                  <Input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} />
                </div>
              </div>
              <Button onClick={runExport} disabled={exporting} className="bg-gradient-primary">
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Exportar dados
              </Button>
              <p className="text-xs text-muted-foreground">
                Exporta a listagem aplicando os filtros acima. Útil para abrir no Excel/Google Sheets ou enviar para sistemas externos.
              </p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Histórico</h3>
              <div className="text-xs text-muted-foreground">{filteredHistory.length} de {history.length}</div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input value={hSearch} onChange={(e) => setHSearch(e.target.value)} placeholder="Buscar por título" className="pl-8 h-9" />
              </div>
              <Select value={hKind} onValueChange={setHKind}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="analysis">Análise</SelectItem>
                  <SelectItem value="recommendation">Recomendação</SelectItem>
                  <SelectItem value="ndvi">NDVI</SelectItem>
                  <SelectItem value="consolidated">Consolidado</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)} className="h-9" placeholder="De" />
              <Input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)} className="h-9" placeholder="Até" />
            </div>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                {history.length === 0 ? "Nenhum relatório gerado ainda." : "Nenhum relatório corresponde aos filtros."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{r.kind}</Badge>
                        <span className="font-medium truncate">{r.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadFromStorage(r)}>
                      <Download className="h-3.5 w-3.5 mr-1" />Baixar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteReport(r)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Relatorios;
