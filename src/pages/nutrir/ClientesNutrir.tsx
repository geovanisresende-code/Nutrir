import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, MapPin, Building2 } from "lucide-react";
import { CrudList } from "@/components/nutrir/CrudList";
import { FormDialog, Field } from "@/components/nutrir/FormDialog";
import { useOrgTable } from "@/lib/nutrir/useNutrirData";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

type Categoria = "produtor_rural" | "grupo" | "revenda" | "b2b" | "cooperativa";
const CATEGORIAS: { v: Categoria; l: string }[] = [
  { v: "produtor_rural", l: "Produtor Rural" },
  { v: "grupo", l: "Grupo" },
  { v: "revenda", l: "Revenda" },
  { v: "b2b", l: "B2B" },
  { v: "cooperativa", l: "Cooperativa" },
];
const labelCat = (c: Categoria) => CATEGORIAS.find(x => x.v === c)?.l ?? c;

interface ClienteN {
  id: string; categoria: Categoria;
  razao_social: string; nome_fantasia: string | null;
  cnpj: string | null; cpf: string | null;
  cidade: string | null; uf: string | null;
  telefone: string | null; email: string | null;
  regional_id: string | null; representante_id: string | null;
  ativo: boolean;
}
interface Propriedade {
  id?: string; nome_fazenda: string; inscricao_estadual: string | null;
  endereco: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null;
  latitude: number | null; longitude: number | null;
  contato_nome: string | null; contato_telefone: string | null; contato_email: string | null;
  observacoes: string | null; ordem: number;
}

const emptyProp = (ordem: number): Propriedade => ({
  nome_fazenda: "", inscricao_estadual: null, endereco: null, numero: null, complemento: null,
  bairro: null, cidade: null, uf: null, cep: null, latitude: null, longitude: null,
  contato_nome: null, contato_telefone: null, contato_email: null, observacoes: null, ordem,
});

