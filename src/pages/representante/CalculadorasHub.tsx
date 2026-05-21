import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppShell";
import {
  FlaskConical, Droplets, Leaf, Atom, Sprout, TestTube,
  Beaker, FlaskRound, Clock,
} from "lucide-react";

type Calc = {
  label: string;
  icon: any;
  to?: string;
  gradient: string;
  shadow: string;
  badge?: string;
  emBreve?: boolean;
};

type Grupo = {
  titulo: string;
  cor: string;
  items: Calc[];
};

const GRUPOS: Grupo[] = [
  {
    titulo: "Adubação Nitrogenada",
    cor: "text-green-700",
    items: [
      {
        label: "N180",
        icon: FlaskConical,
        to: "/app/rep/calculadora-n180",
        gradient: "from-green-600 to-teal-700",
        shadow: "shadow-green-300/50",
        badge: "core",
      },
      {
        label: "N180+B",
        icon: FlaskConical,
        to: "/app/rep/calculadora-n180",
        gradient: "from-cyan-500 to-blue-700",
        shadow: "shadow-cyan-300/50",
      },
      {
        label: "NitroPlus",
        icon: Atom,
        to: "/app/rep/calculadora-n180",
        gradient: "from-violet-600 to-purple-800",
        shadow: "shadow-violet-300/50",
        badge: "novo",
      },
    ],
  },
  {
    titulo: "Adubação de Base NPK",
    cor: "text-sky-700",
    items: [
      {
        label: "N-P-K",
        icon: Droplets,
        to: "/app/nutrir/calculadora-npk",
        gradient: "from-sky-500 to-blue-700",
        shadow: "shadow-sky-300/50",
      },
      {
        label: "N180",
        icon: FlaskConical,
        to: "/app/rep/calculadora-n180",
        gradient: "from-green-500 to-emerald-700",
        shadow: "shadow-green-300/50",
      },
      {
        label: "K180",
        icon: FlaskRound,
        gradient: "from-orange-500 to-amber-700",
        shadow: "shadow-orange-300/50",
        emBreve: true,
      },
      {
        label: "P180",
        icon: Beaker,
        gradient: "from-pink-500 to-rose-700",
        shadow: "shadow-pink-300/50",
        emBreve: true,
      },
      {
        label: "Micros Solo",
        icon: TestTube,
        gradient: "from-amber-500 to-yellow-700",
        shadow: "shadow-amber-300/50",
        emBreve: true,
      },
      {
        label: "NPK+Micros",
        icon: Sprout,
        gradient: "from-lime-600 to-green-800",
        shadow: "shadow-lime-300/50",
        emBreve: true,
      },
    ],
  },
  {
    titulo: "Adubação Foliar",
    cor: "text-yellow-700",
    items: [
      {
        label: "Boro",
        icon: Droplets,
        gradient: "from-blue-400 to-blue-700",
        shadow: "shadow-blue-300/50",
        emBreve: true,
      },
      {
        label: "Foliar Completo",
        icon: Leaf,
        to: "/app/nutrir/calculadora-foliar",
        gradient: "from-yellow-500 to-orange-600",
        shadow: "shadow-yellow-300/50",
      },
      {
        label: "N32",
        icon: Leaf,
        to: "/app/rep/calculadora-n180",
        gradient: "from-lime-500 to-green-600",
        shadow: "shadow-lime-300/50",
      },
      {
        label: "N32+Boro",
        icon: Leaf,
        to: "/app/rep/calculadora-n180",
        gradient: "from-emerald-500 to-teal-700",
        shadow: "shadow-emerald-300/50",
      },
    ],
  },
];

export default function CalculadorasHub() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader title="Calculadoras" description="Escolha o tipo de cálculo" />

      <div className="px-4 space-y-6">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo}>
            <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${grupo.cor}`}>
              {grupo.titulo}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {grupo.items.map((c) => (
                <button
                  key={c.label + grupo.titulo}
                  disabled={c.emBreve}
                  onClick={() => c.to && navigate(c.to)}
                  className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border transition-all duration-200
                    ${c.emBreve
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-transparent hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                    }`}
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}
                  onMouseEnter={e => {
                    if (!c.emBreve) (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)";
                  }}
                >
                  <div className={`bg-gradient-to-br ${c.gradient} rounded-xl p-3 shadow-lg ${c.shadow}`}>
                    {c.emBreve
                      ? <Clock className="h-5 w-5 text-white" strokeWidth={1.8} />
                      : <c.icon className="h-5 w-5 text-white" strokeWidth={1.8} />
                    }
                  </div>
                  <span className="text-[11px] font-semibold text-center text-foreground leading-tight">
                    {c.label}
                  </span>
                  {c.emBreve && (
                    <span className="text-[9px] text-muted-foreground">em breve</span>
                  )}
                  {c.badge && !c.emBreve && (
                    <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full leading-none">
                      {c.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
