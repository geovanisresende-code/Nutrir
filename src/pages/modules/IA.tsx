import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { toast } from "sonner";
import { Brain, Sparkles, Send, Camera, MessageSquare, Plus, Loader2, Upload } from "lucide-react";

const CROPS = [
  { v: "soja", l: "Soja" }, { v: "milho", l: "Milho" }, { v: "cafe", l: "Café" },
  { v: "sorgo", l: "Sorgo" }, { v: "cana", l: "Cana" }, { v: "algodao", l: "Algodão" },
  { v: "trigo", l: "Trigo" }, { v: "citrus", l: "Citrus" }, { v: "pastagem", l: "Pastagem" },
  { v: "girassol", l: "Girassol" },
];

const IA = () => {
  return (
    <>
      <PageHeader title="IA Agronômica" description="Recomendações, chat especializado e diagnóstico por imagem" />
      <div className="p-6">
        <Tabs defaultValue="recommend">
          <TabsList>
            <TabsTrigger value="recommend"><Sparkles className="h-4 w-4 mr-2" />Recomendação</TabsTrigger>
            <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" />Chat</TabsTrigger>
            <TabsTrigger value="image"><Camera className="h-4 w-4 mr-2" />Diagnóstico por foto</TabsTrigger>
          </TabsList>
          <TabsContent value="recommend" className="mt-4"><RecommendTab /></TabsContent>
          <TabsContent value="chat" className="mt-4"><ChatTab /></TabsContent>
          <TabsContent value="image" className="mt-4"><ImageTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
};

/* =================== TAB 1: RECOMMEND =================== */
const RecommendTab = () => {
  const { current } = useOrg();
  const { log } = useAuditLog();
  const [type, setType] = useState<"soil"|"leaf">("soil");
  const [samples, setSamples] = useState<any[]>([]);
  const [sampleId, setSampleId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!current) return;
    const table = type === "soil" ? "soil_samples" : "leaf_samples";
    const { data } = await supabase
      .from(table)
      .select("id, collected_at, crop, fields(name), clients(name)")
      .eq("organization_id", current.id)
      .order("collected_at", { ascending: false }).limit(50);
    setSamples((data ?? []) as any);
    const { data: recs } = await supabase
      .from("ai_recommendations")
      .select("id, response, created_at, metadata, fields(name)")
      .eq("organization_id", current.id)
      .order("created_at", { ascending: false }).limit(10);
    setHistory((recs ?? []) as any);
  }, [current, type]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!current || !sampleId) return;
    setLoading(true); setResponse("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-recommend", {
        body: { organization_id: current.id, sample_id: sampleId, analysis_type: type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResponse(data?.response ?? "");
      log({ action: "ai.recommend", entity_type: "ai_recommendation", entity_id: data?.id ?? null, description: `Recomendação ${type} gerada`, metadata: { sample_id: sampleId, type } });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar recomendação");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-2 shadow-soft h-fit">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/>Gerar recomendação</h3>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de análise</Label>
            <Select value={type} onValueChange={v=>{setType(v as any); setSampleId("");}}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="soil">Solo</SelectItem>
                <SelectItem value="leaf">Foliar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amostra</Label>
            <Select value={sampleId} onValueChange={setSampleId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma amostra"/></SelectTrigger>
              <SelectContent>
                {samples.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.collected_at} · {s.fields?.name ?? s.clients?.name ?? "—"} {s.crop ? `· ${s.crop}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {samples.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma análise — cadastre em Nutrição.</p>}
          </div>
          <Button onClick={generate} disabled={!sampleId || loading} className="w-full bg-gradient-primary">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Gerando…</> : <>Gerar recomendação</>}
          </Button>

          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico</h4>
            <div className="space-y-2 max-h-64 overflow-auto">
              {history.map(h => (
                <button key={h.id} onClick={()=>setResponse(h.response)} className="w-full text-left p-2 rounded hover:bg-muted/50 text-xs">
                  <div className="font-medium truncate">{h.fields?.name ?? "—"} {h.metadata?.crop ? `· ${h.metadata.crop}` : ""}</div>
                  <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                </button>
              ))}
              {history.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma recomendação ainda.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 shadow-soft">
        <CardContent className="p-6">
          {response ? (
            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-table:text-sm">
              <ReactMarkdown>{response}</ReactMarkdown>
            </article>
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-50"/>
              <p className="text-sm">Selecione uma amostra para receber o diagnóstico e plano de adubação.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* =================== TAB 2: CHAT =================== */
type Msg = { id?: string; role: "user"|"assistant"; content: string };

const ChatTab = () => {
  const { current } = useOrg();
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!current) return;
    const { data } = await supabase.from("ai_chat_threads")
      .select("id, title, updated_at")
      .eq("organization_id", current.id).order("updated_at", { ascending: false }).limit(30);
    setThreads(data ?? []);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  }, [current, activeId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    supabase.from("ai_chat_messages")
      .select("id, role, content").eq("thread_id", activeId).order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data ?? []) as Msg[]));
  }, [activeId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const newThread = async () => {
    if (!current || !user) return;
    const { data, error } = await supabase.from("ai_chat_threads")
      .insert({ organization_id: current.id, created_by: user.id, title: "Nova conversa" })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setActiveId(data.id); setMessages([]); loadThreads();
  };

  const send = async () => {
    if (!input.trim() || !activeId || streaming) return;
    const text = input.trim();
    setInput(""); setStreaming(true);
    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }]);

    // first message? rename thread
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      await supabase.from("ai_chat_threads").update({ title }).eq("id", activeId);
      loadThreads();
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ thread_id: activeId, message: text }),
      });

      if (resp.status === 429) { toast.error("Limite de requisições atingido."); throw new Error("429"); }
      if (resp.status === 402) { toast.error("Créditos de IA esgotados."); throw new Error("402"); }
      if (!resp.ok || !resp.body) {
        const t = await resp.text(); throw new Error(t || "Falha no chat");
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const j = JSON.parse(payload);
            const c = j?.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages(prev => prev.map((m, idx) => idx === prev.length - 1 ? { ...m, content: acc } : m));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      if (!["429","402"].includes(e?.message)) toast.error(e?.message ?? "Erro no chat");
      setMessages(prev => prev.slice(0, -1));
    } finally { setStreaming(false); }
  };

  return (
    <div className="grid lg:grid-cols-4 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
      <Card className="lg:col-span-1 shadow-soft flex flex-col">
        <CardContent className="p-3 flex-1 flex flex-col">
          <Button onClick={newThread} variant="outline" className="w-full mb-3"><Plus className="h-4 w-4 mr-2"/>Nova conversa</Button>
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {threads.map(t => (
                <button key={t.id} onClick={()=>setActiveId(t.id)}
                  className={`w-full text-left px-2 py-2 rounded text-sm truncate ${activeId===t.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
                  {t.title}
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 shadow-soft flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          {!activeId ? (
            <div className="flex-1 grid place-items-center text-center text-muted-foreground p-8">
              <div>
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50"/>
                <p className="text-sm mb-3">Crie uma conversa para começar.</p>
                <Button onClick={newThread} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2"/>Nova conversa</Button>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <Brain className="h-10 w-10 mx-auto mb-2 opacity-50"/>
                    <p className="text-sm">Pergunte algo sobre nutrição, manejo, pragas, doenças…</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role==="user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role==="user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.role === "assistant" ? (
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                          <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                        </article>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3 flex gap-2">
                <Textarea
                  value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Pergunte ao agrônomo IA… (Enter para enviar)"
                  className="resize-none min-h-[44px] max-h-32"
                  rows={1} disabled={streaming}
                />
                <Button onClick={send} disabled={streaming || !input.trim()} className="bg-gradient-primary">
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* =================== TAB 3: IMAGE =================== */
const ImageTab = () => {
  const { current } = useOrg();
  const { log } = useAuditLog();
  const [crop, setCrop] = useState("soja");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = useCallback(async () => {
    if (!current) return;
    const { data } = await supabase.from("ai_image_diagnoses")
      .select("*").eq("organization_id", current.id).order("created_at", { ascending: false }).limit(12);
    setHistory(data ?? []);
  }, [current]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const onFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
  };

  const analyze = async () => {
    if (!current || !file) return;
    setAnalyzing(true); setResult(null);
    try {
      const path = `${current.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("plant-photos").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;

      const { data, error } = await supabase.functions.invoke("ai-image-diagnose", {
        body: { organization_id: current.id, image_path: path, crop },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.result);
      log({ action: "ai.image_diagnose", entity_type: "ai_image_diagnosis", entity_id: data?.id ?? null, description: data?.result?.diagnosis ?? "Diagnóstico por imagem", metadata: { crop, severity: data?.result?.severity } });
      loadHistory();
      toast.success("Diagnóstico concluído");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao diagnosticar");
    } finally { setAnalyzing(false); }
  };

  const sevColor: Record<string,string> = {
    leve: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    moderado: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    severo: "bg-destructive/15 text-destructive",
    indeterminado: "bg-muted text-muted-foreground",
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <Card className="lg:col-span-2 shadow-soft h-fit">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Camera className="h-4 w-4 text-primary"/>Analisar foto</h3>

          <div className="space-y-1.5">
            <Label className="text-xs">Cultura</Label>
            <Select value={crop} onValueChange={setCrop}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{CROPS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <label className="block border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition">
            {previewUrl ? (
              <img src={previewUrl} alt="preview" className="w-full h-48 object-cover rounded"/>
            ) : (
              <div className="flex items-center justify-center gap-2 h-48 text-muted-foreground">
                <Upload className="h-5 w-5"/><span className="text-sm">Selecionar foto da planta</span>
              </div>
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}/>
          </label>

          <Button onClick={analyze} disabled={!file || analyzing} className="w-full bg-gradient-primary">
            {analyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Analisando…</> : <>Analisar com IA</>}
          </Button>

          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico</h4>
            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-auto">
              {history.map(h => (
                <DiagThumb key={h.id} diag={h} onClick={() => setResult(h.raw ?? { diagnosis: h.diagnosis, severity: h.severity, treatment: h.treatment })}/>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 shadow-soft">
        <CardContent className="p-6">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Resultado</h3>
                <Badge className={sevColor[result.severity] ?? ""}>{result.severity ?? "—"}</Badge>
                {result.confidence != null && (
                  <Badge variant="outline" className="text-[10px]">Confiança {Math.round(result.confidence*100)}%</Badge>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Diagnóstico</h4>
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{result.diagnosis ?? ""}</ReactMarkdown>
                </article>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Tratamento sugerido</h4>
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{result.treatment ?? ""}</ReactMarkdown>
                </article>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <Camera className="h-10 w-10 mx-auto mb-3 opacity-50"/>
              <p className="text-sm">Envie uma foto nítida da folha ou planta para diagnóstico.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const DiagThumb = ({ diag, onClick }: { diag: any; onClick: () => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("plant-photos").createSignedUrl(diag.image_path, 3600).then(({ data }) => {
      setUrl(data?.signedUrl ?? null);
    });
  }, [diag.image_path]);
  return (
    <button onClick={onClick} className="aspect-square overflow-hidden rounded border hover:border-primary transition">
      {url ? <img src={url} alt="" className="w-full h-full object-cover"/> : <div className="bg-muted w-full h-full"/>}
    </button>
  );
};

export default IA;
