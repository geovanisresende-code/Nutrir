import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useLimits } from "@/hooks/useLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Check, Sparkles, Zap, Building2, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSearchParams } from "react-router-dom";

interface Plan {
  tier: "free" | "pro" | "enterprise";
  name: string;
  price_cents: number;
  max_hectares: number;
  max_users: number;
  max_ai_calls_month: number;
  max_ndvi_calls_month: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

interface Subscription {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
}

const TIER_ICONS = { free: Sparkles, pro: Zap, enterprise: Building2 };
const TIER_COLORS = {
  free: "from-slate-500 to-slate-600",
  pro: "from-[#d4a843] to-[#b08826]",
  enterprise: "from-violet-500 to-fuchsia-600",
};

const fmtBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n >= 999999 ? "Ilimitado" : n.toLocaleString("pt-BR");

export default function Billing() {
  const { current, refresh: refreshOrg } = useOrg();
  const { usage, plan: currentPlan, refresh: refreshLimits } = useLimits();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    supabase.from("plans").select("*").order("price_cents").then(({ data }) => setPlans((data ?? []) as Plan[]));
  }, []);

  useEffect(() => {
    if (!current) return;
    supabase.from("org_subscriptions").select("*").eq("organization_id", current.id).maybeSingle()
      .then(({ data }) => setSubscription(data as Subscription | null));
  }, [current]);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Pagamento concluído! Seu plano será ativado em instantes.");
      setSearchParams({});
      // Refresh after a short delay to wait for the webhook
      setTimeout(() => { refreshOrg(); refreshLimits(); }, 3000);
    }
  }, [searchParams]);

  const openPortal = async () => {
    if (!current) return;
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { organizationId: current.id, returnUrl: window.location.href, environment: import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN?.startsWith("pk_test_") ? "sandbox" : "live" },
      });
      if (error || !data?.url) throw new Error(error?.message || data?.error || "Erro");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const currentTier = current?.plan_tier ?? "free";
  const sortedPlans = useMemo(() => {
    const order: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };
    return [...plans].sort((a, b) => (order[a.tier] ?? 99) - (order[b.tier] ?? 99));
  }, [plans]);

  return (
    <>
      <PaymentTestModeBanner />
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Planos & Cobrança</h1>
          <p className="text-sm text-muted-foreground">Gerencie a assinatura da sua organização.</p>
        </header>

        {/* Current usage */}
        {currentPlan && usage && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Plano atual: {currentPlan.name}</CardTitle>
                {subscription && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>{subscription.status}</Badge>
                    {subscription.current_period_end && (
                      <span>Renova em {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}</span>
                    )}
                    {subscription.cancel_at_period_end && <Badge variant="destructive">Cancelamento agendado</Badge>}
                  </div>
                )}
              </div>
              {subscription && (
                <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Gerenciar assinatura
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <UsageBar label="Hectares" current={usage.hectares} max={currentPlan.max_hectares} suffix=" ha" />
              <UsageBar label="Usuários" current={usage.members} max={currentPlan.max_users} />
              <UsageBar label="Chamadas IA (mês)" current={usage.ai_calls_month} max={currentPlan.max_ai_calls_month} />
              <UsageBar label="Leituras NDVI (mês)" current={usage.ndvi_calls_month} max={currentPlan.max_ndvi_calls_month} />
            </CardContent>
          </Card>
        )}

        {/* Interval toggle */}
        <div className="flex justify-center">
          <Tabs value={interval} onValueChange={(v) => setInterval(v as any)}>
            <TabsList>
              <TabsTrigger value="month">Mensal</TabsTrigger>
              <TabsTrigger value="year">Anual <Badge variant="secondary" className="ml-2 text-[10px]">-17%</Badge></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {sortedPlans.map(p => {
            const Icon = TIER_ICONS[p.tier];
            const isCurrent = currentTier === p.tier;
            const priceId = interval === "month" ? p.stripe_price_id_monthly : p.stripe_price_id_yearly;
            const monthlyEquiv = interval === "year" ? Math.round(p.price_cents * 10 / 12) : p.price_cents;
            return (
              <Card key={p.tier} className={`relative overflow-hidden ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                <div className={`h-1 bg-gradient-to-r ${TIER_COLORS[p.tier]}`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle>{p.name}</CardTitle>
                    </div>
                    {isCurrent && <Badge>Plano atual</Badge>}
                  </div>
                  <div className="pt-2">
                    {p.tier === "free" ? (
                      <div className="text-3xl font-bold">Grátis</div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          {fmtBRL(interval === "year" ? Math.round(p.price_cents * 10) : p.price_cents)}
                          <span className="text-sm font-normal text-muted-foreground">/{interval === "month" ? "mês" : "ano"}</span>
                        </div>
                        {interval === "year" && (
                          <div className="text-xs text-muted-foreground">Equivalente a {fmtBRL(monthlyEquiv)}/mês</div>
                        )}
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2 text-sm">
                    <Feature>Até {fmtNum(p.max_hectares)} ha</Feature>
                    <Feature>{fmtNum(p.max_users)} usuários</Feature>
                    <Feature>{fmtNum(p.max_ai_calls_month)} chamadas IA/mês</Feature>
                    <Feature>{fmtNum(p.max_ndvi_calls_month)} leituras NDVI/mês</Feature>
                    <Feature>Relatórios PDF ilimitados</Feature>
                    {p.tier === "enterprise" && <Feature>Sentinel Hub satélite real</Feature>}
                    {p.tier === "enterprise" && <Feature>Suporte dedicado</Feature>}
                  </ul>
                  {!isCurrent && priceId && (
                    <Button className="w-full" onClick={() => setCheckoutPriceId(priceId)}>
                      {currentTier === "free" ? "Assinar" : "Trocar para este plano"}
                    </Button>
                  )}
                  {isCurrent && p.tier !== "free" && (
                    <Button className="w-full" variant="outline" onClick={openPortal} disabled={portalLoading}>
                      Gerenciar
                    </Button>
                  )}
                  {isCurrent && p.tier === "free" && (
                    <Button className="w-full" variant="outline" disabled>Plano atual</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Checkout dialog */}
      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Finalizar assinatura</DialogTitle></DialogHeader>
          {checkoutPriceId && current && (
            <StripeEmbeddedCheckout priceId={checkoutPriceId} organizationId={current.id} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsageBar({ label, current, max, suffix = "" }: { label: string; current: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const over = current > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? "text-destructive font-medium" : "font-medium"}>
          {Number(current).toLocaleString("pt-BR")}{suffix} / {fmtNum(max)}{suffix}
        </span>
      </div>
      <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
      {over && (
        <div className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" /> Limite excedido
        </div>
      )}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
