import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

/** Hook genérico para listar/recarregar registros de uma tabela com filtro por organização. */
export function useOrgTable<T = any>(
  table: string,
  opts: { select?: string; orderBy?: string; ascending?: boolean; filter?: (q: any) => any; deps?: any[] } = {}
) {
  const { current } = useOrg();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!current) { setData([]); setLoading(false); return; }
    setLoading(true);
    let q: any = (supabase as any).from(table).select(opts.select ?? "*").eq("organization_id", current.id);
    if (opts.filter) q = opts.filter(q);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });
    const { data: rows, error } = await q;
    if (error) {
      console.error(`[${table}]`, error);
      toast({ title: `Erro ao carregar ${table}`, description: error.message, variant: "destructive" });
    }
    setData((rows ?? []) as T[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, table, ...(opts.deps ?? [])]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload, setData };
}

/** Catálogos globais (culturas, nutrientes) — sem filtro de org. */
export function useGlobalTable<T = any>(table: string, orderBy = "nome") {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await (supabase as any).from(table).select("*").order(orderBy);
      if (cancelled) return;
      if (error) console.error(`[${table}]`, error);
      setData((rows ?? []) as T[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [table, orderBy]);
  return { data, loading };
}
