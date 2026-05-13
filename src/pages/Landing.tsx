import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Map, Brain, Satellite, FlaskConical, Building2, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";

const Landing = () => (
  <div className="min-h-screen bg-background">
    <header className="container mx-auto px-6 py-5 flex items-center justify-between">
      <Logo className="h-10" />
      <nav className="flex gap-2">
        <Button variant="ghost" asChild><Link to="/auth">Entrar</Link></Button>
        <Button asChild className="bg-gradient-primary"><Link to="/auth?mode=signup">Começar grátis</Link></Button>
      </nav>
    </header>

    <section className="bg-gradient-hero text-primary-foreground">
      <div className="container mx-auto px-6 py-24 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs mb-6 border border-white/20">
          <Zap className="h-3 w-3" /> SaaS multiusuário · Mapas · IA · Satélite
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Nutrição vegetal inteligente, do solo ao satélite
        </h1>
        <p className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl mx-auto">
          Plataforma agronômica completa para consultorias e cooperativas: motor de formulação, NDVI por talhão e recomendações de IA — tudo em workspaces isolados.
        </p>
        <div className="flex gap-3 justify-center">
          <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/auth?mode=signup">Criar conta gratuita</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="bg-white/10 text-white border-white/30 hover:bg-white/20">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>
      </div>
    </section>

    <section className="container mx-auto px-6 py-20">
      <h2 className="text-3xl font-bold text-center mb-3">Cinco módulos integrados</h2>
      <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
        Construído sobre a base do Programa Nutrir, expandido para uma arquitetura empresarial.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { i: Map, t: "Mapas", d: "Desenho de talhões e cálculo de área" },
          { i: FlaskConical, t: "Nutrição", d: "Motor de formulação NPK + foliar" },
          { i: Brain, t: "IA", d: "Recomendações por amostra e cultura" },
          { i: Satellite, t: "Satélite", d: "NDVI Sentinel por talhão" },
          { i: Building2, t: "Dashboard", d: "KPIs e gestão da organização" },
        ].map(f => (
          <div key={f.t} className="p-6 rounded-xl border bg-card shadow-soft hover:shadow-elegant transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3">
              <f.i className="h-5 w-5" />
            </div>
            <h3 className="font-semibold mb-1">{f.t}</h3>
            <p className="text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-muted/40 py-20">
      <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8">
        <Feature i={ShieldCheck} t="Multi-tenant seguro" d="Isolamento total por organização com RLS no banco. Convide sua equipe com papéis." />
        <Feature i={Zap} t="Pronto para escala" d="Planos Free, Pro e Enterprise com limites de uso por workspace." />
        <Feature i={Brain} t="IA integrada" d="Lovable AI Gateway — sem chaves para configurar." />
      </div>
    </section>

    <footer className="container mx-auto px-6 py-10 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} Nutrir Enterprise
    </footer>
  </div>
);

const Feature = ({ i: I, t, d }: any) => (
  <div>
    <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center mb-3"><I className="h-5 w-5" /></div>
    <h3 className="font-semibold mb-1">{t}</h3>
    <p className="text-sm text-muted-foreground">{d}</p>
  </div>
);

export default Landing;
