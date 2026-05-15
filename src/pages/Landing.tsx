import { Link } from "react-router-dom";
import { Map, Brain, Satellite, FlaskConical, Building2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import nutrirLogo from "@/assets/1.png";

const Landing = () => (
  <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

    {/* ── Header verde escuro ── */}
    <header className="sticky top-0 z-50 bg-[#0b2e14] border-b border-white/10">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <img src={nutrirLogo} alt="Nutrir" className="h-10 w-auto object-contain" />
        <nav className="flex items-center gap-3">
          <Link to="/auth"
            className="px-4 h-9 flex items-center text-[13px] font-medium text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            Entrar
          </Link>
          <Link to="/auth?mode=signup"
            className="px-5 h-9 flex items-center text-[13px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg transition-colors gap-1.5">
            Começar grátis <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>

    {/* ── Hero verde escuro ── */}
    <section className="bg-[#0b2e14] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(ellipse at 20% 100%, rgba(34,197,94,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(22,163,74,0.07) 0%, transparent 50%)" }} />
      <div className="relative container mx-auto px-6 py-28 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold uppercase tracking-wider mb-8">
          <Zap className="h-3 w-3" /> SaaS multiusuário · Mapas · IA · Satélite
        </div>
        <img src={nutrirLogo} alt="Nutrir" className="h-24 w-auto object-contain mx-auto mb-8" />
        <h1 className="text-[42px] md:text-[58px] font-black tracking-tight text-white leading-[1.05] mb-6">
          Nutrição vegetal<br />
          <span className="text-emerald-400">inteligente.</span>
        </h1>
        <p className="text-[17px] text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
          Plataforma agronômica completa para consultorias e cooperativas — motor de formulação, NDVI por talhão e recomendações de IA em workspaces isolados.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/auth?mode=signup"
            className="px-7 h-12 flex items-center text-[15px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors gap-2">
            Criar conta gratuita <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/auth"
            className="px-7 h-12 flex items-center text-[15px] font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-colors">
            Já tenho conta
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {[
            { val: "5+", label: "Módulos integrados" },
            { val: "100%", label: "Multi-tenant seguro" },
            { val: "IA", label: "Recomendações automáticas" },
          ].map(s => (
            <div key={s.val} className="text-center">
              <div className="text-2xl font-black text-white">{s.val}</div>
              <div className="text-[11px] text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Módulos ── */}
    <section className="bg-[#f5f8f5] py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 mb-3">Plataforma completa</p>
          <h2 className="text-[32px] font-black text-[#0b2e14] tracking-tight">Cinco módulos integrados</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-[15px]">
            Construído sobre a base do Progra