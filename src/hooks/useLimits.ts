import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";

export interface OrgUsage {
  hectares: number;
  members: number;
  ai_calls_month: number;
  ndvi_calls_month: number;
  reports_month: number;
}

export interface PlanLimits {
  tier: string;
  name: string;
  max_hectares: number;
  max_users: number;
  max_ai_calls_month: number;
  max_ndvi_calls_month: number;
  price_cents: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

export interface LimitState {
  loading: boolean;
  usage: OrgUsage | null;
  plan: PlanLimits | null;
  refresh: () => Promise<void>;
  pct: (key: keyof OrgUsage) => number;
  isOverHectares: boolean;
  isOverUsers: boolean;
  isOverAI: boolean;
  isOverNDVI: boolean;
  canAddHectares: (hectares: number) => boolean;
  canAddMember: () => boolean;
}

export function useLimits(): LimitState {
  const { current } = useOrg();
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [plan, setPlan] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.rpc("get_org_usage", { _org: current.id }),
      supabase.from("plans").select("*").eq("tier", current.plan_tier).maybeSingle(),
    ]);
    if (u && Array.isArray(u) && u[0]) setUsage(u[0] as OrgUsage);
    if (p) setPlan(p as PlanLimits);
    setLoading(false);
  }, [current]);

  useEffect(() => { refresh(); }, [refresh]);

  const pct = (key: keyof OrgUsage): number => {
    if (!usage || !plan) return 0;
    const map: Record<string, number> = {
      hectares: plan.max_hectares,
      members: plan.max_users,
      ai_calls_month: plan.max_ai_calls_month,
      ndvi_calls_month: plan.max_ndvi_calls_month,
      reports_month: 999999,
    };
    const lim = map[key as string] ?? 1;
    if (lim <= 0) return 0;
    return Math.min(100, ((usage[key] as number) / lim) * 100);
  };

  const isOverHectares = !!(usage && plan && usage.hectares > plan.max_hectares);
  const isOverUsers = !!(usage && plan && usage.members > plan.max_users);
  const isOverAI = !!(usage && plan && usage.ai_calls_month >= plan.max_ai_calls_month);
  const isOverNDVI = !!(usage && plan && usage.ndvi_calls_month >= plan.max_ndvi_calls_month);

  const canAddHectares = (h: number) => !plan || !usage || (usage.hectares + h) <= plan.max_hectares;
  const canAddMember = () => !plan || !usage || (usage.members + 1) <= plan.max_users;

  return { loading, usage, plan, refresh, pct, isOverHectares, isOverUsers, isOverAI, isOverNDVI, canAddHectares, canAddMember };
}
