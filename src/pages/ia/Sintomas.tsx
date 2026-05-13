import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export default function IASintomas() {
  const { current } = useOrg();
  const fileRef = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState("Soja");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const onPick = (f: File | null) => {
    setFile(f); setResult(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const analisar = async () => {
    if (!current || !file) { toast.error("Selecione uma foto"); return; }
    setLoading(true); setResult(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${current.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("plant-photos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data, error } = await supabase.functions.invoke("ai-image-diagnose", {
        body: { organization_id: current.id, image_path: path, crop },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Falha no diagnóstico");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          IA · Sintomas Foliares
        </h1>
        <p className="text-muted-foreground text-sm">Foto da folha/planta → diagnóstico de deficiência, praga, doença ou fitotoxidez</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>1. Foto da planta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Cultura</Label>
              <Input value={crop} onChange={(e) => setCrop(e.target.value)} />
            </div>
            <Input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={(e) => onPick(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="flex-1">
                <Camera className="h-4 w-4 mr-2" /> Tirar foto / escolher
              </Button>
            </div>
            {preview && (
              <div className="rounded-lg overflow-hidden border">
                <img src={preview} alt="preview" className="w-full max-h-80 object-contain bg-muted" />
              </div>
            )}
            <Button onClick={analisar} disabled={loading || !file} className="w-full bg-gradient-primary">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando...</> : <><Upload className="h-4 w-4 mr-2" />Diagnosticar</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>2. Diagnóstico</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!result && <p className="text-muted-foreground">Envie uma foto para ver o diagnóstico aqui.</p>}
            {result && (
              <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded">{JSON.stringify(result, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
