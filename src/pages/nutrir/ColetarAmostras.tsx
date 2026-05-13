import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Play, StopCircle, Plus, Trash2, Cloud, Wind, Thermometer,
  Droplets, Crosshair, CheckCircle2, FlaskConical, Map as MapIcon, Save,
} from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/*
  Coletar Amostras (georreferenciado)
  ────────────────────────────────────────────
  Fluxo:
   1. Representante escolhe Cliente → Fazenda → Talhão e Cultura
   2. Clica em "Iniciar Coleta": leitura GPS + meteorologia local (best-effort)
   3. A cada ponto: registra coordenada, gera código abreviado
      → SA{sub}.{amostra}.{talhao} {Fazenda}
      Ex.: SA1.3.1 Santa Rita  → subamostra 1 da amostra 3 do talhão 1, faz. Santa Rita
   4. Marca quantos pontos formam UMA amostra composta (configurável, padrão 8)
   5. Ao finalizar, persiste em `collection_points`/`soil_samples`.
*/

interface Cliente { id: string; razao_social: string; nome_fantasia: string | null; }
interface Fazenda { id: string; nome: string; cliente_id: string; }
interface Talhao  { id: string; nome: string; fazenda_id: string; }
interface Cultura { id: string; nome: string; }

interface Ponto {
  id: string;
  sub: number;
  amostra: number;
  talhao_idx: number;
  lat: number | null;
  lng: number | null;
  acuracia: number | null;
  registrado_em: string;
  nome: string;       // "Subamostra 1 da Amostra Composta 3, Talhão 1, Fazenda Santa Rita…"
  abrev: string;      // "SA1.3.1 Santa Rita"
}

interface Meteorologia {
  temperatura: number | null;
  umidade: number | null;
  vento: number | null;
  precipitacao: number | null;
  obtido_em: string | null;
}

const SUBS_POR_AMOSTRA_PADRAO = 8;

