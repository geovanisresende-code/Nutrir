import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Bem-vindo de volta!"); navigate("/app"); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: name } }
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta criada! Verifique seu email."); navigate("/app"); }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: `${window.location.origin}/app` }
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-gradient-hero text-primary-foreground p-10 flex-col justify-between">
        <Link to="/" className="inline-flex bg-white/95 rounded-lg p-3 shadow-elegant w-fit">
          <Logo className="h-10" />
        </Link>
        <div>
          <h2 className="text-4xl font-bold mb-3">Do solo ao satélite.</h2>
          <p className="text-white/85 max-w-md">Plataforma agronômica multiusuário com motor de formulação, NDVI e IA — pronta para sua consultoria escalar.</p>
        </div>
        <div className="text-xs text-white/60">© {new Date().getFullYear()} Nutrir</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader>
            <CardTitle>Acessar plataforma</CardTitle>
            <CardDescription>Entre ou crie sua organização</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-3 mt-4">
                <form onSubmit={signIn} className="space-y-3">
                  <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field id="password" label="Senha" type="password" value={password} onChange={setPassword} />
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                    {loading ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-3 mt-4">
                <form onSubmit={signUp} className="space-y-3">
                  <Field id="name" label="Nome completo" type="text" value={name} onChange={setName} />
                  <Field id="email2" label="Email" type="email" value={email} onChange={setEmail} />
                  <Field id="pw2" label="Senha (mín. 6)" type="password" value={password} onChange={setPassword} />
                  <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                    {loading ? "Criando…" : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-4 text-center text-xs text-muted-foreground">
              <span className="bg-card px-2 relative z-10">ou</span>
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={google}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Field = ({ id, label, type, value, onChange }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} required />
  </div>
);

export default Auth;
