import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Organizacao = () => {
  const { current, refresh } = useOrg();
  const [name, setName] = useState(current?.name ?? "");
  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState({ ai: 0, ndvi: 0, members: 0, hectares: 0 });

  useEffect(() => { setName(current?.name ?? ""); }, [current]);
  useEffect(() => {
    supabase.from("plans").select("*").then(({data}) => setPlans(data ?? []));
  }, []);

  useEffect(() => {
    if (!current) return;
    (async () => {
      const since = new Date(); since.setDate(1);
      const [ai, n, m, f] = await Promise.all([
        supabase.from("usage_metrics").select("id",{count:"exact",head:true}).eq("organization_id",current.id).eq("metric","ai_call").gte("occurred_at", since.toISOString()),
        supabase.from("usage_metrics").select("id",{count:"exact",head:true}).eq("organization_id",current.id).eq("metric","ndvi_call").gte("occurred_at", since.toISOString()),
        supabase.from("organization_members").select("id",{count:"exact",head:true}).eq("organization_id",current.id),
        supabase.from("fields").select("hectares").eq("organization_id",current.id),
      ]);
      const ha = (f.data ?? []).reduce((a:number,r:any)=>a+Number(r.hectares ?? 0),0);
      setUsage({ ai: ai.count ?? 0, ndvi: n.count ?? 0, members: m.count ?? 0, hectares: Math.round(ha) });
    })();
  }, [current]);

  const save = async () => {
    if (!current) return;
    const { error } = await supabase.from("organizations").update({ name }).eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo"); refresh();
  };

  const currentPlan = plans.find(p => p.tier === current?.plan_tier);

  return (
    <>
      <PageHeader title="Organização" description="Configurações e plano"/>
      <div className="p-6 max-w-3xl space-y-6">
        <Card><CardContent className="p-5 space-y-3">
          <h3 className="font-semibold">Identidade</h3>
          <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e=>setName(e.target.value)}/></div>
          <Button onClick={save} className="bg-gradient-primary">Salvar</Button>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Plano atual</h3>
              <p className="text-sm text-muted-foreground">Use deste mês</p>
            </div>
            <Badge className="text-base px-3 py-1">{currentPlan?.name ?? current?.plan_tier}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Meter label="Membros" used={usage.members} max={currentPlan?.max_users}/>
            <Meter label="Hectares" used={usage.hectares} max={currentPlan?.max_hectares}/>
            <Meter label="Chamadas IA" used={usage.ai} max={currentPlan?.max_ai_calls_month}/>
            <Meter label="Chamadas NDVI" used={usage.ndvi} max={currentPlan?.max_ndvi_calls_month}/>
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5">
          <h3 className="font-semibold mb-3">Comparar planos</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {plans.map(p => (
              <div key={p.id} className={`border rounded-lg p-4 ${current?.plan_tier===p.tier ? "border-primary bg-primary/5" : ""}`}>
                <div className="font-semibold">{p.name}</div>
                <div className="text-2xl font-bold mt-1">{p.price_cents===0 ? "Grátis" : `R$ ${(p.price_cents/100).toFixed(0)}/mês`}</div>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>{p.max_users} usuários</li>
                  <li>{Number(p.max_hectares).toLocaleString()} ha</li>
                  <li>{p.max_ai_calls_month} chamadas IA/mês</li>
                  <li>{p.max_ndvi_calls_month} NDVI/mês</li>
                </ul>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    </>
  );
};

const Meter = ({ label, used, max }: any) => {
  const pct = max ? Math.min(100, (used/max)*100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium">{used}/{max ?? "∞"}</span></div>
      <div className="h-1.5 rounded bg-muted mt-1 overflow-hidden"><div className="h-full bg-gradient-primary" style={{width: `${pct}%`}}/></div>
    </div>
  );
};

export default Organizacao;
