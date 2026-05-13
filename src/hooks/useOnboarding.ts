import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";

export interface OnboardingStatus {
  loading: boolean;
  completed: boolean;
  step: number;
  hasFarm: boolean;
  hasField: boolean;
  refresh: () => Promise<void>;
  markCompleted: () => Promise<void>;
  setStep: (step: number) => Promise<void>;
}

export function useOnboarding(): OnboardingStatus {
  const { user } = useAuth();
  const { current } = useOrg();
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [step, setStepState] = useState(0);
  const [hasFarm, setHasFarm] = useState(false);
  const [hasField, setHasField] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at, onboarding_step")
      .eq("id", user.id)
      .maybeSingle();

    setCompleted(!!profile?.onboarding_completed_at);
    setStepState(profile?.onboarding_step ?? 0);

    if (current) {
      const [{ count: fc }, { count: dc }] = await Promise.all([
        supabase.from("farms").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
        supabase.from("fields").select("id", { count: "exact", head: true }).eq("organization_id", current.id),
      ]);
      setHasFarm((fc ?? 0) > 0);
      setHasField((dc ?? 0) > 0);
    } else {
      setHasFarm(false);
      setHasField(false);
    }

    setLoading(false);
  }, [user, current]);

  useEffect(() => { refresh(); }, [refresh]);

  const markCompleted = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: 4 })
      .eq("id", user.id);
    setCompleted(true);
    setStepState(4);
  }, [user]);

  const setStep = useCallback(async (s: number) => {
    if (!user) return;
    await supabase.from("profiles").update({ onboarding_step: s }).eq("id", user.id);
    setStepState(s);
  }, [user]);

  return { loading, completed, step, hasFarm, hasField, refresh, markCompleted, setStep };
}
