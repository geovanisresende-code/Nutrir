import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: "free" | "pro" | "enterprise";
  owner_id: string;
  mapbox_token: string | null;
}

interface OrgCtx {
  orgs: Organization[];
  current: Organization | null;
  loading: boolean;
  switchOrg: (id: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<OrgCtx>({ orgs: [], current: null, loading: true, switchOrg: () => {}, refresh: async () => {} });
const STORAGE_KEY = "nutrir.currentOrgId";

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [current, setCurrent] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setOrgs([]); setCurrent(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("id,name,slug,plan_tier,owner_id,mapbox_token")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Organization[];
    setOrgs(list);
    const stored = localStorage.getItem(STORAGE_KEY);
    const next = list.find(o => o.id === stored) ?? list[0] ?? null;
    setCurrent(next);
    if (next) localStorage.setItem(STORAGE_KEY, next.id);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const switchOrg = (id: string) => {
    const o = orgs.find(x => x.id === id);
    if (o) { setCurrent(o); localStorage.setItem(STORAGE_KEY, id); }
  };

  return <Ctx.Provider value={{ orgs, current, loading, switchOrg, refresh: load }}>{children}</Ctx.Provider>;
};

export const useOrg = () => useContext(Ctx);
