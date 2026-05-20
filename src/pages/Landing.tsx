import { Link } from "react-router-dom";
import { Map, Brain, Satellite, FlaskConical, Building2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import nutrirLogo from "@/assets/1.png";

const Landing = () => (
  <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>

    {/* ── Header ── */}
    <header className="sticky top-0 z-50 bg-[#0b2e14] border-b border-white/10">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <img src={nutrirLogo} alt="Nutrir" className="h-10 w-auto object-contain drop-shadow-[0_0_12px_rgba(212,168,67,0.4)]" />
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="px-4 h-9 flex items-center text-[13px] font-medium text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            Entrar
          </Link>
          <Link to="/auth?mode=signup" className="px-5 h-9 flex items-center text-[13px] font-bold bg-[#d4a843] hover:bg-[#c49a30] text-white rounded-lg transition-colors gap-1.5">
            Começar grátis <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>

    {/* ── Hero ── */}
    <section className="bg-[#0b2e14] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(ellipse at 20% 100%, rgba(212,168,67,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(212,168,67,0.05) 0%, transparent 50%)" }} />
      <div className="relative container mx-auto px-6 py-28 text-center max-w-4xl">
        <div className="flex flex-col items-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full blur-3xl bg-white/10 scale-125" />
            <img src={nutrirLogo} alt="Nutrir" className="relative h-24 w-auto object-contain drop-shadow-[0_2px_16px_rgba(255,255,255,0.25)]" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#d4a843]/15 border border-[#d4a843]/25 text-[#d4a843] text-[11px] font-semibold uppercase tracking-wider mb-8">
            <Zap className="h-3 w-3" /> SaaS multiusuário · Mapas · IA · Satélite
          </div>
        </div>
        <h1 className="text-[42px] md:text-[58px] font-black tracking-tight text-white leading-[1.05] mb-6">
          Nutrição vegetal<br />
          <span className="text-[#d4a843]">inteligente.</span>
        </h1>
        <p className="text-[17px] text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
          Plataforma agronômica completa para consultorias e cooperativas — motor de formulação, NDVI por talhão e recomendações de IA em workspaces isolados.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link to="/auth?mode=signup" className="px-7 h-12 flex items-center text-[15px] font-bold bg-[#d4a843] hover:bg-[#c49a30] text-white rounded-xl transition-colors gap-2">
            Criar conta gratuita <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/auth" className="px-7 h-12 flex items-center text-[15px] font-semibold bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-colors">
            Já tenho conta
          </Link>
        </div>
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
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b08826] mb-3">Plataforma completa</p>
          <h2 className="text-[32px] font-black text-[#0b2e14] tracking-tight">Cinco módulos integrados</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-[15px]">
            Tudo o que uma consultoria agronômica precisa, em um único workspace multiusuário.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            { icon: Map,          title: "Mapas de Talhões",    desc: "Desenhe e edite talhões no mapa. Cálculo automático de área em hectares." },
            { icon: FlaskConical, title: "Motor de Formulação", desc: "NPK, foliar e micronutrientes. Gere recomendações e pedidos em PDF." },
            { icon: Brain,        title: "IA Agronômica",       desc: "Recomendações automáticas baseadas em análise de solo e diagnóstico por foto." },
            { icon: Satellite,    title: "NDVI por Satélite",   desc: "Monitoramento da vegetação via Sentinel-2. Alertas automáticos por talhão." },
            { icon: Building2,    title: "Gestão de Fazendas",  desc: "Cadastro de clientes, fazendas e talhões com histórico completo." },
            { icon: ShieldCheck,  title: "Multi-tenant Seguro", desc: "Workspaces isolados por organização com controle de acesso por função." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#e2e8e0] rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-[#d4a843]/10 flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-[#b08826]" />
              </div>
              <h3 className="text-[15px] font-bold text-[#0b2e14] mb-2">{title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="bg-[#0b2e14] py-20">
      <div className="container mx-auto px-6 text-center max-w-2xl">
        <h2 className="text-[32px] font-black text-white tracking-tight mb-4">
          Pronto para modernizar sua consultoria?
        </h2>
        <p className="text-white/55 text-[16px] mb-8">
          Crie sua conta grátis e configure seu workspace em menos de 2 minutos.
        </p>
        <Link to="/auth?mode=signup" className="inline-flex items-center gap-2 px-8 py-3 text-[15px] font-bold bg-[#d4a843] hover:bg-[#c49a30] text-white rounded-xl transition-colors">
          Começar agora <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>

    {/* ── Footer ── */}
    <footer className="bg-[#071a0c] py-8 border-t border-white/5">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full blur-xl bg-white/10 scale-125" />
            <img src={nutrirLogo} alt="Nutrir" className="relative h-8 w-auto object-contain drop-shadow-[0_1px_8px_rgba(255,255,255,0.2)]" />
          </div>
        <p className="text-white/25 text-[12px]">© {new Date().getFullYear()} Nutrir AgTech · Todos os direitos reservados</p>
        <Link to="/auth" className="text-white/40 text-[12px] hover:text-white/70 transition-colors">Acessar plataforma</Link>
      </div>
    </footer>

  </div>
);

export default Landing;
