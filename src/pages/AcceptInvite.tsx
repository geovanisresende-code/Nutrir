import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AcceptInvite = () => {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { refresh, switchOrg } = useOrg();
  const nav = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.from("organization_invites").select("*, organizations(name)").eq("token", token).maybeSingle().then(({data}) => {
      setInvite(data); setLoading(false);
    });
  }, [token]);

  const accept = async () => {
    if (!user || !invite) return;
    setAccepting(true);
    const { error } = await supabase.from("organization_members").insert({
      organization_id: invite.organization_id, user_id: user.id, role: invite.role,
    });
    if (!error) await supabase.from("organization_invites").update({ status: "accepted" }).eq("id", invite.id);
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Convite aceito!");
    await refresh(); switchOrg(invite.organization_id);
    nav("/app");
  };

  if (loading || authLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!invite || invite.status !== "pending") return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-md"><CardContent className="p-6 text-center">Convite inválido ou expirado.</CardContent></Card>
    </div>
  );

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="max-w-md w-full shadow-elegant">
        <CardHeader>
          <CardTitle>Você foi convidado</CardTitle>
          <CardDescription>Para entrar em <strong>{invite.organizations?.name}</strong> como <strong>{invite.role}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <Button onClick={()=>nav(`/auth?next=/invite/${token}`)} className="w-full bg-gradient-primary">Entrar para aceitar</Button>
          ) : (
            <Button onClick={accept} disabled={accepting} className="w-full bg-gradient-primary">
              {accepting ? "Aceitando…" : "Aceitar convite"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default AcceptInvite;
