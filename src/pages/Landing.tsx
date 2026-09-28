import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Página pública da raiz "/" para quem NÃO está logado (ver
 * ProtectedRoute.tsx). Existe por exigência da verificação OAuth do
 * Google: a homepage do app precisa descrever o que ele faz e ter o link
 * da Política de Privacidade — não pode ser só a tela de login. */
export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Ametista Conversões" className="h-9 w-9 rounded-lg" />
          <span className="font-semibold text-foreground">Ametista Conversões</span>
        </div>
        <Button asChild>
          <Link to="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 md:py-16">
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          A plataforma interna da agência Ametista Conversões
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Usada pela nossa agência de gestão de tráfego pago para acompanhar os projetos de cada cliente e reportar
          resultados de forma transparente, com dados reais das plataformas de anúncio.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 p-5">
            <h2 className="font-semibold text-foreground">Relatórios de campanhas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Lê, somente para leitura, campanhas, grupos de anúncios e métricas (investimento, cliques, impressões,
              conversões) das contas de Google Ads e Meta Ads dos clientes. O app nunca cria, edita ou exclui anúncios.
            </p>
          </div>
          <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 p-5">
            <h2 className="font-semibold text-foreground">Análise de leads</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Lê as perguntas e respostas de formulários do Google Forms compartilhados pelo cliente, para montar a
              análise de público e o funil de leads.
            </p>
          </div>
          <div className="rounded-lg border border-purple-600/20 bg-purple-600/5 p-5">
            <h2 className="font-semibold text-foreground">Portal do cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cada cliente acessa apenas os próprios dados: desempenho, tarefas, reuniões, arquivos e comentários.
            </p>
          </div>
        </div>

        <section lang="en" className="mt-12 rounded-lg border border-border p-5">
          <h2 className="font-semibold text-foreground">About (English)</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ametista Conversões is the internal platform of the Ametista Conversões paid-traffic agency. It reads, on a
            read-only basis, campaign, ad group and performance data from clients' Google Ads and Meta Ads accounts, and
            the questions and responses of Google Forms shared by clients, to build performance reports and audience
            insights for each client. It never creates, edits or deletes anything in Google Ads. Each client can only see
            their own data.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
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