export default function ColetarAmostras() {
  const { current } = useOrg();
  const { user } = useAuth();

  // Catálogos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);

  // Seleção
  const [clienteId, setClienteId] = useState<string>("");
  const [fazendaId, setFazendaId] = useState<string>("");
  const [talhaoId, setTalhaoId]   = useState<string>("");
  const [culturaId, setCulturaId] = useState<string>("");
  const [subsPorAmostra, setSubsPorAmostra] = useState<number>(SUBS_POR_AMOSTRA_PADRAO);

  // Coleta
  const [coletando, setColetando] = useState(false);
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [meteo, setMeteo] = useState<Meteorologia>({
    temperatura: null, umidade: null, vento: null, precipitacao: null, obtido_em: null,
  });
  const [gpsAtual, setGpsAtual] = useState<{ lat: number; lng: number; acc: number } | null>(null);

  // ── Carregar catálogos ───────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    (async () => {
      const [{ data: c }, { data: f }, { data: t }, { data: cu }] = await Promise.all([
        (supabase as any).from("nutrir_clientes").select("id,razao_social,nome_fantasia").eq("organization_id", current.id).order("razao_social"),
        (supabase as any).from("farms").select("id,nome:name,cliente_id:client_id").eq("organization_id", current.id),
        (supabase as any).from("fields").select("id,nome:name,fazenda_id:farm_id").eq("organization_id", current.id),
        (supabase as any).from("nutrir_culturas").select("id,nome").eq("organization_id", current.id).order("nome"),
      ]);
      setClientes(c ?? []);
      setFazendas(f ?? []);
      setTalhoes(t ?? []);
      setCulturas(cu ?? []);
    })();
  }, [current?.id]);

  const fazendasCliente = useMemo(
    () => fazendas.filter(f => f.cliente_id === clienteId),
    [fazendas, clienteId],
  );
  const talhoesFazenda = useMemo(
    () => talhoes.filter(t => t.fazenda_id === fazendaId),
    [talhoes, fazendaId],
  );

  const fazendaNome = fazendas.find(f => f.id === fazendaId)?.nome ?? "—";
  const talhaoNome  = talhoes.find(t => t.id === talhaoId)?.nome ?? "—";
  const culturaNome = culturas.find(c => c.id === culturaId)?.nome ?? "—";

  // ── Coleta ───────────────────────────────────────────────────────────────
  const iniciarColeta = async () => {
    if (!clienteId || !fazendaId || !talhaoId) {
      toast.error("Selecione cliente, fazenda e talhão antes de iniciar.");
      return;
    }
    setColetando(true);
    setPontos([]);

    // Leitura inicial de GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGpsAtual({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => toast.warning("GPS indisponível — pontos serão registrados sem coordenadas."),
        { enableHighAccuracy: true, timeout: 6000 },
      );
    }

    // Meteorologia local (open-meteo) — best-effort
    try {
      navigator.geolocation?.getCurrentPosition(async pos => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation`;
        try {
          const r = await fetch(url);
          const j = await r.json();
          setMeteo({
            temperatura: j?.current?.temperature_2m ?? null,
            umidade:     j?.current?.relative_humidity_2m ?? null,
            vento:       j?.current?.wind_speed_10m ?? null,
            precipitacao:j?.current?.precipitation ?? null,
            obtido_em:   new Date().toISOString(),
          });
        } catch { /* offline */ }
      });
    } catch { /* navigator.geolocation indisponível */ }

    toast.success("Coleta iniciada — registre os pontos");
  };

  const pararColeta = () => {
    setColetando(false);
    toast.info("Coleta pausada — clique em salvar para persistir os pontos");
  };

  // Adiciona um ponto na posição atual do GPS
  const marcarPonto = () => {
    if (!coletando) return;
    const totalAnteriores = pontos.length;
    const amostraAtual = Math.floor(totalAnteriores / subsPorAmostra) + 1;
    const subAtual     = (totalAnteriores % subsPorAmostra) + 1;
    const talhaoIdx    = (talhoesFazenda.findIndex(t => t.id === talhaoId) + 1) || 1;

    const lat = gpsAtual?.lat ?? null;
    const lng = gpsAtual?.lng ?? null;
    const acc = gpsAtual?.acc ?? null;

    const nome  = `Subamostra ${subAtual} da Amostra Composta ${amostraAtual}, Talhão ${talhaoIdx}, Fazenda ${fazendaNome}, ${new Date().toLocaleString("pt-BR")}, ${culturaNome}`;
    const abrev = `SA${subAtual}.${amostraAtual}.${talhaoIdx} ${fazendaNome}`;

    setPontos(p => [
      ...p,
      {
        id: crypto.randomUUID(),
        sub: subAtual,
        amostra: amostraAtual,
        talhao_idx: talhaoIdx,
        lat, lng, acuracia: acc,
        registrado_em: new Date().toISOString(),
        nome, abrev,
      },
    ]);

    // Refresca o GPS para a próxima marcação
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGpsAtual({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => {/* mantém último */},
        { enableHighAccuracy: true, timeout: 6000 },
      );
    }
  };

  const removerPonto = (id: string) => setPontos(p => p.filter(x => x.id !== id));

  const salvarColeta = async () => {
    if (!current || pontos.length === 0) return;
    const payload = pontos.map(p => ({
      organization_id: current.id,
      client_id:       clienteId,
      farm_id:         fazendaId,
      field_id:        talhaoId,
      cultura_id:      culturaId || null,
      sub:             p.sub,
      amostra:         p.amostra,
      latitude:        p.lat,
      longitude:       p.lng,
      acuracia:        p.acuracia,
      registrado_em:   p.registrado_em,
      nome_curto:      p.abrev,
      nome_completo:   p.nome,
      meteorologia:    meteo,
      created_by:      user?.id,
    }));

    const { error } = await (supabase as any).from("collection_points").insert(payload);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`${pontos.length} pontos salvos com sucesso`);
    setPontos([]);
    setColetando(false);
  };

  const amostrasCompletas = Math.floor(pontos.length / subsPorAmostra);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><MapPin className="w-6 h-6 text-primary" /> Coletar Amostras</span>}
        description="Coleta georreferenciada com GPS, meteorologia em tempo real e nomenclatura automática"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/mapas"><MapIcon className="w-4 h-4 mr-1.5" />Ver no mapa</Link>
          </Button>
        }
      />

      <div className="p-3 md:p-6 space-y-4 max-w-6xl">
        {/* ── Setup ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Setup da coleta</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={v => { setClienteId(v); setFazendaId(""); setTalhaoId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fazenda</Label>
              <Select value={fazendaId} onValueChange={v => { setFazendaId(v); setTalhaoId(""); }} disabled={!clienteId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {fazendasCliente.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Talhão</Label>
              <Select value={talhaoId} onValueChange={setTalhaoId} disabled={!fazendaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {talhoesFazenda.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cultura</Label>
              <Select value={culturaId} onValueChange={setCulturaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {culturas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subamostras por amostra composta</Label>
              <Input type="number" min={3} max={30} value={subsPorAmostra} onChange={e => setSubsPorAmostra(parseInt(e.target.value) || 8)} />
              <p className="text-xs text-muted-foreground mt-1">Padrão: 8 subamostras → 1 amostra composta.</p>
            </div>
          </CardContent>
        </Card>

        {/* ── GPS & Meteorologia ─────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crosshair className="w-4 h-4" />GPS atual</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {gpsAtual ? (
                <>
                  <Row label="Latitude" value={gpsAtual.lat.toFixed(6)} />
                  <Row label="Longitude" value={gpsAtual.lng.toFixed(6)} />
                  <Row label="Acurácia" value={`±${gpsAtual.acc.toFixed(1)} m`} />
                </>
              ) : (
                <span className="text-muted-foreground">Aguardando primeira leitura…</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cloud className="w-4 h-4" />Meteorologia local</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <MeteoTile icon={<Thermometer className="w-3.5 h-3.5" />} label="Temp." value={meteo.temperatura != null ? `${meteo.temperatura.toFixed(1)}°C` : "—"} />
              <MeteoTile icon={<Droplets className="w-3.5 h-3.5" />} label="Umidade" value={meteo.umidade != null ? `${meteo.umidade}%` : "—"} />
              <MeteoTile icon={<Wind className="w-3.5 h-3.5" />} label="Vento" value={meteo.vento != null ? `${meteo.vento.toFixed(1)} km/h` : "—"} />
              <MeteoTile icon={<Cloud className="w-3.5 h-3.5" />} label="Precip." value={meteo.precipitacao != null ? `${meteo.precipitacao} mm` : "—"} />
            </CardContent>
          </Card>
        </div>

        {/* ── Controles ──────────────────────────────────────────────────── */}
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="py-4 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
            <div className="text-sm">
              <div className="font-bold">
                {coletando ? <span className="text-emerald-700">Coleta em andamento</span> : "Coleta parada"}
              </div>
              <div className="text-xs text-muted-foreground">
                {pontos.length} pontos • {amostrasCompletas} amostras compostas completas
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!coletando ? (
                <Button onClick={iniciarColeta} className="bg-gradient-primary">
                  <Play className="w-4 h-4 mr-1.5" />Iniciar Coleta
                </Button>
              ) : (
                <>
                  <Button onClick={marcarPonto} variant="default" size="lg">
                    <Plus className="w-4 h-4 mr-1.5" />Marcar Subamostra
                  </Button>
                  <Button onClick={pararColeta} variant="outline">
                    <StopCircle className="w-4 h-4 mr-1.5" />Pausar
                  </Button>
                </>
              )}
              {pontos.length > 0 && (
                <Button onClick={salvarColeta} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="w-4 h-4 mr-1.5" />Salvar ({pontos.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Pontos ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Pontos coletados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="lista" className="w-full">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="lista">Lista</TabsTrigger>
                <TabsTrigger value="abrev">Abreviações</TabsTrigger>
              </TabsList>
              <TabsContent value="lista" className="m-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Coordenadas</TableHead>
                      <TableHead>Registrado em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pontos.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum ponto registrado.</TableCell></TableRow>
                    ) : (
                      pontos.map((p, i) => (
                        <TableRow key={p.id}>
                          <TableCell className="w-12">{i + 1}</TableCell>
                          <TableCell><Badge variant="secondary">{p.abrev}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.lat != null ? `${p.lat.toFixed(5)}, ${p.lng?.toFixed(5)}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{new Date(p.registrado_em).toLocaleTimeString("pt-BR")}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removerPonto(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="abrev" className="p-4 space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">Padrão de nomenclatura: <code>SA{`{sub}`}.{`{amostra}`}.{`{talhão}`} {`{Fazenda}`}</code></p>
                {pontos.map(p => (
                  <div key={p.id} className="flex items-baseline gap-3 border-b last:border-0 pb-1">
                    <Badge className="font-mono">{p.abrev}</Badge>
                    <span className="text-xs text-muted-foreground flex-1">{p.nome}</span>
                  </div>
                ))}
                {pontos.length === 0 && <p className="text-muted-foreground italic text-xs">Inicie a coleta para ver as abreviações geradas.</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {amostrasCompletas > 0 && (
          <Card className="border-emerald-300 bg-emerald-50/60">
            <CardContent className="py-3 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span><b>{amostrasCompletas}</b> amostra(s) composta(s) prontas para serem enviadas ao laboratório.</span>
              <Button asChild size="sm" variant="link" className="ml-auto">
                <Link to="/app/nutrir/orcamento"><FlaskConical className="w-3.5 h-3.5 mr-1" />Gerar orçamento</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>
);

const MeteoTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2 bg-card border rounded px-2 py-1.5">
    {icon}
    <div className="flex-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  </div>
);
