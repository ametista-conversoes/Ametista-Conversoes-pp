import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNavActivity } from '@/hooks/useClientPortalData'
import { useManagerNavActivity } from '@/hooks/useManagerPortalData'
import { computeUnseenNavHrefs, useNavLastSeen } from '@/hooks/useNavSeen'
import { clientNavItems, managerNavItems, type NavItem } from '@/lib/nav-items'
import { cn } from '@/lib/utils'

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors',
    'hover:bg-secondary hover:text-foreground',
    isActive && 'bg-purple-600/15 text-purple-400 border border-purple-600/20',
  )
}

function NavSection({
  label,
  items,
  onNavigate,
  unseenHrefs,
}: {
  label: string
  items: NavItem[]
  onNavigate?: () => void
  unseenHrefs: Set<string>
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/dashboard' || item.href === '/admin'}
          onClick={onNavigate}
          className={navLinkClassName}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.title}
          {unseenHrefs.has(item.href) && (
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-purple-500" aria-label="Novidade" />
          )}
        </NavLink>
      ))}
    </div>
  )
}

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth()
  const showClientSection = role === 'cliente'
  const showManagerSection = role === 'gestor' || role === 'admin'

  const { data: lastSeen } = useNavLastSeen()
  const { data: clientActivity } = useNavActivity(showClientSection)
  const { data: managerActivity } = useManagerNavActivity(showManagerSection)
  const unseenHrefs = new Set([
    ...computeUnseenNavHrefs(clientActivity, lastSeen),
    ...computeUnseenNavHrefs(managerActivity, lastSeen),
  ])

  // "Configurações" fica fora das seções de cada portal e sempre aparece,
  // porque a tela é compartilhada pelos 3 papéis (com abas diferentes).
  const settingsItem = clientNavItems.find((item) => item.href === '/settings')
  const clientItems = clientNavItems.filter((item) => item.href !== '/settings')

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <img src="/logo.png" alt="Ametista Conversões" className="h-8 w-8 shrink-0 rounded-lg" />
        <span className="text-sm font-semibold text-foreground">Ametista Conversões</span>
      </div>
      <nav className="flex flex-1 flex-col justify-between overflow-y-auto px-3 pb-6">
        <div className="space-y-6">
          {showClientSection && (
            <NavSection label="Portal Cliente" items={clientItems} onNavigate={onNavigate} unseenHrefs={unseenHrefs} />
          )}
          {showManagerSection && (
            <NavSection
              label="Portal Gestor"
              items={managerNavItems}
              onNavigate={onNavigate}
              unseenHrefs={unseenHrefs}
            />
          )}
        </div>
        {settingsItem && (
          <div className="space-y-1 border-t border-secondary pt-3">
            <NavLink to={settingsItem.href} onClick={onNavigate} className={navLinkClassName}>
              <settingsItem.icon className="h-4 w-4 shrink-0" />
              {settingsItem.title}
            </NavLink>
          </div>
        )}
      </nav>
    </div>
  )
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn('hidden w-64 shrink-0 border-r border-secondary bg-card md:block md:h-dvh', className)}
    >
      <SidebarContent />
    </aside>
  )
}
