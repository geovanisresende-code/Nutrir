import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Satellite, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

type Field = { id: string; name: string; centroid_lat: number | null; centroid_lng: number | null; hectares: number | null };

export default function NDVI() {
  const { current } = useOrg();
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [index, setIndex] = useState<"NDVI" | "NDRE" | "NDMI" | "RGB">("NDVI");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!current) return;
    supabase.from("fields").select("id,name,centroid_lat,centroid_lng,hectares")
      .eq("organization_id", current.id).order("name")
      .then(({ data }) => setFields((data as Field[]) || []));
  }, [current]);

  const gerar = async () => {
    if (!fieldId) { toast.error("Selecione um talhão"); return; }
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ndvi-fetch", {
        body: { organization_id: current?.id, field_id: fieldId, date, index },
      });
      if (error) throw error;
      setResult(data);
      toast.success("Leitura NDVI gerada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao buscar NDVI");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Satellite className="h-6 w-6 text-primary" />
          Análise NDVI
        </h1>
        <p className="text-muted-foreground text-sm">Mapas de índices de vegetação por talhão, comparáveis no tempo</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Gerar leitura</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Talhão</Label>
            <Select value={fieldId} onValueChange={setFieldId}>
              <SelectTrigger><SelectValue placeholder="Escolha um talhão..." /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} {f.hectares ? `· ${f.hectares} ha` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Índice</Label>
            <Select value={index} onValueChange={(v) => setIndex(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NDVI">NDVI</SelectItem>
                <SelectItem value="NDRE">NDRE</SelectItem>
                <SelectItem value="NDMI">NDMI</SelectItem>
                <SelectItem value="RGB">RGB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Button onClick={gerar} disabled={loading || !fieldId} className="bg-gradient-primary">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : "Gerar NDVI"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {fields.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Nenhum talhão cadastrado ainda. Vá em <strong>Mapas e Talhões</strong> e desenhe um polígono.
        </CardContent></Card>
      )}

      {result && (
        <Card><CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
          <CardContent>
            {result.image_url && <img src={result.image_url} alt="NDVI" className="rounded-lg w-full max-h-[500px] object-contain bg-muted" />}
            <pre className="text-xs mt-3 bg-muted p-3 rounded">{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
