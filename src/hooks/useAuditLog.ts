import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export type AuditAction =
  | "create" | "update" | "delete"
  | "ai.recommend" | "ai.chat" | "ai.image_diagnose"
  | "ndvi.fetch" | "ndvi.history"
  | "report.generate" | "report.download"
  | "data.export"
  | "auth.signin" | "auth.signout"
  | "member.invite" | "member.remove" | "member.role_change";

export type AuditEntity =
  | "client" | "field" | "farm" | "soil_sample" | "leaf_sample"
  | "ai_recommendation" | "ai_chat_thread" | "ai_image_diagnosis"
  | "ndvi_reading" | "report" | "collection_route" | "organization" | "member"
  | "data_export";

interface LogParams {
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id?: string | null;
  client_id?: string | null;
  field_id?: string | null;
  description?: string;
  metadata?: Record<string, any>;
}

export const useAuditLog = () => {
  const { current } = useOrg();
  const { user } = useAuth();

  const log = useCallback(async (p: LogParams) => {
    if (!current?.id || !user?.id) return;
    try {
      await supabase.from("audit_log").insert({
        organization_id: current.id,
        user_id: user.id,
        action: p.action,
        entity_type: p.entity_type,
        entity_id: p.entity_id ?? null,
        client_id: p.client_id ?? null,
        field_id: p.field_id ?? null,
        description: p.description ?? null,
        metadata: p.metadata ?? null,
      });
    } catch (e) {
      // Silent — auditoria nunca deve quebrar UX
      console.warn("[audit] failed", e);
    }
  }, [current?.id, user?.id]);

  return { log };
};
