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
            <img src={nutrirLogo} alt="Nutrir" className="h-16 w-auto object-contain" />
          </Link>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-emerald-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
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
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 shrink-0">
                    <Icon className="h-4 w-4 text-emerald-400" />
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
          <img src={nutrirLogo} alt="Nutrir" className="h-10 w-auto object-contain" />
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
                  <TabsTrigger value="signup" className="text-[13px] font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#0b2e14] data-[state=active]:shad