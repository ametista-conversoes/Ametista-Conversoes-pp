import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Landing from '@/pages/Landing'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (!session) {
    // A raiz "/" é a homepage pública exigida pela verificação OAuth do
    // Google (precisa descrever o app, não pode ser só o login).
    if (location.pathname === '/') return <Landing />
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
