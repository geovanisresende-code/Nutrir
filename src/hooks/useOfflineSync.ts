import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listOutbox, removeFromOutbox, updateOutboxItem, countOutbox, type OutboxItem } from "@/lib/offlineDB";
import { useOnlineStatus } from "./useOnlineStatus";

export function useOfflineSync() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPending(await countOutbox());
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const items = await listOutbox();
      for (const item of items) {
        try {
          const { error } = await supabase.from(item.table as any).insert(item.payload);
          if (error) throw error;
          await removeFromOutbox(item.id);
        } catch (e: any) {
          const updated: OutboxItem = {
            ...item,
            attempts: item.attempts + 1,
            last_error: e?.message ?? String(e),
          };
          await updateOutboxItem(updated);
          // stop on first failure to avoid hammering
          break;
        }
      }
    } finally {
      await refreshCount();
      setSyncing(false);
    }
  }, [syncing, refreshCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (online && pending > 0) sync();
  }, [online, pending, sync]);

  return { online, pending, syncing, sync, refreshCount };
}
