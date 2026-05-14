import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Sprout, Building2, Sparkles, ArrowRight, Map, FlaskConical, Brain, Satellite, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrganizationContext";
import { useOnboarding } from "@/hooks/useOnboarding";

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, refresh: refreshOrgs } = useOrg();
  const { step, setStep, markCompleted, hasFarm, hasField, refresh, loading, completed } = useOnboarding();

  // If already completed, send straight to the app
  useEffect(() => {
    if (!loading && completed) {
      navigate("/app", { replace: true });
    }
  }, [loading, completed, navigate]);

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldCrop, setFieldCrop] = useState("");
  const [fieldHectares, setFieldHectares] = useState("");
  const [busy, setBusy] = useState(false);

  // Skip steps already done
  useEffect(() => {
    if (loading) return;
    if (current && step === 0) setStep(1);
    if (hasFarm && step === 1) setStep(2);
    if (hasField && step === 2) setStep(3);
  }, [loading, current, hasFarm, hasField, step, setStep]);

  const progress = ((step + 1) / (TOTAL_STEPS + 1)) * 100;

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
     .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---- Step 0: organization ----
  const createOrg = async () => {
    if (!user || !orgName.trim()) return;
    setBusy(true);
    const slug = orgSlug || slugify(orgName);
    const { error } = await supabase.from("organizations").insert({
      name: orgName.trim(), slug, owner_id: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Organização criada!");
    await refreshOrgs();
    // Pula passos de fazenda/talhão/tour — usuário cadastra esses depois nos módulos próprios
    await markCompleted();
    navigate("/app", { replace: true });
  };

  // ---- Step 1: farm ----
  const createFarm = async () => {
    if (!current || !farmName.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("farms").insert({
      name: farmName.trim(),
      location: farmLocation.trim() || null,
      organization_id: current.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fazenda cadastrada!");
    await refresh();
    await setStep(2);
  };

  // ---- Step 2: field ----
  const createField = async () => {
    if (!current || !fieldName.trim()) return;
    setBusy(true);
    const ha = parseFloat(fieldHectares) || null;
    // Geometria placeholder — será editada no módulo Mapas
    const placeholderGeom = { type: "Polygon", coordinates: [] };
    const { error } = await supabase.from("fields").insert({
      name: fieldName.trim(),
      cultura: fieldCrop.trim() || null,
      hectares: ha,
      geometry: placeholderGeom,
      organization_id: current.id,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Talhão criado!");
    await refresh();
    await setStep(3);
  };

  // ---- Step 3: tour ----
  const finishTour = async () => {
    setBusy(true);
    await markCompleted();
    setBusy(false);
    toast.success("Tudo pronto! Bem-vindo ao Nutrir.");
    navigate("/app");
  };

  const skipAll = async () => {
    await markCompleted();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="w-3 h-3 mr-1" />
            Bem-vindo
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Vamos começar 🌱</h1>
          <p className="text-muted-foreground mt-2">Crie seu workspace para usar a plataforma.</p>
        </div>

        <Card>
          {step === 0 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Building2 className="w-5 h-5 text-primary" /></div>
                  <div>
                    <CardTitle>Crie sua organização</CardTitle>
                    <CardDescription>Um espaço de trabalho para você e sua equipe.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Nome da organização</Label>
                  <Input id="orgName" value={orgName} onChange={(e) => { setOrgName(e.target.value); setOrgSlug(slugify(e.target.value)); }} placeholder="Ex: Fazenda São João" />
                </div>
                <div>
                  <Label htmlFor="orgSlug">Identificador (slug)</Label>
                  <Input id="orgSlug" value={orgSlug} onChange={(e) => setOrgSlug(slugify(e.target.value))} placeholder="fazenda-sao-joao" />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={skipAll}>Pular</Button>
                  <Button onClick={createOrg} disabled={busy || !orgName.trim()}>
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><MapPin className="w-5 h-5 text-primary" /></div>
                  <div>
                    <CardTitle>Cadastre sua primeira fazenda</CardTitle>
                    <CardDescription>Você poderá adicionar mais depois.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="farmName">Nome da fazenda</Label>
                  <Input id="farmName" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="Ex: Sítio das Palmeiras" />
                </div>
                <div>
                  <Label htmlFor="farmLoc">Localização (opcional)</Label>
                  <Input id="farmLoc" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="Município / UF" />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(2)}>Pular</Button>
                  <Button onClick={createFarm} disabled={busy || !farmName.trim()}>
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Sprout className="w-5 h-5 text-primary" /></div>
                  <div>
                    <CardTitle>Cadastre seu primeiro talhão</CardTitle>
                    <CardDescription>Você poderá desenhar o contorno no mapa em seguida.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fieldName">Nome do talhão</Label>
                  <Input id="fieldName" value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="Ex: Talhão A1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fieldCrop">Cultura</Label>
                    <Input id="fieldCrop" value={fieldCrop} onChange={(e) => setFieldCrop(e.target.value)} placeholder="Soja, Milho..." />
                  </div>
                  <div>
                    <Label htmlFor="fieldHa">Hectares</Label>
                    <Input id="fieldHa" type="number" step="0.01" value={fieldHectares} onChange={(e) => setFieldHectares(e.target.value)} placeholder="50" />
                  </div>
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep(3)}>Pular</Button>
                  <Button onClick={createField} disabled={busy || !fieldName.trim()}>
                    Continuar <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><CheckCircle2 className="w-5 h-5 text-primary" /></div>
                  <div>
                    <CardTitle>Conheça os módulos</CardTitle>
                    <CardDescription>Tudo o que você pode fazer no Nutrir.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <TourItem icon={<Map className="w-4 h-4" />} title="Mapas" desc="Desenhe talhões e visualize sua área." />
                <TourItem icon={<FlaskConical className="w-4 h-4" />} title="Análises" desc="Cadastre amostras de solo e folha." />
                <TourItem icon={<Brain className="w-4 h-4" />} title="IA" desc="Recomendações automáticas e diagnóstico por foto." />
                <TourItem icon={<Satellite className="w-4 h-4" />} title="Satélite" desc="NDVI e monitoramento da vegetação." />
                <TourItem icon={<FileText className="w-4 h-4" />} title="Relatórios" desc="Exporte PDFs profissionais." />
                <div className="flex justify-end pt-2">
                  <Button onClick={finishTour} disabled={busy} size="lg">
                    Começar a usar <Sparkles className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function TourItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
      <div className="p-2 rounded-md bg-primary/10 text-primary mt-0.5">{icon}</div>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
