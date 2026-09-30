import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth, type UserRole } from '@/contexts/AuthContext'

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { role, loading } = useAuth()

  if (loading) return null

  if (!role || !allowedRoles.includes(role)) {
    return <AccessDenied />
  }

  return <Outlet />
}

function AccessDenied() {
  useEffect(() => {
    toast.error('Acesso negado', {
      description: 'Você não tem permissão para acessar essa página.',
    })
  }, [])

  // "/dashboard" (não "/", que agora é sempre a Landing pública) —
  // Home.tsx manda cada papel pro lugar certo (admin/gestor pra
  // "/admin", cliente fica ali mesmo), mesmo padrão de sempre.
  return <Navigate to="/dashboard" replace />
}
