import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Satellite, Brain, FlaskConical, Map } from "lucide-react";
import nutrirLogo from "@/assets/1.png";

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const nextUrl = params.get("next") || "/app";

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Bem-vindo de volta!"); navigate(nextUrl); }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}${nextUrl}`, data: { full_name: name } }
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Conta criada! Verifique seu email."); navigate(nextUrl); }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: `${window.location.origin}/app` }
    });
    if (error) toast.error(error.message);
  };

  const features = [
    { icon: Map,          label: "Mapas de Talhões",    desc: "Desenho e cálculo de área" },
    { icon: FlaskConical, label: "Motor de Formulação", desc: "NPK + foliar + micronutrientes" },
    { icon: Brain,        label: "IA Agronômica",       desc: "Recomendações por amostra" },
    { icon: Satellite,    label: "NDVI por Satélite",   desc: "Monitoramento Sentinel" },
  ];

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo verde escuro ── */}
      <div className="hidden md:flex w-[52%] bg-[#0b2e14] flex-col relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(ellipse at 10% 90%, rgba(34,197,94,0.08) 0%, transparent 55%), radial-gradient(ellipse at 90% 10%, rgba(22,163,74,0.06) 0%, transparent 55%)" }} />

        <div className="relative flex flex-col h-full p-12">
          <Link to="/">
            <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full blur-2xl bg-[#d4a843]/25 scale-150" />
            <img src={nutrirLogo} alt="Nutrir" className="relative h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(212,168,67,0.5)]" />
          </div>
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[#d4a843] text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
              Plataforma AgTech
            </p>
            <h2 className="text-white text-[38px] font-black tracking-tight leading-[1.1] mb-4">
              Do solo<br />ao satélite.
            </h2>
            <p className="text-white/55 text-[15px] leading-relaxed max-w-sm">
              Motor de formulação, análise NDVI e inteligência agronômica em um único workspace multiusuário.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 bg-white/[0.05] border border-white/[0.08] rounded-xl p-3.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#d4a843]/20 shrink-0">
                    <Icon className="h-4 w-4 text-[#d4a843]" />
                  </div>
                  <div>
                    <div className="text-white text-[12px] font-semibold leading-none">{label}</div>
                    <div className="text-white/40 text-[11px] mt-1">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Nutrir AgTech · Todos os direitos reservados</p>
        </div>
      </div>

      {/* ── Painel direito ── */}
      <div className="flex-1 flex flex-col bg-[#f5f8f5]">
        <div className="md:hidden flex items-center justify-center h-16 bg-[#0b2e14]">
          <img src={nutrirLogo} alt="Nutrir" className="h-10 w-auto object-contain drop-shadow-[0_0_14px_rgba(212,168,67,0.45)]" />
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-[#e2e8e0] p-8 shadow-sm">
              <div className="mb-7">
                <h1 className="text-[22px] font-black text-[#0b2e14] tracking-tight leading-none">
                  Acessar plataforma
                </h1>
                <p className="text-[13px] text-gray-500 mt-2">Entre com sua conta ou crie uma nova</p>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid grid-cols-2 w-full mb-6 bg-[#f0f5f1] rounded-xl p-1">
                  <TabsTrigger value="signin" className="text-[13px] font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0b2e14] data-[state=active]:shadow-sm">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="text-[13px] font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0b2e14] data-[state=active]:shadow-sm">
                    Criar conta
                  </TabsTrigger>
                </TabsList>

                {/* ── Sign In ── */}
                <TabsContent value="signin">
                  <form onSubmit={signIn} className="space-y-4">
                    <div>
                      <Label htmlFor="signin-email" className="text-[13px] font-medium text-[#0b2e14]">E-mail</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        className="mt-1.5 h-10 text-[13px] border-[#d1d9d1] focus:border-[#d4a843] focus:ring-[#d4a843]/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signin-password" className="text-[13px] font-medium text-[#0b2e14]">Senha</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="mt-1.5 h-10 text-[13px] border-[#d1d9d1] focus:border-[#d4a843] focus:ring-[#d4a843]/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-10 bg-[#0b2e14] hover:bg-[#0d3818] text-white text-[13px] font-semibold rounded-lg"
                    >
                      {loading ? "Entrando…" : "Entrar"}
                    </Button>
                  </form>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e2e8e0]" /></div>
                    <div className="relative flex justify-center"><span className="px-3 bg-white text-[11px] text-gray-400 uppercase tracking-wider">ou</span></div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={google}
                    className="w-full h-10 text-[13px] font-medium border-[#d1d9d1] hover:bg-[#f5f8f5] rounded-lg"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar com Google
                  </Button>
                </TabsContent>

                {/* ── Sign Up ── */}
                <TabsContent value="signup">
                  <form onSubmit={signUp} className="space-y-4">
                    <div>
                      <Label htmlFor="signup-name" className="text-[13px] font-medium text-[#0b2e14]">Nome completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="João Silva"
                        className="mt-1.5 h-10 text-[13px] border-[#d1d9d1] focus:border-[#d4a843] focus:ring-[#d4a843]/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-email" className="text-[13px] font-medium text-[#0b2e14]">E-mail</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        className="mt-1.5 h-10 text-[13px] border-[#d1d9d1] focus:border-[#d4a843] focus:ring-[#d4a843]/20"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-password" className="text-[13px] font-medium text-[#0b2e14]">Senha</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="mínimo 6 caracteres"
                        required
                        minLength={6}
                        className="mt-1.5 h-10 text-[13px] border-[#d1d9d1] focus:border-[#d4a843] focus:ring-[#d4a843]/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-10 bg-[#c49a30] hover:bg-[#a07820] text-white text-[13px] font-semibold rounded-lg"
                    >
                      {loading ? "Criando conta…" : "Criar conta grátis"}
                    </Button>
                  </form>

                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e2e8e0]" /></div>
                    <div className="relative flex justify-center"><span className="px-3 bg-white text-[11px] text-gray-400 uppercase tracking-wider">ou</span></div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={google}
                    className="w-full h-10 text-[13px] font-medium border-[#d1d9d1] hover:bg-[#f5f8f5] rounded-lg"
                  >
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continuar com Google
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
