import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Trash2, ShieldCheck, Clock, Users, UserPlus, Copy, KeyRound } from "lucide-react";
import { POSITION_LABEL, POSITION_DESC, PERMISSIONS, type Position } from "@/lib/permissions";

type AppRole = "owner" | "admin" | "member" | "viewer";

// Mapeamento Cargo (visível) → AppRole (RLS legado).
// app_role só tem owner/admin/member/viewer — o cargo Gerente fica como 'member'
// e suas permissões extras são controladas pelo RouteGuard via position.
const POS_TO_ROLE: Record<Position, AppRole> = {
  proprietario: "owner",
  diretor: "admin",
  gerente: "admin",         // pode aprovar pedidos via RLS
  representante: "member",
  assistente_tecnico: "member",
  cliente: "viewer",
};

const POSITIONS: Position[] = [
  "proprietario", "diretor", "gerente", "representante", "assistente_tecnico", "cliente",
];

export default function Usuarios() {
  const { current } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!current || !user) return;
    setLoading(true);
    const [{ data: m }, { data: reqs }, { data: pos }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, role, user_id, created_at, profiles(email, full_name, avatar_url)")
        .eq("organization_id", current.id),
      (supabase as any).from("signup_requests").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_positions").select("user_id, position").eq("organization_id", current.id),
    ]);
    setMembers(m ?? []);
    setMyRole(m?.find((x: any) => x.user_id === user.id)?.role ?? "");
    // signup_requests podem ter org_id NULL (auto-cadastro) ou já vinculados
    setPending((reqs ?? []).filter((r: any) =>
      r.status === "pending" && (r.organization_id == null || r.organization_id === current.id)
    ));
    setHistory((reqs ?? []).filter((r: any) => r.status !== "pending").slice(0, 50));
    const pmap: Record<string, Position> = {};
    (pos ?? []).forEach((p: any) => { pmap[p.user_id] = p.position; });
    setPositions(pmap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [current?.id, user?.id]);

  const isOwner = !!current && !!user && current.owner_id === user.id;
  const canAdmin = isOwner || myRole === "owner" || myRole === "admin";

  const approve = async (id: string, position: Position) => {
    const role = POS_TO_ROLE[position];
    const { error } = await (supabase as any).rpc("approve_signup_request", { _request_id: id, _role: role });
    if (error) return toast.error(error.message);
    // pega o user_id da request para gravar position
    const req = pending.find((r) => r.id === id);
    if (req?.user_id) {
      await (supabase as any).from("user_positions").upsert(
        { organization_id: current!.id, user_id: req.user_id, position },
        { onConflict: "organization_id,user_id" }
      );
    }
    toast.success(`Aprovado como ${POSITION_LABEL[position]}`);
    load();
  };

  const reject = async (id: string) => {
    const motivo = prompt("Motivo da rejeição (opcional):") ?? null;
    const { error } = await (supabase as any).rpc("reject_signup_request", { _request_id: id, _notes: motivo });
    if (error) return toast.error(error.message);
    toast.success("Cadastro rejeitado");
    load();
  };

  const changePosition = async (memberId: string, userId: string, newPos: Position) => {
    const newRole = POS_TO_ROLE[newPos];
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("organization_members").update({ role: newRole }).eq("id", memberId),
      (supabase as any).from("user_positions").upsert(
        { organization_id: current!.id, user_id: userId, position: newPos },
        { onConflict: "organization_id,user_id" }
      ),
    ]);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    toast.success(`Cargo atualizado para ${POSITION_LABEL[newPos]}`);
    load();
  };

  const remove = async (memberId: string, name: string) => {
    if (!confirm(`Remover ${name} da organização?`)) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Usuário removido");
    load();
  };

  if (loading && !current) return <><PageHeader title="Usuários" /><div className="p-6 text-sm text-muted-foreground">Carregando…</div></>;

  if (!canAdmin) {
    return (
      <>
        <PageHeader title="Usuários" description="Gestão de usuários da organização" />
        <div className="p-6">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            Apenas administradores ou proprietários podem acessar esta página.
          </CardContent></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Cargos, permissões e aprovação de cadastros"
        actions={<InviteDialog orgId={current!.id} userId={user!.id} onDone={load} />}
      />
      <div className="p-6 space-y-6">
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" /> Pendentes
              {pending.length > 0 && <Badge variant="destructive" className="ml-1">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" /> Membros ({members.length})</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2"><ShieldCheck className="h-4 w-4" /> Permissões</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><ShieldCheck className="h-4 w-4" /> Histórico</TabsTrigger>
          </TabsList>

          {/* Pendentes */}
          <TabsContent value="pending" className="mt-4">
            <Card><CardContent className="p-0">
              {pending.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhum cadastro aguardando aprovação.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead><TableHead>Email</TableHead>
                    <TableHead>Solicitado em</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pending.map((r) => <PendingRow key={r.id} r={r} onApprove={approve} onReject={reject} />)}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Membros */}
          <TabsContent value="members" className="mt-4">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead><TableHead>Desde</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const pos = positions[m.user_id] ?? (m.role === "owner" ? "proprietario" : m.role === "admin" ? "diretor" : m.role === "manager" ? "gerente" : m.role === "viewer" ? "cliente" : "representante");
                    const isSelf = m.user_id === user?.id;
                    const isOwnerRow = m.role === "owner";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.profiles?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.profiles?.email}</TableCell>
                        <TableCell>
                          {isOwnerRow || isSelf ? (
                            <Badge variant={isOwnerRow ? "default" : "secondary"}>{POSITION_LABEL[pos as Position]}</Badge>
                          ) : (
                            <Select value={pos} onValueChange={(v) => changePosition(m.id, m.user_id, v as Position)}>
                              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {POSITIONS.filter(p => p !== "proprietario").map((p) => (
                                  <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {!isOwnerRow && !isSelf && (
                            <Button size="icon" variant="ghost" onClick={() => remove(m.id, m.profiles?.email ?? "usuário")}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* Matriz de Permissões */}
          <TabsContent value="permissions" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Matriz de permissões por cargo</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Áreas com acesso</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {POSITIONS.map((p) => (
                      <TableRow key={p}>
                        <TableCell className="font-medium whitespace-nowrap">{POSITION_LABEL[p]}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md">{POSITION_DESC[p]}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {PERMISSIONS[p].map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px]">{capLabel(c)}</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="history" className="mt-4">
            <Card><CardContent className="p-0">
              {history.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Sem histórico.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Email</TableHead><TableHead>Status</TableHead>
                    <TableHead>Quando</TableHead><TableHead>Observações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.email}</TableCell>
                        <TableCell><Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function capLabel(c: string) {
  switch (c) {
    case "org.manage": return "Administração";
    case "rep.area": return "Representante";
    case "nutrir.area": return "Programa Nutrir";
    case "gerente.area": return "Gerência";
    case "gestao.area": return "Gestão";
    case "operacao.area": return "Financeiro/CRM/Estoque";
    case "viewer.only": return "Visualização";
    default: return c;
  }
}

function PendingRow({ r, onApprove, onReject }: { r: any; onApprove: (id: string, p: Position) => void; onReject: (id: string) => void }) {
  const [pos, setPos] = useState<Position>("representante");
  return (
    <TableRow>
      <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{r.email}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Select value={pos} onValueChange={(v) => setPos(v as Position)}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POSITIONS.filter(p => p !== "proprietario").map((p) => (
                <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => onApprove(r.id, pos)} className="bg-gradient-primary">
            <Check className="h-4 w-4 mr-1" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(r.id)}>
            <X className="h-4 w-4 mr-1" /> Rejeitar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function InviteDialog({ orgId, userId, onDone }: { orgId: string; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pos, setPos] = useState<Position>("representante");
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const role = POS_TO_ROLE[pos];
    const { data, error } = await supabase
      .from("organization_invites")
      .insert({ organization_id: orgId, email, role, invited_by: userId } as any)
      .select("token").single();
    setLoading(false);
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/invite/${data!.token}`;
    setLink(url);
    toast.success("Convite criado. Compartilhe o link com o usuário.");
    onDone();
  };

  const copy = () => { if (link) { navigator.clipboard.writeText(link); toast.success("Link copiado"); } };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEmail(""); setLink(null); } }}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary"><UserPlus className="h-4 w-4 mr-1" /> Adicionar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Envie este link ao usuário. Ele precisa criar uma conta (email + senha) usando o link.
              Após o cadastro, o acesso é vinculado automaticamente à organização com o cargo escolhido.
            </p>
            <div className="flex gap-2">
              <Input value={link} readOnly />
              <Button type="button" variant="outline" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="text-xs text-muted-foreground flex items-start gap-2 bg-muted/50 p-2 rounded">
              <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
              <span>O envio automático por email ainda não está habilitado nesta instalação. Compartilhe o link manualmente (WhatsApp, email pessoal, etc.) até que o domínio de envio seja configurado.</span>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={pos} onValueChange={(v) => setPos(v as Position)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.filter(p => p !== "proprietario").map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex flex-col">
                        <span>{POSITION_LABEL[p]}</span>
                        <span className="text-[10px] text-muted-foreground">{POSITION_DESC[p]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading ? "Criando…" : "Gerar link de convite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
