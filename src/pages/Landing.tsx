import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  KeyRound,
  Lock,
  MessageCircle,
  PauseCircle,
  PlugZap,
  ShieldCheck,
  Target,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClientDashboardMockup } from '@/components/landing/ClientDashboardMockup'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

const AGENCY_SITE = 'https://www.ametistaconversoes.com'
const WHATSAPP_URL =
  'https://wa.me/559294607030?text=' +
  encodeURIComponent('Olá! Vi a página do aplicativo da Ametista Conversões e quero entender como funciona.')

const NAV = [
  { href: '#recursos', label: 'Recursos' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#seguranca', label: 'Segurança' },
  { href: '#duvidas', label: 'Dúvidas' },
]

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Investimento, receita e ROAS',
    description:
      'Métricas sincronizadas direto do Google Ads e do Meta Ads. A receita vem das vendas que você informa × seu ticket médio — sem estimativa.',
  },
  {
    icon: Target,
    title: 'Metas SMART e funil',
    description: 'Cada meta mostra se está no caminho certo, do investimento do mês ao custo por aquisição.',
  },
  {
    icon: UsersRound,
    title: 'Leads e de qual anúncio vieram',
    description:
      'Os leads do formulário do site e do Google Forms entram sozinhos, com o anúncio de origem. Você marca Novo, Qualificado, Venda ou Perdido.',
  },
  {
    icon: CalendarCheck,
    title: 'Projeto, tarefas e reuniões',
    description: 'Plano de execução de 90 dias, suas tarefas e as da equipe, e as reuniões agendadas pela plataforma.',
  },
  {
    icon: Bot,
    title: 'C.A.S.S.I.E., assistente de IA',
    description: 'Tire dúvidas sobre os seus resultados a qualquer hora.',
  },
  {
    icon: PauseCircle,
    title: 'Aprovações e Pausa de Emergência',
    description:
      'Aprove anúncios e materiais pelo app. Um botão pede a pausa das campanhas, atendida em até 1 dia útil.',
  },
]

const STEPS = [
  {
    title: 'Conectamos suas contas',
    description: 'Google Ads, Meta Ads e formulários, só com permissão de leitura.',
  },
  {
    title: 'Você acompanha',
    description: 'O dashboard é atualizado todo dia e a análise do gestor chega na frequência do seu plano.',
  },
  {
    title: 'Você informa o que só você sabe',
    description:
      'As vendas do mês e as etiquetas do WhatsApp, toda sexta (cerca de 1 minuto). É isso que fecha o funil: leads → qualificados → agendados → vendas.',
  },
]

const SECURITY = [
  { icon: ShieldCheck, title: 'Só leitura', description: 'O aplicativo nunca cria, edita ou exclui anúncios.' },
  { icon: Lock, title: 'Seus dados são só seus', description: 'Cada cliente acessa apenas os próprios dados.' },
  {
    icon: KeyRound,
    title: 'As contas são suas',
    description: 'Você tem acesso de administrador às contas de anúncio desde o 1º dia e pode pausar sem depender da gente.',
  },
]

const FAQ = [
  {
    question: 'Quem tem acesso ao aplicativo?',
    answer: 'Todo cliente da Ametista Conversões, em todos os planos, com login próprio.',
  },
  {
    question: 'O aplicativo altera minhas campanhas?',
    answer: 'Não. Ele só lê as métricas das contas de anúncio. Qualquer mudança nas campanhas é feita pela equipe, com o seu acompanhamento.',
  },
  {
    question: 'E se eu precisar pausar uma campanha?',
    answer:
      'No aplicativo há um botão de Pausa de Emergência, atendido em até 1 dia útil. Você também tem acesso de administrador às suas contas de anúncio e pode pausar na hora, sem depender da gente.',
  },
  {
    question: 'Os anúncios vão ao ar sem a minha aprovação?',
    answer:
      'Não. Nos primeiros 30 dias de anúncios no ar, nada é publicado sem a sua aprovação. Depois disso, anúncios com preços, ofertas ou promoções continuam precisando do seu ok.',
  },
]

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">{children}</p>
}

