import { useState } from 'react'
import { LogOut, Menu, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useClient } from '@/hooks/useClientPortalData'
import { planLabels, planStyles } from '@/lib/status-styles'

interface TopBarProps {
  onMenuClick: () => void
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  cliente: 'Cliente',
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, role, avatarUrl, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: client } = useClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header
      className="z-30 flex min-h-16 shrink-0 items-center gap-4 border-b border-secondary bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80 md:px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Menu do usuário"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-4 w-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground">{role ? roleLabels[role] : '—'}</p>
              {role === 'cliente' && client?.plan && (
                <Badge className={`px-1.5 py-0 text-[10px] ${planStyles[client.plan] ?? ''}`}>
                  {planLabels[client.plan] ?? client.plan}
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmOpen(true)} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair da sua conta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Você vai precisar entrar de novo pra acessar o app neste dispositivo.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
