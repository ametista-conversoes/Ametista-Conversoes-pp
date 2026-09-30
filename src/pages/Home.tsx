import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Dashboard from '@/pages/client/Dashboard'

/** "/dashboard" é o destino padrão pós-login (Login.tsx/Register.tsx) e
 * o alvo de "Acesso negado" do RoleRoute — precisa decidir por papel:
 * cliente vê o próprio Dashboard; admin/gestor não têm client_id
 * nenhum, então são mandados pra própria home deles (/admin) em vez de
 * caírem no aviso de "conta não vinculada" do Portal Cliente. "/" em
 * si é a Landing pública (fora do login), sempre — ver `Landing.tsx`. */
export default function Home() {
  const { role, loading } = useAuth()

  if (loading) return null
  if (role === 'admin' || role === 'gestor') return <Navigate to="/admin" replace />
  return <Dashboard />
}
