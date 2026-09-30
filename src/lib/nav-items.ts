import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calendar,
  CheckSquare,
  Columns3,
  FileText,
  FolderKanban,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  UserPlus,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

export const clientNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Projeto', href: '/project', icon: FolderKanban },
  { title: 'Tarefas', href: '/tasks', icon: CheckSquare },
  { title: 'Arquivos', href: '/files', icon: FileText },
  { title: 'Comentários', href: '/comments', icon: MessageSquare },
  { title: 'Reuniões', href: '/meetings', icon: Calendar },
  { title: 'Leads', href: '/leads', icon: UserPlus },
  { title: 'Cassie IA', href: '/cassie', icon: Sparkles },
  { title: 'Relatórios', href: '/reports', icon: BarChart3 },
  { title: 'Configurações', href: '/settings', icon: Settings },
]

// Ordem pedida pelo usuário (Fase 34e): Metas SMART e Atividades logo
// abaixo de Kanban; Ativos Digitais logo abaixo de Tarefas do Cliente
// (7º item); Timeline por último, abaixo de Cassie IA. "Integrações"
// não tem mais item próprio — virou sub-aba dentro de "Ativos Digitais".
export const managerNavItems: NavItem[] = [
  { title: 'Dashboard Executivo', href: '/admin', icon: LayoutDashboard },
  { title: 'Clientes', href: '/clients', icon: Users },
  { title: 'Kanban', href: '/kanban', icon: Columns3 },
  { title: 'Metas SMART', href: '/smart-goals', icon: Target },
  { title: 'Atividades', href: '/activities', icon: ListChecks },
  { title: 'Tarefas do Cliente', href: '/client-tasks', icon: CheckSquare },
  { title: 'Ativos Digitais', href: '/assets', icon: Boxes },
  { title: 'Workflows', href: '/workflows', icon: Workflow },
  { title: 'Catálogo', href: '/catalog', icon: Layers },
  { title: 'Incidentes e Alertas', href: '/incidents', icon: AlertTriangle },
  { title: 'Públicos-Alvo', href: '/audiences', icon: UsersRound },
  { title: 'Comentários', href: '/client-comments', icon: MessageSquare },
  { title: 'Reuniões', href: '/client-meetings', icon: Calendar },
  { title: 'Arquivos', href: '/client-files', icon: FileText },
  { title: 'Cassie IA', href: '/client-cassie', icon: Sparkles },
  { title: 'Timeline', href: '/timeline', icon: History },
]
