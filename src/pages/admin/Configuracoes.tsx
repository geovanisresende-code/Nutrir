import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrg } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Key, Map as MapIcon, Save, Eye, EyeOff, Satellite } from "lucide-react";

const Configuracoes = () => {
  const { current, refresh } = useOrg();
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ndviSource, setNdviSource] = useState<string>("demo");
  const [savingNdvi, setSavingNdvi] = useState(false);

  useEffect(() => { setToken(current?.mapbox_token ?? ""); }, [current?.id, current?.mapbox_token]);

  useEffect(() => {
    if (!current) return;
    supabase.from("organizations").select("ndvi_source").eq("id", current.id).maybeSingle()
      .then(({ data }) => setNdviSource((data as any)?.ndvi_source ?? "demo"));
  }, [current?.id]);

  const saveToken = async () => {
    if (!current) return;
    setSaving(true);
    const trimmed = token.trim() || null;
    if (trimmed && !trimmed.startsWith("pk.")) {
      toast.error("Token inválido — deve começar com 'pk.' (token público Mapbox).");
      setSaving(false); return;
    }
    const { error } = await supabase.from("organizations").update({ mapbox_token: trimmed }).eq("id", current.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Token Mapbox salvo");
    refresh();
  };

  const saveNdvi = async () => {
    if (!current) return;
    setSavingNdvi(true);
    const { error } = await supabase.from("organizations").update({ ndvi_source: ndviSource } as any).eq("id", current.id);
    setSavingNdvi(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fonte NDVI atualizada");
  };

  return (
    <>
      <PageHeader title="Configurações" description="Integrações e preferências do workspace"/>
      <div className="p-6 max-w-3xl space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><MapIcon className="h-4 w-4 text-primary"/>Mapbox</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Necessário para mapas interativos, desenho de talhões e coleta GPS. Crie uma conta gratuita em{" "}
                <a href="https://account.mapbox.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                  account.mapbox.com <ExternalLink className="h-3 w-3"/>
                </a>{" "}
                e copie seu <em>Default public token</em> (começa com <code>pk.</code>).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mapbox">Token público Mapbox</Label>
              <div className="flex gap-2">
                <Input id="mapbox" type={show ? "text" : "password"} value={token} onChange={e => setToken(e.target.value)} placeholder="pk.eyJ1Ijoi..."/>
                <Button type="button" variant="outline" size="icon" onClick={() => setShow(s => !s)}>
                  {show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </Button>
                <Button onClick={saveToken} disabled={saving} className="bg-gradient-primary"><Save className="h-4 w-4 mr-1"/>{saving ? "Salvando…" : "Salvar"}</Button>
              </div>
              {current?.mapbox_token && <p className="text-xs text-success">✓ Token configurado</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Satellite className="h-4 w-4 text-primary"/>NDVI / Satélite</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Escolha a fonte de dados NDVI. O modo Demo gera valores simulados (ideal para testes).
                O modo Sentinel Hub usa imagens reais do Sentinel-2 (10m de resolução).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Fonte de dados</Label>
              <div className="flex gap-2">
                <Select value={ndviSource} onValueChange={setNdviSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Demo (simulado)</SelectItem>
                    <SelectItem value="sentinel_hub">Sentinel Hub (real)</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={saveNdvi} disabled={savingNdvi} className="bg-gradient-primary">
                  <Save className="h-4 w-4 mr-1"/>{savingNdvi ? "Salvando…" : "Salvar"}
                </Button>
              </div>
              {ndviSource === "sentinel_hub" && (
                <p className="text-xs text-muted-foreground">
                  Crie credenciais em{" "}
                  <a href="https://apps.sentinel-hub.com/dashboard/" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                    apps.sentinel-hub.com <ExternalLink className="h-3 w-3"/>
                  </a>{" "}
                  e peça ao agente para adicionar <code>SENTINEL_HUB_CLIENT_ID</code> e <code>SENTINEL_HUB_CLIENT_SECRET</code>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2"><Key className="h-4 w-4"/>Outras integrações</h3>
            <ul className="text-sm space-y-2 mt-3">
              <li className="flex justify-between"><span>Lovable AI Gateway</span><span className="text-success font-medium">Ativo</span></li>
              <li className="flex justify-between"><span>NDVI</span><span className="text-muted-foreground">{ndviSource === "sentinel_hub" ? "Sentinel Hub" : "Demo"}</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
export default Configuracoes;
