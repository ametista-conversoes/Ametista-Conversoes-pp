import type { ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleRoute } from '@/components/auth/RoleRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { clientNavItems, managerNavItems } from '@/lib/nav-items'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ResetPassword from '@/pages/auth/ResetPassword'
import Cassie from '@/pages/client/Cassie'
import Comments from '@/pages/client/Comments'
import Files from '@/pages/client/Files'
import Leads from '@/pages/client/Leads'
import Meetings from '@/pages/client/Meetings'
import Project from '@/pages/client/Project'
import Reports from '@/pages/client/Reports'
import Tasks from '@/pages/client/Tasks'
import Home from '@/pages/Home'
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy'
import PrivacyPolicyEn from '@/pages/legal/PrivacyPolicyEn'
import TermsOfUse from '@/pages/legal/TermsOfUse'
import TermsOfUseEn from '@/pages/legal/TermsOfUseEn'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import Settings from '@/pages/Settings'
import Assets from '@/pages/admin/Assets'
import Activities from '@/pages/admin/Activities'
import AudienceInsights from '@/pages/admin/AudienceInsights'
import Catalog from '@/pages/admin/Catalog'
import ClientComments from '@/pages/admin/ClientComments'
import ClientDetail from '@/pages/admin/ClientDetail'
import Clients from '@/pages/admin/Clients'
import DashboardExecutivo from '@/pages/admin/DashboardExecutivo'
import Incidents from '@/pages/admin/Incidents'
import Kanban from '@/pages/admin/Kanban'
import ManagerCassie from '@/pages/admin/ManagerCassie'
import ManagerClientTasks from '@/pages/admin/ManagerClientTasks'
import ManagerFiles from '@/pages/admin/ManagerFiles'
import ManagerMeetings from '@/pages/admin/ManagerMeetings'
import SmartGoals from '@/pages/admin/SmartGoals'
import Timeline from '@/pages/admin/Timeline'
import Workflows from '@/pages/admin/Workflows'

// Rotas do Portal Cliente que já têm página real — as demais continuam
// com a página de exemplo até as próximas sub-fases da Fase 4.
// "/settings" é compartilhada pelos 3 papéis (ver Sidebar.tsx).
const clientPagesReady: Record<string, ComponentType> = {
  '/': Home,
  '/project': Project,
  '/reports': Reports,
  '/tasks': Tasks,
  '/files': Files,
  '/comments': Comments,
  '/meetings': Meetings,
  '/leads': Leads,
  '/cassie': Cassie,
  '/settings': Settings,
}

// Rotas do Portal Gestor que já têm página real — as demais continuam
// com a página de exemplo até as próximas sub-fases da Fase 5.
const managerPagesReady: Record<string, ComponentType> = {
  '/admin': DashboardExecutivo,
  '/clients': Clients,
  '/kanban': Kanban,
  '/client-tasks': ManagerClientTasks,
  '/workflows': Workflows,
  '/catalog': Catalog,
  '/incidents': Incidents,
  '/timeline': Timeline,
  '/assets': Assets,
  '/audiences': AudienceInsights,
  '/smart-goals': SmartGoals,
  '/activities': Activities,
  '/client-comments': ClientComments,
  '/client-meetings': ManagerMeetings,
  '/client-files': ManagerFiles,
  '/client-cassie': ManagerCassie,
}

// Rotas de "clientNavItems" compartilhadas pelos 3 papéis, fora do
// RoleRoute abaixo: "/" tem seu próprio redirecionamento por papel
// dentro de Home.tsx (envolver em RoleRoute causaria loop, já que o
// AccessDenied do RoleRoute manda de volta pra "/"); "/settings" é
// intencionalmente compartilhada pelos 3 papéis (ver Sidebar.tsx).
const CLIENT_ROUTES_SHARED_WITH_OTHER_ROLES = new Set(['/', '/settings'])

function renderNavRoute(
  item: { href: string; title: string },
  pagesReady: Record<string, ComponentType>,
  portal: 'Portal Cliente' | 'Portal Gestor',
) {
  const ReadyPage = pagesReady[item.href]
  return (
    <Route
      key={item.href}
      path={item.href}
      element={ReadyPage ? <ReadyPage /> : <PlaceholderPage title={item.title} portal={portal} />}
    />
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Públicas de propósito (sem ProtectedRoute) — precisam abrir sem
          login pro Google conseguir verificar a tela de consentimento OAuth. */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy/en" element={<PrivacyPolicyEn />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/terms/en" element={<TermsOfUseEn />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {clientNavItems
            .filter((item) => CLIENT_ROUTES_SHARED_WITH_OTHER_ROLES.has(item.href))
            .map((item) => renderNavRoute(item, clientPagesReady, 'Portal Cliente'))}
          {/* "/performance" virou uma aba de "/reports" na Fase 18 (páginas
              quase duplicadas) — mesmo padrão de redirecionamento do
              "/alerts" e "/onboarding" abaixo. */}
          <Route path="/performance" element={<Navigate to="/reports" replace />} />

          {/* Defesa em profundidade (Fase 20.2) — as telas do Portal
              Cliente já filtram os próprios dados pelo client_id de quem
              está logado, então admin/gestor sem cliente vinculado só
              veem o aviso de "conta não vinculada"; isso aqui bloqueia o
              acesso à rota antes mesmo de chegar lá. */}
          <Route element={<RoleRoute allowedRoles={['cliente']} />}>
            {clientNavItems
              .filter((item) => !CLIENT_ROUTES_SHARED_WITH_OTHER_ROLES.has(item.href))
              .map((item) => renderNavRoute(item, clientPagesReady, 'Portal Cliente'))}
          </Route>

          <Route element={<RoleRoute allowedRoles={['admin', 'gestor']} />}>
            {managerNavItems.map((item) => renderNavRoute(item, managerPagesReady, 'Portal Gestor'))}
            {/* "/status" mostra o mesmo conteúdo de "/incidents" (sem item próprio no menu) */}
            <Route path="/status" element={<Incidents />} />
            {/* "/alerts" existia separado antes da Fase 6.5.6 (Incidentes e
                Alertas viraram uma aba só) — mantido como redirecionamento
                pra quem tiver o link antigo salvo. */}
            <Route path="/alerts" element={<Navigate to="/incidents" replace />} />
            {/* "/onboarding" virou "/activities" na Fase 6.6.2 — mesmo
                padrão de redirecionamento do "/alerts" acima. */}
            <Route path="/onboarding" element={<Navigate to="/activities" replace />} />
            {/* "/integrations" virou uma sub-aba de "/assets" na Fase 34e —
                mesmo padrão de redirecionamento do "/alerts" acima. */}
            <Route path="/integrations" element={<Navigate to="/assets?tab=integracoes" replace />} />
            {/* Central de Informações do Cliente — acessada clicando num card em "/clients" */}
            <Route path="/clients/:id" element={<ClientDetail />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
