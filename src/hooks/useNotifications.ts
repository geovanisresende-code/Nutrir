import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string | null;
  link: string | null;
  metadata: any;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(limit = 30) {
  const { user } = useAuth();
  const { current } = useOrg();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !current) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("organization_id", current.id)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [user, current, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!user || !current) return;
    const channel = supabase
      .channel(`notif-${current.id}-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `organization_id=eq.${current.id}`,
      }, (payload: any) => {
        refresh();
        if (payload?.eventType === "INSERT") {
          const n = payload.new ?? {};
          // Push browser notification (no-op se desligado/sem permissão)
          import("@/lib/push").then(({ showPush }) => {
            showPush({
              title: n.title ?? "Nova notificação",
              body: n.message ?? undefined,
              url: n.link ?? undefined,
              tag: n.id,
            });
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, current, refresh]);

  const unreadCount = items.filter(n => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user || !current) return;
    const ids = items.filter(n => !n.read_at).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  }, [items, user, current]);

  return { items, loading, unreadCount, refresh, markAsRead, markAllAsRead };
}
