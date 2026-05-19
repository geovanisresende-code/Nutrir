import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { PwaStatus } from "@/components/PwaStatus";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import NewOrganization from "./pages/NewOrganization";
import Onboarding from "./pages/Onboarding";
import Install from "./pages/Install";
import Dashboard from "./pages/modules/Dashboard";
import Mapas from "./pages/modules/Mapas";
import Nutricao from "./pages/modules/Nutricao";
import Heatmap from "./pages/modules/Heatmap";
import IA from "./pages/modules/IA";
import Satelite from "./pages/modules/Satelite";
import Relatorios from "./pages/modules/Relatorios";
import Historico from "./pages/modules/Historico";
import Billing from "./pages/modules/Billing";
import Integracoes from "./pages/modules/Integracoes";
import Equipe from "./pages/admin/Equipe";
import Usuarios from "./pages/admin/Usuarios";
import Organizacao from "./pages/admin/Organizacao";
import Configuracoes from "./pages/admin/Configuracoes";

// Nutrir (consultoria + comercial)
import Regionais from "./pages/nutrir/Regionais";
import Modalidades from "./pages/nutrir/Modalidades";
import Embalagens from "./pages/nutrir/Embalagens";
import Representantes from "./pages/nutrir/Representantes";
import ClientesNutrir from "./pages/nutrir/ClientesNutrir";
import ProdutosNutrir from "./pages/nutrir/Produtos";
import MateriasPrimas from "./pages/nutrir/MateriasPrimas";
import Formulacoes from "./pages/nutrir/Formulacoes";
import OrcamentoConsultoria from "./pages/nutrir/OrcamentoConsultoria";
import Orcamentos from "./pages/nutrir/Orcamentos";
import ProdutoFicha from "./pages/nutrir/ProdutoFicha";
import Precos from "./pages/nutrir/Precos";
import Pedidos from "./pages/nutrir/Pedidos";
import UsuariosNutrir from "./pages/nutrir/UsuariosNutrir";
import DashboardComercial from "./pages/nutrir/DashboardComercial";
import DashboardNutrir from "./pages/nutrir/DashboardNutrir";
import CalculadoraFoliar from "./pages/nutrir/CalculadoraFoliar";
import HistoricoFoliar from "./pages/nutrir/HistoricoFoliar";
import CalculadoraNPK from "./pages/nutrir/CalculadoraNPK";
import HistoricoNPK from "./pages/nutrir/HistoricoNPK";
import NutrirHome from "./pages/nutrir/NutrirHome";
import FontesFormulas from "./pages/nutrir/FontesFormulas";
import Complexadores from "./pages/nutrir/Complexadores";

// Páginas novas — Fase 1 (stubs navegáveis até implementação completa nas próximas fases)
import Fazendas from "./pages/Fazendas";
import Visitas from "./pages/representante/Visitas";
import EstoqueCliente from "./pages/representante/EstoqueCliente";
import ContasReceber from "./pages/representante/ContasReceber";
import Comissoes from "./pages/representante/Comissoes";
import CamposTeste from "./pages/representante/CamposTeste";
import RDV from "./pages/representante/RDV";
import PedidosRep from "./pages/representante/PedidosRep";
import DashboardRep from "./pages/representante/DashboardRep";
import RoteiroVisitas from "./pages/representante/RoteiroVisitas";
import OrcamentoConsultoriaNutricao from "./pages/nutrir/OrcamentoConsultoriaNutricao";
import PainelCustoAnalise from "./pages/nutrir/PainelCustoAnalise";
import NDVI from "./pages/nutrir/NDVI";
import ColetarAmostras from "./pages/nutrir/ColetarAmostras";
import IASolo from "./pages/ia/AnaliseSolo";
import IASintomas from "./pages/ia/Sintomas";
import Ouvidoria from "./pages/gerente/Ouvidoria";
import EquipeRegional from "./pages/gerente/EquipeRegional";
import Aprovacoes from "./pages/gerente/Aprovacoes";
import MotorOrcamentoConsultoria from "./pages/gestao/MotorOrcamentoConsultoria";
import BDClientes from "./pages/gestao/BDClientes";
import BDProdutos from "./pages/gestao/BDProdutos";
import PrecificacaoProdutos from "./pages/gestao/PrecificacaoProdutos";
import Colaboradores from "./pages/gestao/Colaboradores";
import RelatoriosRDV from "./pages/gestao/RelatoriosRDV";
import BDCulturas from "./pages/gestao/BDCulturas";
import MotorCalculos from "./pages/gestao/MotorCalculos";
import Importacoes from "./pages/gestao/Importacoes";
import Financeiro from "./pages/financeiro/Financeiro";
import CrmPipeline from "./pages/crm/CrmPipeline";
import Lotes from "./pages/estoque/Lotes";
import Romaneios from "./pages/estoque/Romaneios";
import PortalAcesso from "./pages/admin/PortalAcesso";
import PortalCliente from "./pages/PortalCliente";

