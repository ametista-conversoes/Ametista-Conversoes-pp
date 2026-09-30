import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  /** PT (padrão) ou EN — controla o idioma do "Voltar"/"Back" e do
   * rótulo de data, e marca `lang` no HTML pra leitor de tela/SEO. O
   * texto de cada seção continua vindo inteiro de quem chama (não dá
   * pra traduzir automaticamente). */
  lang?: 'pt' | 'en'
  /** Link pra a mesma página no outro idioma (ex: de "/privacy" pra
   * "/privacy/en"). Só o link oficial (PT) fica cadastrado na tela de
   * consentimento OAuth do Google — sem esse link cruzado, quem entra
   * por ele nunca acharia a versão em inglês sozinho. */
  altLangHref: string
  children: ReactNode
}

const COPY = {
  pt: { back: '← Voltar', updated: 'Última atualização', altLang: 'Read in English' },
  en: { back: '← Back', updated: 'Last updated', altLang: 'Ler em português' },
}

/** Layout largo e legível pras páginas públicas de Política de
 * Privacidade e Termos de Uso — diferente do `AuthLayout`, feito pra
 * caber um formulário pequeno, não texto longo. Fora de
 * `ProtectedRoute` de propósito (ver `App.tsx`): precisa abrir sem
 * login pro Google conseguir verificar a tela de consentimento OAuth. */
export function LegalPageLayout({ title, lastUpdated, lang = 'pt', altLangHref, children }: LegalPageLayoutProps) {
  const copy = COPY[lang]
  return (
    <div lang={lang} className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="flex items-center justify-between gap-3">
          {/* "/" em vez de "/login": essas páginas agora também são
              linkadas a partir da Landing pública e das Configurações de
              um usuário já logado, então "Voltar" pra tela de login nem
              sempre fazia sentido — "/" resolve certo nos dois casos
              (mostra a Landing pra quem não está logado, o painel pra
              quem está). */}
          <Link to="/" className="text-sm text-purple-400 hover:underline">
            {copy.back}
          </Link>
          <Link to={altLangHref} className="text-sm text-purple-400 hover:underline">
            {copy.altLang}
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <img src="/logo.png" alt="Ametista Conversões" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-medium text-foreground">Ametista Conversões</span>
        </div>

        <h1 className="mt-4 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.updated}: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-purple-400">
          {children}
        </div>
      </div>
    </div>
  )
}
