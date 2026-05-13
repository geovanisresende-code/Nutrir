import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Camera, Trash2, Send, FileText } from "lucide-react";

const CATEGORIAS = [
  { v: "combustivel", l: "Combustível" },
  { v: "alimentacao", l: "Alimentação" },
  { v: "hospedagem", l: "Hospedagem" },
  { v: "pedagio", l: "Pedágio" },
  { v: "manutencao", l: "Manutenção" },
  { v: "estacionamento", l: "Estacionamento" },
  { v: "outros", l: "Outros" },
] as const;

const COMBUSTIVEIS = [
  { v: "gasolina", l: "Gasolina" },
  { v: "alcool", l: "Álcool" },
  { v: "diesel", l: "Diesel" },
] as const;

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary", enviado: "outline", aprovado: "default", rejeitado: "destructive", pago: "default",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Number((s || "").toString().replace(",", ".")) || 0;

// Input com prefixo/sufixo fixo (ex.: R$, L). Mantém o símbolo visível e nunca exibe "0" inicial.
function Affixed({
  prefix, suffix, value, onChange, disabled, required, readOnly,
}: {
  prefix?: string; suffix?: string;
  value: string; onChange?: (v: string) => void;
  disabled?: boolean; required?: boolean; readOnly?: boolean;
}) {
  return (
    <div className={`flex items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring ${disabled || readOnly ? "opacity-70" : ""}`}>
      {prefix && <span className="px-2.5 flex items-center text-sm text-muted-foreground bg-muted/40 border-r border-input select-none">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        className="flex-1 px-3 py-2 text-sm bg-transparent outline-none disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => {
          if (readOnly || !onChange) return;
          // aceita apenas dígitos, vírgula e ponto; remove zeros à esquerda
          let v = e.target.value.replace(/[^\d.,]/g, "");
          v = v.replace(/^0+(?=\d)/, "");
          onChange(v);
        }}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        placeholder=""
      />
      {suffix && <span className="px-2.5 flex items-center text-sm text-muted-foreground bg-muted/40 border-l border-input select-none">{suffix}</span>}
    </div>
  );
}