import Notificacoes from "./pages/Notificacoes";
import NotFound from "./pages/NotFound";
import GeracaoDemanda from "./pages/nutrir/GeracaoDemanda";
import PainelDiretoria from "./pages/nutrir/PainelDiretoria";
import Talhoes from "./pages/representante/Talhoes";
import ClienteFicha from "./pages/representante/ClienteFicha";
import FinanceiroRep from "./pages/representante/FinanceiroRep";
import ClientesRep from "./pages/representante/ClientesRep";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PwaStatus />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/portal/:token" element={<PortalCliente />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app/financeiro" element={<ProtectedRoute><AppShell><Financeiro /></AppShell></ProtectedRoute>} />
              <Route path="/app/crm" element={<ProtectedRoute><AppShell><CrmPipeline /></AppShell></ProtectedRoute>} />
              <Route path="/app/estoque/lotes" element={<ProtectedRoute><AppShell><Lotes /></AppShell></ProtectedRoute>} />
              <Route path="/app/estoque/romaneios" element={<ProtectedRoute><AppShell><Romaneios /></AppShell></ProtectedRoute>} />
              <Route path="/app/admin/portal" element={<ProtectedRoute><AppShell><PortalAcesso /></AppShell></ProtectedRoute>} />
              <Route path="/install" element={<Install />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />

              <Route path="/app/organizacao/nova" element={<ProtectedRoute><NewOrganization /></ProtectedRoute>} />
              <Route path="/app/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              <Route path="/app" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
              <Route path="/app/mapas" element={<ProtectedRoute><AppShell><Mapas /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutricao" element={<ProtectedRoute><AppShell><Nutricao /></AppShell></ProtectedRoute>} />
              <Route path="/app/heatmap" element={<ProtectedRoute><AppShell><Heatmap /></AppShell></ProtectedRoute>} />
              <Route path="/app/ia" element={<ProtectedRoute><AppShell><IA /></AppShell></ProtectedRoute>} />
              <Route path="/app/satelite" element={<ProtectedRoute><AppShell><Satelite /></AppShell></ProtectedRoute>} />
              <Route path="/app/relatorios" element={<ProtectedRoute><AppShell><Relatorios /></AppShell></ProtectedRoute>} />
              <Route path="/app/historico" element={<ProtectedRoute><AppShell><Historico /></AppShell></ProtectedRoute>} />
              <Route path="/app/equipe" element={<ProtectedRoute><AppShell><Equipe /></AppShell></ProtectedRoute>} />
              <Route path="/app/admin/usuarios" element={<ProtectedRoute><AppShell><Usuarios /></AppShell></ProtectedRoute>} />
              <Route path="/app/organizacao" element={<ProtectedRoute><AppShell><Organizacao /></AppShell></ProtectedRoute>} />
              <Route path="/app/configuracoes" element={<ProtectedRoute><AppShell><Configuracoes /></AppShell></ProtectedRoute>} />
              <Route path="/app/billing" element={<ProtectedRoute><AppShell><Billing /></AppShell></ProtectedRoute>} />
              <Route path="/app/integracoes" element={<ProtectedRoute><AppShell><Integracoes /></AppShell></ProtectedRoute>} />
              <Route path="/app/notificacoes" element={<ProtectedRoute><AppShell><Notificacoes /></AppShell></ProtectedRoute>} />

              {/* Nutrir */}
              <Route path="/app/nutrir" element={<ProtectedRoute><AppShell><NutrirHome /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/orcamento" element={<ProtectedRoute><AppShell><OrcamentoConsultoria /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/orcamentos" element={<ProtectedRoute><AppShell><Orcamentos /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/produto/:id" element={<ProtectedRoute><AppShell><ProdutoFicha /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/clientes" element={<ProtectedRoute><AppShell><ClientesNutrir /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/produtos" element={<ProtectedRoute><AppShell><ProdutosNutrir /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/materias-primas" element={<ProtectedRoute><AppShell><MateriasPrimas /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/formulacoes" element={<ProtectedRoute><AppShell><Formulacoes /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/representantes" element={<ProtectedRoute><AppShell><Representantes /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/regionais" element={<ProtectedRoute><AppShell><Regionais /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/modalidades" element={<ProtectedRoute><AppShell><Modalidades /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/embalagens" element={<ProtectedRoute><AppShell><Embalagens /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/precos" element={<ProtectedRoute><AppShell><Precos /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/pedidos" element={<ProtectedRoute><AppShell><Pedidos /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/usuarios" element={<ProtectedRoute><AppShell><UsuariosNutrir /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/dashboard" element={<ProtectedRoute><AppShell><DashboardComercial /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/dashboard-geral" element={<ProtectedRoute><AppShell><DashboardNutrir /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/calculadora-foliar" element={<ProtectedRoute><AppShell><CalculadoraFoliar /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/historico-foliar" element={<ProtectedRoute><AppShell><HistoricoFoliar /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/calculadora-npk" element={<ProtectedRoute><AppShell><CalculadoraNPK /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/historico-npk" element={<ProtectedRoute><AppShell><HistoricoNPK /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/fontes-formulas" element={<ProtectedRoute><AppShell><FontesFormulas /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/complexadores" element={<ProtectedRoute><AppShell><Complexadores /></AppShell></ProtectedRoute>} />

              {/* Topbar — Fazendas */}
              <Route path="/app/fazendas" element={<ProtectedRoute><AppShell><Fazendas /></AppShell></ProtectedRoute>} />

              {/* Área do Representante */}
              <Route path="/app/rep" element={<ProtectedRoute><AppShell><DashboardRep /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/roteiro" element={<ProtectedRoute><AppShell><RoteiroVisitas /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/visitas" element={<ProtectedRoute><AppShell><Visitas /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/estoque-cliente" element={<ProtectedRoute><AppShell><EstoqueCliente /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/contas-receber" element={<ProtectedRoute><AppShell><ContasReceber /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/comissoes" element={<ProtectedRoute><AppShell><Comissoes /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/campos-teste" element={<ProtectedRoute><AppShell><CamposTeste /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/rdv" element={<ProtectedRoute><AppShell><RDV /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/clientes" element={<ProtectedRoute><AppShell><ClientesRep /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/clientes/:id" element={<ProtectedRoute><AppShell><ClienteFicha /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/financeiro" element={<ProtectedRoute><AppShell><FinanceiroRep /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/pedidos" element={<ProtectedRoute><AppShell><PedidosRep /></AppShell></ProtectedRoute>} />

              {/* Programa Nutrir — extras Fase 1 */}
              <Route path="/app/nutrir/orcamento-nutricao" element={<ProtectedRoute><AppShell><OrcamentoConsultoriaNutricao /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/painel-custo" element={<ProtectedRoute><AppShell><PainelCustoAnalise /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/ndvi" element={<ProtectedRoute><AppShell><NDVI /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/coleta" element={<ProtectedRoute><AppShell><ColetarAmostras /></AppShell></ProtectedRoute>} />

              {/* IA */}
              <Route path="/app/ia/solo" element={<ProtectedRoute><AppShell><IASolo /></AppShell></ProtectedRoute>} />
              <Route path="/app/ia/sintomas" element={<ProtectedRoute><AppShell><IASintomas /></AppShell></ProtectedRoute>} />

              {/* Área do Gerente */}
              <Route path="/app/gerente/dashboard" element={<ProtectedRoute><AppShell><DashboardComercial /></AppShell></ProtectedRoute>} />
              <Route path="/app/gerente/ouvidoria" element={<ProtectedRoute><AppShell><Ouvidoria /></AppShell></ProtectedRoute>} />
              <Route path="/app/gerente/equipe" element={<ProtectedRoute><AppShell><EquipeRegional /></AppShell></ProtectedRoute>} />
              <Route path="/app/gerente/aprovacoes" element={<ProtectedRoute><AppShell><Aprovacoes /></AppShell></ProtectedRoute>} />

              {/* Gestão do Programa (ADM) */}
              <Route path="/app/gestao/orcamento-consultoria" element={<ProtectedRoute><AppShell><MotorOrcamentoConsultoria /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/clientes" element={<ProtectedRoute><AppShell><BDClientes /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/produtos" element={<ProtectedRoute><AppShell><BDProdutos /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/precificacao" element={<ProtectedRoute><AppShell><PrecificacaoProdutos /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/colaboradores" element={<ProtectedRoute><AppShell><Colaboradores /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/rdv-relatorios" element={<ProtectedRoute><AppShell><RelatoriosRDV /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/culturas" element={<ProtectedRoute><AppShell><BDCulturas /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/motor-calculos" element={<ProtectedRoute><AppShell><MotorCalculos /></AppShell></ProtectedRoute>} />
              <Route path="/app/gestao/importacoes" element={<ProtectedRoute><AppShell><Importacoes /></AppShell></ProtectedRoute>} />

              {/* Novos módulos */}
              <Route path="/app/nutrir/geracao-demanda" element={<ProtectedRoute><AppShell><GeracaoDemanda /></AppShell></ProtectedRoute>} />
              <Route path="/app/nutrir/painel-diretoria" element={<ProtectedRoute><AppShell><PainelDiretoria /></AppShell></ProtectedRoute>} />
              <Route path="/app/rep/talhoes" element={<ProtectedRoute><AppShell><Talhoes /></AppShell></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
