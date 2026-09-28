import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

/** Layout largo e legível pras páginas públicas de Política de
 * Privacidade e Termos de Uso — diferente do `AuthLayout`, feito pra
 * caber um formulário pequeno, não texto longo. Fora de
 * `ProtectedRoute` de propósito (ver `App.tsx`): precisa abrir sem
 * login pro Google conseguir verificar a tela de consentimento OAuth. */
export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <Link to="/login" className="text-sm text-purple-400 hover:underline">
          ← Voltar
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <img src="/logo.png" alt="Ametista Conversões" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-medium text-foreground">Ametista Conversões</span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-purple-400">
          {children}
        </div>
      </div>
    </div>
  )
}
