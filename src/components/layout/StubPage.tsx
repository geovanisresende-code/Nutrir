import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { ReactNode } from "react";

interface StubPageProps {
  title: string;
  description?: string;
  phase?: string;
  features?: string[];
  children?: ReactNode;
}

/**
 * Página-stub padrão — usada enquanto cada módulo é implementado nas
 * próximas fases. Documenta o que vem por aí, evitando 404 e mantendo
 * navegação consistente.
 */
export const StubPage = ({ title, description, phase, features, children }: StubPageProps) => (
  <>
    <PageHeader title={title} description={description} />
    <div className="p-4 md:p-6 max-w-4xl">
      <Card className="p-6 md:p-8 bg-gradient-card shadow-card border-dashed">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
            <Construction className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold">Em construção</h2>
              {phase && (
                <span className="text-[10px] uppercase font-bold tracking-wider bg-accent/20 text-accent-foreground px-2 py-0.5 rounded">
                  {phase}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Este módulo está no cronograma de execução e será implementado na fase indicada.
              A navegação está ativa para validar a estrutura geral do sistema.
            </p>
            {features && features.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Funcionalidades planejadas
                </div>
                <ul className="space-y-1.5 text-sm">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {children}
          </div>
        </div>
      </Card>
    </div>
  </>
);