const formatCNPJ = (v: string) => v.replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const formatCPF = (v: string) => v.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function ClientesNutrir() {
  const { current } = useOrg();
  const { data, loading, reload } = useOrgTable<ClienteN>("nutrir_clientes", { orderBy: "razao_social" });
  const { data: regionais } = useOrgTable<{ id: string; nome: string }>("nutrir_regionais", { orderBy: "nome", select: "id,nome" });
  const { data: reps } = useOrgTable<{ id: string; nome: string }>("nutrir_representantes", { orderBy: "nome", select: "id,nome" });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<ClienteN> | null>(null);
  const [props, setProps] = useState<Propriedade[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"todos" | Categoria>("todos");

  const isPF = edit?.categoria === "produtor_rural";
  const isGrupo = edit?.categoria === "grupo";
  const showProps = isPF || isGrupo;

  // carrega propriedades existentes ao editar
  useEffect(() => {
    (async () => {
      if (edit?.id) {
        const { data: pr } = await (supabase as any).from("nutrir_cliente_propriedades")
          .select("*").eq("cliente_id", edit.id).order("ordem");
        setProps((pr ?? []) as Propriedade[]);
      } else {
        setProps([]);
      }
    })();
  }, [edit?.id]);

  const onNew = () => { setEdit({ ativo: true, categoria: "produtor_rural" }); setProps([emptyProp(0)]); setOpen(true); };
  const onEdit = (r: ClienteN) => { setEdit(r); setOpen(true); };

  const setProp = (i: number, patch: Partial<Propriedade>) =>
    setProps(ps => ps.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const addProp = () => setProps(ps => [...ps, emptyProp(ps.length)]);
  const removeProp = (i: number) => setProps(ps => ps.filter((_, idx) => idx !== i));

  const captureGeo = (i: number) => {
    if (!navigator.geolocation) { toast({ title: "GPS indisponível", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setProp(i, { latitude: p.coords.latitude, longitude: p.coords.longitude }); toast({ title: "Localização capturada" }); },
      () => toast({ title: "Não foi possível obter localização", variant: "destructive" }),
    );
  };

  const onSave = async () => {
    if (!current || !edit?.razao_social?.trim()) {
      toast({ title: isPF ? "Nome obrigatório" : "Razão social obrigatória", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload: any = {
      organization_id: current.id,
      categoria: edit.categoria || "produtor_rural",
      razao_social: edit.razao_social,
      nome_fantasia: edit.nome_fantasia || null,
      cnpj: isPF ? null : (edit.cnpj || null),
      cpf: isPF || isGrupo ? (edit.cpf || null) : null,
      email: edit.email || null,
      telefone: edit.telefone || null,
      cidade: edit.cidade || null,
      uf: edit.uf || null,
      regional_id: edit.regional_id || null,
      representante_id: edit.representante_id || null,
      ativo: edit.ativo ?? true,
    };

    let clienteId = edit.id as string | undefined;
    if (clienteId) {
      const { error } = await (supabase as any).from("nutrir_clientes").update(payload).eq("id", clienteId);
      if (error) { setSaving(false); toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data: ins, error } = await (supabase as any).from("nutrir_clientes").insert(payload).select("id").single();
      if (error || !ins) { setSaving(false); toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }
      clienteId = ins.id;
    }

    if (showProps && clienteId) {
      // estratégia simples: apaga e recria as propriedades
      await (supabase as any).from("nutrir_cliente_propriedades").delete().eq("cliente_id", clienteId);
      const valid = props.filter(p => p.nome_fazenda.trim());
      if (valid.length > 0) {
        const rows = valid.map((p, idx) => ({
          ...p, ordem: idx, organization_id: current.id, cliente_id: clienteId,
        }));
        const { error } = await (supabase as any).from("nutrir_cliente_propriedades").insert(rows);
        if (error) { setSaving(false); toast({ title: "Erro nas propriedades", description: error.message, variant: "destructive" }); return; }
      }
    }

    setSaving(false);
    toast({ title: edit.id ? "Cliente atualizado" : "Cliente cadastrado" });
    setOpen(false); setEdit(null); reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    await (supabase as any).from("nutrir_clientes").delete().eq("id", id); reload();
  };

  const filtered = (data ?? []).filter(c => tab === "todos" || c.categoria === tab);
  const countCat = (c: Categoria) => (data ?? []).filter(x => x.categoria === c).length;

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todos">Todos ({data?.length ?? 0})</TabsTrigger>
          {CATEGORIAS.map(c => (
            <TabsTrigger key={c.v} value={c.v}>{c.l} ({countCat(c.v)})</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <CrudList
            title="Clientes" description="Banco de dados de clientes do programa"
            data={filtered} loading={loading}
            searchKeys={["razao_social", "nome_fantasia", "cnpj", "cpf", "cidade"]}
            headers={["Categoria", "Nome / Razão social", "CNPJ/CPF", "Cidade/UF", "Regional", "Representante", "Status", "Ações"]}
            onNew={onNew}
            renderRow={(r) => (<>
              <td className="px-4 py-2"><Badge variant="outline">{labelCat(r.categoria)}</Badge></td>
              <td className="px-4 py-2 font-medium">
                {r.razao_social}
                {r.nome_fantasia && <span className="text-muted-foreground text-xs block">{r.nome_fantasia}</span>}
              </td>
              <td className="px-4 py-2">{r.cnpj || r.cpf || "—"}</td>
              <td className="px-4 py-2">{[r.cidade, r.uf].filter(Boolean).join("/") || "—"}</td>
              <td className="px-4 py-2">{regionais.find(x => x.id === r.regional_id)?.nome ?? "—"}</td>
              <td className="px-4 py-2">{reps.find(x => x.id === r.representante_id)?.nome ?? "—"}</td>
              <td className="px-4 py-2">{r.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
              <td className="px-4 py-2">
                <Button variant="ghost" size="icon" onClick={() => onEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </td>
            </>)}
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={open} onOpenChange={setOpen}
        title={edit?.id ? "Editar cliente" : "Novo cliente"}
        onSave={onSave} saving={saving} maxW="max-w-4xl"
      >
        <Field label="Categoria *">
          <Select value={edit?.categoria ?? "produtor_rural"} onValueChange={(v) => setEdit({ ...edit, categoria: v as Categoria })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label={isPF ? "Nome *" : "Razão social *"}>
            <Input value={edit?.razao_social ?? ""} onChange={e => setEdit({ ...edit, razao_social: e.target.value })} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={edit?.nome_fantasia ?? ""} onChange={e => setEdit({ ...edit, nome_fantasia: e.target.value })} />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {(isPF || isGrupo) && (
            <Field label="CPF">
              <Input value={edit?.cpf ?? ""} onChange={e => setEdit({ ...edit, cpf: formatCPF(e.target.value) })} placeholder="xxx.xxx.xxx-xx" />
            </Field>
          )}
          {!isPF && (
            <Field label="CNPJ">
              <Input value={edit?.cnpj ?? ""} onChange={e => setEdit({ ...edit, cnpj: formatCNPJ(e.target.value) })} placeholder="xx.xxx.xxx/xxxx-xx" />
            </Field>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Telefone"><Input value={edit?.telefone ?? ""} onChange={e => setEdit({ ...edit, telefone: e.target.value })} placeholder="(xx) xxxxx-xxxx" /></Field>
          <Field label="E-mail"><Input type="email" value={edit?.email ?? ""} onChange={e => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="Status">
            <div className="flex items-center gap-2 h-9">
              <Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })} />
              <span className="text-sm">{edit?.ativo ? "Ativo" : "Inativo"}</span>
            </div>
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Regional">
            <Select value={edit?.regional_id ?? "none"} onValueChange={v => setEdit({ ...edit, regional_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhuma —</SelectItem>
                {regionais.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Representante">
            <Select value={edit?.representante_id ?? "none"} onValueChange={v => setEdit({ ...edit, representante_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {showProps && (
          <Card className="mt-2">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Propriedades / Fazendas ({props.length})</Label>
                <Button type="button" size="sm" variant="outline" onClick={addProp}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
              </div>

              {props.map((p, i) => (
                <Card key={i} className="bg-muted/30">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Propriedade {i + 1}</Badge>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeProp(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-2">
                      <Field label="Nome da fazenda *"><Input value={p.nome_fazenda} onChange={e => setProp(i, { nome_fazenda: e.target.value })} /></Field>
                      <Field label="Inscrição estadual"><Input value={p.inscricao_estadual ?? ""} onChange={e => setProp(i, { inscricao_estadual: e.target.value })} /></Field>
                    </div>

                    <div className="grid md:grid-cols-4 gap-2">
                      <div className="md:col-span-2"><Field label="Endereço (Rua/Av.)"><Input value={p.endereco ?? ""} onChange={e => setProp(i, { endereco: e.target.value })} /></Field></div>
                      <Field label="Nº"><Input value={p.numero ?? ""} onChange={e => setProp(i, { numero: e.target.value })} /></Field>
                      <Field label="Complemento"><Input value={p.complemento ?? ""} onChange={e => setProp(i, { complemento: e.target.value })} /></Field>
                    </div>

                    <div className="grid md:grid-cols-4 gap-2">
                      <Field label="Bairro"><Input value={p.bairro ?? ""} onChange={e => setProp(i, { bairro: e.target.value })} /></Field>
                      <Field label="CEP"><Input value={p.cep ?? ""} onChange={e => setProp(i, { cep: e.target.value })} /></Field>
                      <Field label="Cidade"><Input value={p.cidade ?? ""} onChange={e => setProp(i, { cidade: e.target.value })} /></Field>
                      <Field label="UF"><Input maxLength={2} value={p.uf ?? ""} onChange={e => setProp(i, { uf: e.target.value.toUpperCase() })} /></Field>
                    </div>

                    <div className="grid md:grid-cols-3 gap-2">
                      <Field label="Contato (nome)"><Input value={p.contato_nome ?? ""} onChange={e => setProp(i, { contato_nome: e.target.value })} /></Field>
                      <Field label="Telefone"><Input value={p.contato_telefone ?? ""} onChange={e => setProp(i, { contato_telefone: e.target.value })} placeholder="(xx) xxxxx-xxxx" /></Field>
                      <Field label="E-mail"><Input type="email" value={p.contato_email ?? ""} onChange={e => setProp(i, { contato_email: e.target.value })} /></Field>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="outline" size="sm" onClick={() => captureGeo(i)}>
                        <MapPin className="w-4 h-4 mr-1" />Capturar GPS
                      </Button>
                      {p.latitude && p.longitude && (
                        <span className="text-xs text-muted-foreground">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</span>
                      )}
                      <Button type="button" variant="link" size="sm" asChild>
                        <a href={`https://www.google.com/maps?q=${p.latitude ?? ""},${p.longitude ?? ""}`} target="_blank" rel="noreferrer"
                          className={p.latitude ? "" : "pointer-events-none opacity-40"}>Abrir no Google Maps</a>
                      </Button>
                    </div>

                    <Field label="Observações">
                      <Textarea rows={2} value={p.observacoes ?? ""} onChange={e => setProp(i, { observacoes: e.target.value })} />
                    </Field>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}
      </FormDialog>
    </>
  );
}