export default function RDV() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // form
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState<string>("combustivel");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  // combustível
  const [combTipo, setCombTipo] = useState<string>("gasolina");
  const [litros, setLitros] = useState("");
  const [precoLitro, setPrecoLitro] = useState("");
  const [kmIni, setKmIni] = useState("");
  const [kmFim, setKmFim] = useState("");
  const [primeiroAbastecimento, setPrimeiroAbastecimento] = useState(false);
  // hospedagem
  const [hotelNome, setHotelNome] = useState("");
  const [cupom, setCupom] = useState<File | null>(null);

  const load = async () => {
    if (!current || !user) return;
    const { data: rows } = await supabase
      .from("nutrir_rdv" as any)
      .select("*")
      .eq("organization_id", current.id)
      .order("data", { ascending: false })
      .limit(200);
    setItems((rows as any[]) ?? []);
  };
  useEffect(() => { load(); }, [current?.id, user?.id]);

  // último km final do usuário (combustível) — para autopreencher km inicial
  const ultimoKmFinal = useMemo(() => {
    const meus = items
      .filter((i) => i.user_id === user?.id && i.categoria === "combustivel" && i.km_final != null)
      .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return meus[0]?.km_final ?? null;
  }, [items, user]);

  const temAbastecimentoAnterior = ultimoKmFinal != null;

  // ao abrir / mudar categoria, autopreencher km inicial
  useEffect(() => {
    if (categoria === "combustivel" && temAbastecimentoAnterior && !primeiroAbastecimento) {
      setKmIni(String(ultimoKmFinal));
    }
  }, [categoria, temAbastecimentoAnterior, ultimoKmFinal, primeiroAbastecimento]);

  // valor automático = litros * preço/litro (combustível) — fixo e inalterável
  useEffect(() => {
    if (categoria === "combustivel") {
      const v = num(litros) * num(precoLitro);
      setValor(v > 0 ? v.toFixed(2).replace(".", ",") : "");
    }
  }, [litros, precoLitro, categoria]);

  const reset = () => {
    setData(new Date().toISOString().slice(0, 10));
    setCategoria("combustivel"); setValor(""); setDescricao("");
    setCidade(""); setUf("");
    setCombTipo("gasolina"); setLitros(""); setPrecoLitro("");
    setKmIni(""); setKmFim(""); setPrimeiroAbastecimento(false);
    setHotelNome(""); setCupom(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    setLoading(true);
    let cupomPath: string | null = null;
    try {
      if (cupom) {
        const ext = cupom.name.split(".").pop() ?? "jpg";
        cupomPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("rdv-cupons").upload(cupomPath, cupom, { upsert: false });
        if (upErr) throw upErr;
      }
      const payload: any = {
        organization_id: current.id,
        user_id: user.id,
        data,
        categoria,
        descricao: descricao || null,
        valor: num(valor),
        cidade: cidade || null,
        uf: uf || null,
        cupom_path: cupomPath,
        status: "rascunho",
      };
      if (categoria === "combustivel") {
        payload.combustivel_tipo = combTipo;
        payload.litros = num(litros);
        payload.preco_litro = num(precoLitro);
        payload.km_inicial = kmIni ? Number(kmIni) : null;
        payload.km_final = kmFim ? Number(kmFim) : null;
      }
      if (categoria === "hospedagem") {
        payload.hotel_nome = hotelNome || null;
      }
      const { error } = await supabase.from("nutrir_rdv" as any).insert(payload);
      if (error) throw error;
      toast.success("Despesa lançada");
      setOpen(false); reset(); load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const enviar = async (id: string) => {
    const { error } = await supabase.from("nutrir_rdv" as any).update({ status: "enviado" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Enviado para aprovação");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir lançamento?")) return;
    const { error } = await supabase.from("nutrir_rdv" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const verCupom = async (path: string) => {
    const { data, error } = await supabase.storage.from("rdv-cupons").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const meus = useMemo(() => items.filter((i) => i.user_id === user?.id), [items, user]);
  const total = useMemo(() => meus.reduce((a, i) => a + Number(i.valor || 0), 0), [meus]);
  const totalMes = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return meus.filter((i) => (i.data ?? "").startsWith(ym)).reduce((a, i) => a + Number(i.valor || 0), 0);
  }, [meus]);

  return (
    <>
      <PageHeader
        title="RDV — Despesas de Viagem"
        description="Combustível, alimentação, hospedagem e mais"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Lançar despesa</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Cuiabá" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Select value={uf} onValueChange={setUf}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {categoria === "combustivel" && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Combustível</Label>
                        <Select value={combTipo} onValueChange={setCombTipo}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMBUSTIVEIS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Litros</Label><Affixed suffix="L" value={litros} onChange={setLitros} required /></div>
                      <div className="space-y-1.5"><Label>Preço/Litro</Label><Affixed prefix="R$" value={precoLitro} onChange={setPrecoLitro} required /></div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor do abastecimento</Label>
                      <Affixed prefix="R$" value={valor} readOnly required />
                      <p className="text-[11px] text-muted-foreground">Calculado automaticamente (litros × preço) — não editável.</p>
                    </div>
                    {!temAbastecimentoAnterior && (
                      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                        Primeiro abastecimento — informe KM inicial e final.
                      </div>
                    )}
                    {temAbastecimentoAnterior && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={primeiroAbastecimento}
                          onChange={(e) => { setPrimeiroAbastecimento(e.target.checked); if (e.target.checked) setKmIni(""); else setKmIni(String(ultimoKmFinal)); }}
                        />
                        Editar KM inicial manualmente (caso de troca de veículo)
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>KM inicial</Label>
                        <Affixed
                          suffix="km"
                          value={kmIni}
                          onChange={setKmIni}
                          disabled={temAbastecimentoAnterior && !primeiroAbastecimento}
                          required
                        />
                      </div>
                      <div className="space-y-1.5"><Label>KM final</Label><Affixed suffix="km" value={kmFim} onChange={setKmFim} required /></div>
                    </div>
                  </>
                )}

                {categoria === "hospedagem" && (
                  <div className="space-y-1.5">
                    <Label>Nome do hotel</Label>
                    <Input value={hotelNome} onChange={(e) => setHotelNome(e.target.value)} placeholder="Ex.: Hotel Bristol" required />
                  </div>
                )}

                {categoria !== "combustivel" && (
                  <div className="space-y-1.5"><Label>Valor</Label><Affixed prefix="R$" value={valor} onChange={setValor} required /></div>
                )}

                <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Observações…" /></div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Camera className="h-4 w-4" /> Cupom / nota fiscal</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setCupom(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-[11px] text-muted-foreground">No celular abre a câmera automaticamente.</p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading} className="bg-gradient-primary">
                    {loading ? "Salvando…" : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total no mês</div><div className="text-2xl font-bold">{fmt(totalMes)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total lançado</div><div className="text-2xl font-bold">{fmt(total)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lançamentos</div><div className="text-2xl font-bold">{meus.length}</div></CardContent></Card>
        </div>

        <Card><CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma despesa lançada ainda.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs">{i.data}</TableCell>
                    <TableCell className="capitalize">
                      {i.categoria}
                      {i.categoria === "combustivel" && i.combustivel_tipo && (
                        <span className="text-xs text-muted-foreground ml-1">({i.combustivel_tipo})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{[i.cidade, i.uf].filter(Boolean).join("/") || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {i.categoria === "hospedagem" && i.hotel_nome ? i.hotel_nome : (i.descricao ?? "—")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(i.valor))}</TableCell>
                    <TableCell><Badge variant={STATUS_COLORS[i.status]}>{i.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {i.cupom_path && (
                          <Button size="icon" variant="ghost" onClick={() => verCupom(i.cupom_path)} title="Ver cupom">
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {i.user_id === user?.id && i.status === "rascunho" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => enviar(i.id)} title="Enviar">
                              <Send className="h-4 w-4 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remover(i.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>
    </>
  );
}
