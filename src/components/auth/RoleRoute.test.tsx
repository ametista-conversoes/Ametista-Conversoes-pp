import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RoleRoute } from '@/components/auth/RoleRoute'
import { useAuth, type UserRole } from '@/contexts/AuthContext'

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('@/contexts/AuthContext')>('@/contexts/AuthContext')
  return { ...actual, useAuth: vi.fn() }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const mockedUseAuth = vi.mocked(useAuth)

function renderProtectedRoute(role: UserRole | null, allowedRoles: UserRole[], loading = false) {
  mockedUseAuth.mockReturnValue({
    role,
    loading,
    user: null,
    session: null,
    clientId: null,
    fullName: null,
    phone: null,
    avatarUrl: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    sendPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    refreshProfile: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/dashboard" element={<div>Página inicial</div>} />
        <Route element={<RoleRoute allowedRoles={allowedRoles} />}>
          <Route path="/admin" element={<div>Conteúdo do gestor</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoleRoute', () => {
  it('deixa passar um papel permitido (gestor)', () => {
    renderProtectedRoute('gestor', ['admin', 'gestor'])
    expect(screen.getByText('Conteúdo do gestor')).toBeInTheDocument()
  })

  it('bloqueia o papel cliente de uma rota do gestor e redireciona pra home', () => {
    renderProtectedRoute('cliente', ['admin', 'gestor'])
    expect(screen.queryByText('Conteúdo do gestor')).not.toBeInTheDocument()
    expect(screen.getByText('Página inicial')).toBeInTheDocument()
  })

  it('não renderiza nada enquanto ainda está carregando o papel do usuário', () => {
    const { container } = renderProtectedRoute(null, ['admin', 'gestor'], true)
    expect(container).toBeEmptyDOMElement()
  })
})
