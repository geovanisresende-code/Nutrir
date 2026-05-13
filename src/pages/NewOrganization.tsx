import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface Plan { id: string; tier: "free"|"pro"|"enterprise"; name: string; max_users: number; max_hectares: number; price_cents: number; }

const NewOrganization = () => {
  const { user } = useAuth();
  const { refresh, switchOrg } = useOrg();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"free"|"pro"|"enterprise">("free");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("plans").select("*").order("price_cents").then(({ data }) => setPlans((data ?? []) as Plan[]));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2,6);
    const { data, error } = await supabase.from("organizations")
      .insert({ name, slug, plan_tier: tier, owner_id: user.id })
      .select().single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Organização criada!");
    await refresh();
    if (data) switchOrg(data.id);
    nav("/app");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-2xl shadow-elegant">
        <CardHeader>
          <CardTitle>Crie sua organização</CardTitle>
          <CardDescription>Cada organização é um workspace isolado com seus próprios dados, equipe e plano.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="orgname">Nome da organização</Label>
              <Input id="orgname" value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: AgroConsult Norte" required />
            </div>

            <div className="space-y-2">
              <Label>Plano inicial</Label>
              <RadioGroup value={tier} onValueChange={(v)=>setTier(v as any)} className="grid md:grid-cols-3 gap-3">
                {plans.map(p => (
                  <label key={p.id} className={`border rounded-lg p-4 cursor-pointer transition-colors ${tier===p.tier ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
                    <RadioGroupItem value={p.tier} className="sr-only" />
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-2xl font-bold mt-1">
                      {p.price_cents === 0 ? "Grátis" : `R$ ${(p.price_cents/100).toFixed(0)}`}
                      {p.price_cents > 0 && <span className="text-xs text-muted-foreground font-normal">/mês</span>}
                    </div>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li>{p.max_users} usuários</li>
                      <li>{p.max_hectares.toLocaleString()} ha</li>
                    </ul>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
              {loading ? "Criando…" : "Criar organização"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewOrganization;
