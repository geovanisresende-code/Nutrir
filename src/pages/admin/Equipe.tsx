import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useLimits } from "@/hooks/useLimits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, UserPlus, Trash2, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const Equipe = () => {
  const { current } = useOrg();
  const { user } = useAuth();
  const { log } = useAuditLog();
  const { canAddMember, plan, usage } = useLimits();
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin"|"member"|"viewer">("member");
  const [myRole, setMyRole] = useState<string>("");

  const load = async () => {
    if (!current || !user) return;
    const { data: m } = await supabase
      .from("organization_members")
      .select("id, role, user_id, created_at, profiles(email, full_name, avatar_url)")
      .eq("organization_id", current.id);
    setMembers(m ?? []);
    const me = m?.find(x => x.user_id === user.id);
    setMyRole(me?.role ?? "");

    const { data: i } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", current.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setInvites(i ?? []);
  };
  useEffect(() => { load(); }, [current, user]);

  const canAdmin = myRole === "owner" || myRole === "admin";

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !user) return;
    if (!canAddMember()) {
      toast.error(`Limite de ${plan?.max_users} usuários atingido. Faça upgrade do plano.`);
      return;
    }
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: current.id, email, role, invited_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    log({ action: "member.invite", entity_type: "member", description: `Convite para ${email} (${role})`, metadata: { email, role } });
    toast.success("Convite criado. Compartilhe o link.");
    setEmail(""); setOpen(false); load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const revoke = async (id: string) => {
    await supabase.from("organization_invites").update({ status: "revoked" }).eq("id", id);
    log({ action: "member.invite", entity_type: "member", entity_id: id, description: "Convite revogado" });
    toast.success("Convite revogado"); load();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remover membro?")) return;
    await supabase.from("organization_members").delete().eq("id", id);
    log({ action: "member.remove", entity_type: "member", entity_id: id, description: "Membro removido" });
    load();
  };

  return (
    <>
      <PageHeader title="Equipe" description="Membros e convites desta organização"
        actions={canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-primary"><UserPlus className="h-4 w-4 mr-1"/>Convidar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Convidar para {current?.name}</DialogTitle></DialogHeader>
              <form onSubmit={invite} className="space-y-3">
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
                <div className="space-y-1.5"><Label>Papel</Label>
                  <Select value={role} onValueChange={v=>setRole(v as any)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" className="bg-gradient-primary">Criar convite</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}/>

      <div className="p-6 space-y-6">
        <section>
          <h3 className="font-semibold mb-3">Membros ({members.length})</h3>
          <div className="space-y-2">
            {members.map(m => (
              <Card key={m.id}><CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold">
                  {(m.profiles?.full_name ?? m.profiles?.email ?? "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.profiles?.full_name ?? m.profiles?.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.profiles?.email}</div>
                </div>
                <Badge variant={m.role==="owner" ? "default" : "secondary"}>{m.role}</Badge>
                {canAdmin && m.role !== "owner" && m.user_id !== user?.id && (
                  <Button size="icon" variant="ghost" onClick={()=>removeMember(m.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                )}
              </CardContent></Card>
            ))}
          </div>
        </section>

        {canAdmin && (
          <section>
            <h3 className="font-semibold mb-3">Convites pendentes ({invites.length})</h3>
            {invites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>}
            <div className="space-y-2">
              {invites.map(i => (
                <Card key={i.id}><CardContent className="p-4 flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground"/>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{i.email}</div>
                    <div className="text-xs text-muted-foreground">expira {new Date(i.expires_at).toLocaleDateString()}</div>
                  </div>
                  <Badge variant="secondary">{i.role}</Badge>
                  <Button size="sm" variant="outline" onClick={()=>copyLink(i.token)}><Copy className="h-3 w-3 mr-1"/>Copiar link</Button>
                  <Button size="icon" variant="ghost" onClick={()=>revoke(i.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </CardContent></Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
};
export default Equipe;
