import { Link } from "react-router-dom";
import { Map, Brain, Satellite, FlaskConical, Building2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import nutrirLogo from "@/assets/logo-nutrir-3d.png";

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
            Construído sobre a base do Programa Nutrir, expandido para uma arquitetura empresarial.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            { icon: Map,          label: "Mapas",     desc: "Talhões e cálculo de área" },
            { icon: FlaskConical, label: "Nutrição",  desc: "Motor NPK + foliar" },
            { icon: Brain,        label: "IA",        desc: "Recomendações por amostra" },
            { icon: Satellite,    label: "Satélite",  desc: "NDVI Sentinel por talhão" },
            { icon: Building2,    label: "Dashboard", desc: "KPIs e gestão" },
          ].map(f => (
            <div key={f.label} className="bg-white rounded-2xl border border-[#e2e8e0] p-6 hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="w-11 h-11 rounded-xl bg-[#f0fdf4] group-hover:bg-emerald-100 flex items-center justify-center mb-4 transition-colors">
                <f.icon className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-[#0b2e14] mb-1">{f.label}</h3>
              <p className="text-[13px] text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Features ── */}
    <section className="bg-white py-24 border-t border-[#e8ede9]">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-10">
          {[
            { icon: ShieldCheck, title: "Multi-tenant seguro",  desc: "Isolamento total por organização com RLS no banco. Convide sua equipe com papéis e permissões." },
            { icon: Zap,         title: "Pronto para escala",   desc: "Planos Free, Pro e Enterprise com limites de uso por workspace. Cresça sem reescrever nada." },
            { icon: Brain,       title: "IA integrada",         desc: "Recomendações agronômicas automáticas por análise de solo e sintomas foliares." },
          ].map(f => (
            <div key={f.title}>
              <div className="w-11 h-11 rounded-xl bg-[#0b2e14] flex items-center justify-center mb-5">
                <f.icon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-[16px] font-bold text-[#0b2e14] mb-2">{f.title}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA Final ── */}
    <section className="bg-[#0b2e14] py-20">
      <div className="container mx-auto px-6 text-center">
        <img src={nutrirLogo} alt="Nutrir" className="h-14 w-auto object-contain mx-auto mb-6" />
        <h2 className="text-[30px] font-black text-white tracking-tight mb-4">
          Comece hoje, de graça.
        </h2>
        <p className="text-white/50 text-[15px] mb-8">Sem cartão de crédito. Cancele quando quiser.</p>
        <Link to="/auth?mode=signup"
          className="inline-flex items-center gap-2 px-8 h-12 text-[15px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors">
          Criar conta gratuita <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>

    <footer className="bg-[#061a0b] py-8 text-center text-[12px] text-white/25">
      © {new Date().getFullYear()} Nutrir AgTech · Todos os direitos reservados
    </footer>
  </div>
);

export default Landing;
