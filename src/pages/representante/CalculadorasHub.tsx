import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import { FlaskConical, Droplets, Leaf, FileText, Atom, BarChart3 } from "lucide-react";

const CALCULADORAS = [
  {
    label: "N180",
    desc: "Ureia complexada",
    icon: FlaskConical,
    to: "/app/rep/calculadora-n180",
    gradient: "from-green-600 to-teal-700",
    shadow: "shadow-green-300/50",
    badge: "core",
  },
  {
    label: "N180+B",
    desc: "N180 com Boro",
    icon: FlaskConical,
    to: "/app/rep/calculadora-n180?modo=n180_b",
    gradient: "from-cyan-500 to-blue-600",
    shadow: "shadow-cyan-300/50",
  },
  {
    label: "NitroPlus",
    desc: "N180 + Micros",
    icon: Atom,
    to: "/app/rep/calculadora-n180?modo=n180_micros",
    gradient: "from-violet-600 to-purple-700",
    shadow: "shadow-violet-300/50",
    badge: "novo",
  },
  {
    label: "N32 Foliar",
    desc: "Foliar nitrogenado",
    icon: Leaf,
    to: "/app/rep/calculadora-n180?modo=n32_foliar",
    gradient: "from-lime-500 to-green-600",
    shadow: "shadow-lime-300/50",
  },
  {
    label: "N32+B",
    desc: "N32 com Boro",
    icon: Leaf,
    to: "/app/rep/calculadora-n180?modo=n32_b",
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-300/50",
  },
  {
    label: "NPK Solo",
    desc: "Drench NPK",
    icon: Droplets,
    to: "/app/rep/calculadora-n180?modo=npk_solo",
    gradient: "from-sky-500 to-blue-700",
    shadow: "shadow-sky-300/50",
  },
  {
    label: "Foliar Completa",
    desc: "Micronutrientes",
    icon: Leaf,
    to: "/app/nutrir/calculadora-foliar",
    gradient: "from-yellow-500 to-orange-600",
    shadow: "shadow-yellow-300/50",
  },
  {
    label: "NPK Fertirrig.",
    desc: "Por nutriente",
    icon: Droplets,
    to: "/app/nutrir/calculadora-npk",
    gradient: "from-orange-500 to-red-600",
    shadow: "shadow-orange-300/50",
  },
  {
    label: "Proposta TPD",
    desc: "PDF comercial",
    icon: FileText,
    to: "/app/rep/proposta-tpd",
    gradient: "from-amber-500 to-yellow-600",
    shadow: "shadow-amber-300/50",
  },
];

export default function CalculadorasHub() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Calculadoras"
        description="Escolha o tipo de cálculo"
      />

      <div className="px-4">
        <div className="grid grid-cols-3 gap-3">
          {CALCULADORAS.map((c) => (
            <button
              key={c.to + c.label}
              onClick={() => navigate(c.to)}
              className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border hover:border-transparent transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"; }}
            >
              <div className={`bg-gradient-to-br ${c.gradient} rounded-xl p-3 shadow-lg ${c.shadow}`}>
                <c.icon className="h-6 w-6 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-[11px] font-semibold text-center text-foreground leading-tight">
                {c.label}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {c.desc}
              </span>
              {c.badge && (
                <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full leading-none">
                  {c.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