/** Página pública da raiz "/" — SEMPRE, mesmo já logado (ver
 * `App.tsx`: "/" não está dentro de `ProtectedRoute`). Nasceu por
 * exigência da verificação OAuth do Google: a homepage do app precisa
 * descrever o que ele faz (só leitura) e ter os links de Privacidade e
 * Termos — não pode sair nada disso. Fase 61: virou vitrine do aplicativo
 * para o cliente, com os textos da seção "Aplicativo Ametista" do site da
 * agência (www.ametistaconversoes.com — os planos ficam lá, não aqui). */
export default function Landing() {
  const { session } = useAuth()
  const entrarHref = session ? '/dashboard' : '/login'

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[#1A2540]/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <a href="#topo" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ametista Conversões" className="h-9 w-9 rounded-lg" />
            <span className="font-semibold text-foreground">Ametista Conversões</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>
          <Button asChild>
            <Link to={entrarHref}>Entrar</Link>
          </Button>
        </div>
      </header>

      <main id="topo" className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-purple-600/15 blur-3xl" />
          <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 px-4 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
            <div>
              <span className="inline-flex items-center rounded-full border border-purple-600/30 bg-purple-600/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-purple-400">
                Aplicativo Ametista Conversões
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground md:text-5xl md:leading-tight">
                O aplicativo da Ametista para{' '}
                <span className="bg-linear-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                  acompanhar seu crescimento.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                Todo cliente da Ametista Conversões recebe acesso ao nosso portal exclusivo. Lá você vê as métricas reais
                do Google Ads e do Meta Ads, em que etapa está o seu projeto e quais leads viraram venda. Sem planilhas
                soltas, sem relatório maquiado.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={entrarHref}>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={AGENCY_SITE}>Conhecer a Ametista</a>
                </Button>
              </div>
            </div>
            <ClientDashboardMockup />
          </div>
        </section>

        <section id="recursos" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-12">
          <SectionLabel>O que você acompanha</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Tudo do seu projeto em um lugar só</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 transition-colors hover:border-purple-600/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/15">
                  <feature.icon className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-12">
          <SectionLabel>Como funciona</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Três passos, sem planilha</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/15 text-sm font-semibold text-purple-400">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="seguranca" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-12">
          <SectionLabel>Segurança e transparência</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Seus dados e suas contas continuam seus</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {SECURITY.map((item) => (
              <div key={item.title} className="flex gap-3 rounded-xl border border-[#1A2540] bg-[#131C31] p-5">
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <PlugZap className="mr-1.5 inline h-4 w-4 text-purple-400" />
            Detalhes sobre quais dados são lidos e como são guardados na{' '}
            <Link to="/privacy" className="text-purple-400 hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section id="duvidas" className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-12">
          <SectionLabel>Dúvidas</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Perguntas frequentes</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((item) => (
              <details key={item.question} className="group rounded-xl border border-[#1A2540] bg-[#131C31] p-5">
                <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-12">
          <div className="rounded-xl border border-purple-600/30 bg-purple-600/10 p-6 text-center md:p-10">
            <h2 className="text-2xl font-semibold text-foreground">Ainda não é cliente?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Conheça os planos no site da Ametista Conversões ou tire suas dúvidas direto no WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Chamar no WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`${AGENCY_SITE}/#planos`}>Conhecer os planos</a>
              </Button>
            </div>
          </div>

          <section lang="en" className="mt-8 rounded-xl border border-[#1A2540] bg-secondary/30 p-5">
            <h2 className="font-semibold text-foreground">About (English)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ametista Conversões is the client portal of the Ametista Conversões paid-traffic agency. It reads, on a
              read-only basis, campaign, ad group and performance data from clients' Google Ads and Meta Ads accounts,
              the questions and responses of Google Forms shared by clients, and the leads sent by the forms on the
              clients' own websites, to build performance reports and audience insights for each client. It never
              creates, edits or deletes anything in Google Ads. Each client can only see their own data.
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
