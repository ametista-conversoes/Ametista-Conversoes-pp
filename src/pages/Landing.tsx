import { ArrowRight, BarChart3, LayoutDashboard, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Relatórios de campanhas',
    description:
      'Lê, somente para leitura, campanhas, grupos de anúncios e métricas (investimento, cliques, impressões, conversões) das contas de Google Ads e Meta Ads dos clientes. O app nunca cria, edita ou exclui anúncios.',
  },
  {
    icon: UsersRound,
    title: 'Análise de leads',
    description:
      'Lê as perguntas e respostas de formulários do Google Forms compartilhados pelo cliente, para montar a análise de público e o funil de leads.',
  },
  {
    icon: LayoutDashboard,
    title: 'Portal do cliente',
    description: 'Cada cliente acessa apenas os próprios dados: desempenho, tarefas, reuniões, arquivos e comentários.',
  },
]

/** Página pública da raiz "/" — SEMPRE, mesmo já logado (ver
 * `App.tsx`: "/" não está dentro de `ProtectedRoute`). Existe por
 * exigência da verificação OAuth do Google: a homepage do app precisa
 * descrever o que ele faz e ter o link da Política de Privacidade —
 * não pode ser só a tela de login. Quem já tem sessão clica em
 * "Entrar" e vai direto pro painel (`/dashboard`, que decide o papel),
 * sem passar pelo formulário de login de novo. Visual inspirado no
 * site principal da agência (mesma paleta roxa/glow), mas mantendo o
 * design system do app (cores/raio já definidos em CLAUDE.md) — sem
 * seções novas de conteúdo, só o mesmo texto de sempre com mais
 * acabamento. */
export default function Landing() {
  const { session } = useAuth()
  const entrarHref = session ? '/dashboard' : '/login'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[#1A2540]/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ametista Conversões" className="h-9 w-9 rounded-lg" />
            <span className="font-semibold text-foreground">Ametista Conversões</span>
          </div>
          <Button asChild>
            <Link to={entrarHref}>Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Mockup do Dashboard Executivo como imagem de fundo do
              próprio cabeçalho (não mais um bloco separado ao lado do
              texto) — a imagem já tem fundo/glow roxo prontos, por isso
              o degradê por cima só precisa garantir a leitura do texto,
              sem cobrir o celular por completo. */}
          <div className="absolute inset-0">
            {/* Desfocada no mobile: nesse tamanho o texto do próprio
                dashboard (dentro da imagem) ficava embaixo do título e
                competia com ele — o blur mantém a cor/luz de fundo sem
                esse ruído. No desktop o celular fica ao lado do texto,
                então some sem blur. */}
            <img
              src="/hero-mockup.png"
              alt="Celular mostrando o Dashboard Executivo do Ametista Conversões, com métricas de MRR, clientes ativos e mais"
              className="h-full w-full object-cover object-[80%_center] blur-md md:blur-none"
            />
            <div className="absolute inset-0 bg-background/70 md:hidden" />
            <div className="absolute inset-0 hidden bg-gradient-to-r from-background via-background/85 to-background/20 md:block" />
          </div>

          <div className="relative mx-auto w-full max-w-5xl px-4 py-20 md:min-h-[560px] md:py-28">
            <div className="max-w-lg">
              <span className="inline-flex items-center rounded-full border border-purple-600/30 bg-purple-600/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-purple-400">
                Portal interno da agência
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground md:text-5xl">
                A plataforma interna da agência{' '}
                <span className="bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                  Ametista Conversões
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                Usada pela nossa agência de gestão de tráfego pago para acompanhar os projetos de cada cliente e
                reportar resultados de forma transparente, com dados reais das plataformas de anúncio.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link to={entrarHref}>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">O que a plataforma faz</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 transition-colors hover:border-purple-600/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/15">
                  <feature.icon className="h-5 w-5 text-purple-400" />
                </div>
                <h2 className="mt-4 font-semibold text-foreground">{feature.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>

          <section lang="en" className="mt-8 rounded-xl border border-[#1A2540] bg-secondary/30 p-5">
            <h2 className="font-semibold text-foreground">About (English)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ametista Conversões is the internal platform of the Ametista Conversões paid-traffic agency. It reads,
              on a read-only basis, campaign, ad group and performance data from clients' Google Ads and Meta Ads
              accounts, and the questions and responses of Google Forms shared by clients, to build performance
              reports and audience insights for each client. It never creates, edits or deletes anything in Google
              Ads. Each client can only see their own data.
            </p>
          </section>
        </section>
      </main>

      <footer className="border-t border-[#1A2540]">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Ametista Conversões · ametistaconversoes@gmail.com</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="text-purple-400 hover:underline">
              Política de Privacidade (PT)
            </Link>
            <Link to="/privacy/en" className="text-purple-400 hover:underline">
              Privacy Policy (EN)
            </Link>
            <Link to="/terms" className="text-purple-400 hover:underline">
              Termos de Uso (PT)
            </Link>
            <Link to="/terms/en" className="text-purple-400 hover:underline">
              Terms of Use (EN)
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
