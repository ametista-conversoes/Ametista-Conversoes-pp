import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Check,
  ChevronDown,
  FileCheck2,
  FileText,
  KeyRound,
  Lock,
  MessageCircle,
  PauseCircle,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CassieMockup } from '@/components/landing/CassieMockup'
import { CountUp } from '@/components/landing/CountUp'
import { FunnelMockup } from '@/components/landing/FunnelMockup'
import { LeadsMockup } from '@/components/landing/LeadsMockup'
import { Reveal } from '@/components/landing/Reveal'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

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

const SOURCES = ['Google Ads', 'Meta Ads', 'Google Forms', 'Formulário do site', 'WhatsApp Business', 'C.A.S.S.I.E.', 'Metas SMART', 'Relatório mensal']

const SHOWCASE = [
  {
    eyebrow: 'Leads',
    title: 'Saiba de qual anúncio veio cada lead',
    text: 'Os leads do formulário do seu site e do Google Forms entram sozinhos no aplicativo, com o anúncio e a campanha de origem. Você marca o andamento de cada um e o funil se atualiza.',
    bullets: ['Aviso na hora de cada lead novo', 'Status Novo, Qualificado, Venda ou Perdido', 'Anúncio e campanha de origem em cada lead'],
    visual: <LeadsMockup />,
  },
  {
    eyebrow: 'Funil e metas',
    title: 'Do clique à venda, com metas que se atualizam sozinhas',
    text: 'Impressões, cliques, leads, qualificados e vendas num funil só. As Metas SMART são recalculadas a cada hora com os dados das contas de anúncio e as vendas que você informa.',
    bullets: ['Receita = vendas informadas × seu ticket médio', 'ROAS e CPA reais do mês', 'Etiquetas do WhatsApp contadas toda sexta'],
    visual: <FunnelMockup />,
  },
  {
    eyebrow: 'Inteligência artificial',
    title: 'Pergunte à C.A.S.S.I.E. sobre os seus resultados',
    text: 'A assistente de IA conhece as métricas, as metas e as análises do seu projeto. Pergunte em português, a qualquer hora, sem esperar a próxima reunião.',
    bullets: ['Explica variações de custo e resultado', 'Usa os dados reais do seu projeto', 'Modos conforme o seu plano'],
    visual: <CassieMockup />,
  },
]

const STATS = [
  { to: 90, suffix: ' dias', label: 'de plano de execução, com atividades, metas e reuniões' },
  { to: 2, suffix: 'x', label: 'por semana a equipe revisa as campanhas' },
  { to: 1, suffix: ' dia útil', label: 'para atender um pedido de Pausa de Emergência' },
  { to: 24, suffix: 'h', label: 'de C.A.S.S.I.E. disponível para tirar dúvidas' },
]

const MORE = [
  { icon: CalendarCheck, title: 'Projeto, tarefas e reuniões', text: 'Em que etapa está o projeto e o que vem a seguir.' },
  { icon: FileCheck2, title: 'Aprovações', text: 'Aprove anúncios e materiais com um clique.' },
  { icon: PauseCircle, title: 'Pausa de Emergência', text: 'Um botão para pedir a pausa das campanhas.' },
  { icon: FileText, title: 'Relatório mensal em PDF', text: 'Investimento, leads, vendas e ROAS do mês.' },
]

const STEPS = [
  { title: 'Conectamos suas contas', text: 'Google Ads, Meta Ads e formulários, só com permissão de leitura.' },
  { title: 'Você acompanha', text: 'Dashboard atualizado todo dia e análise do gestor na frequência do seu plano.' },
  { title: 'Você informa o que só você sabe', text: 'As vendas do mês e as etiquetas do WhatsApp, em cerca de 1 minuto por semana.' },
  { title: 'A gente otimiza', text: 'Com o funil completo, as decisões saem dos dados, não de achismo.' },
]

const SECURITY = [
  { icon: ShieldCheck, title: 'Só leitura', text: 'O aplicativo nunca cria, edita ou exclui anúncios.' },
  { icon: Lock, title: 'Seus dados são só seus', text: 'Cada cliente acessa apenas os próprios dados.' },
  { icon: KeyRound, title: 'As contas são suas', text: 'Acesso de administrador às suas contas de anúncio desde o 1º dia.' },
]

const FAQ = [
  { question: 'Quem tem acesso ao aplicativo?', answer: 'Todo cliente da Ametista Conversões, em todos os planos, com login próprio.' },
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

function Eyebrow({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">{children}</p>
}

/** Página pública da raiz "/" — SEMPRE, mesmo já logado (ver
 * `App.tsx`: "/" não está dentro de `ProtectedRoute`). Nasceu por
 * exigência da verificação OAuth do Google: a homepage do app precisa
 * descrever o que ele faz (só leitura) e ter os links de Privacidade e
 * Termos — não pode sair nada disso. Fase 61: vitrine do aplicativo para o
 * cliente, com os textos do site da agência (www.ametistaconversoes.com —
 * os planos ficam lá, não aqui): hero com o celular, faixa animada,
 * seções alternadas com telas do app em código, números, linha do tempo,
 * segurança e dúvidas. Animações respeitam "menos movimento" do sistema. */
export default function Landing() {
  const { session } = useAuth()
  const entrarHref = session ? '/dashboard' : '/login'

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-20 border-b border-[#1A2540]/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <a href="#topo" className="flex items-center gap-3">
            <img src="/logo.png" alt="Ametista Conversões" className="h-9 w-9 rounded-lg" />
            <span className="font-semibold text-foreground">Ametista Conversões</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
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
        {/* Hero — celular com o app como imagem de fundo do próprio
            cabeçalho; o degradê garante a leitura do texto. No celular a
            imagem fica desfocada pra não competir com o título. */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/hero-mockup.png"
              alt="Celular com o aplicativo Ametista Conversões aberto"
              className="h-full w-full object-cover object-[80%_center] blur-md md:blur-none"
            />
            <div className="absolute inset-0 bg-background/70 md:hidden" />
            <div className="absolute inset-0 hidden bg-linear-to-r from-background via-background/85 to-background/10 md:block" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background to-transparent" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 md:min-h-[620px] md:py-28">
            <div className="max-w-xl">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-purple-600/30 bg-purple-600/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-purple-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
                  Aplicativo Ametista Conversões
                </span>
              </Reveal>
              <Reveal delay={100}>
                <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground md:text-6xl md:leading-[1.05]">
                  O aplicativo da Ametista para{' '}
                  <span className="bg-linear-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                    acompanhar seu crescimento.
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={200}>
                <p className="mt-5 text-base text-muted-foreground md:text-lg">
                  Métricas reais do Google Ads e do Meta Ads, a etapa do seu projeto e quais leads viraram venda. Sem
                  planilhas soltas, sem relatório maquiado.
                </p>
              </Reveal>
              <Reveal delay={300}>
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
              </Reveal>
            </div>

            {/* Selos flutuando por cima do celular (só no computador). */}
            <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
              <div className="absolute right-[34%] top-24 flex animate-float items-center gap-2 rounded-xl border border-purple-500/30 bg-[#131C31]/90 px-3 py-2 shadow-lg shadow-purple-900/40 backdrop-blur-sm">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-[10px] text-muted-foreground">ROAS do mês</p>
                  <p className="text-sm font-semibold text-foreground">5,4x</p>
                </div>
              </div>
              <div className="absolute bottom-24 right-[6%] flex animate-float-slow items-center gap-2 rounded-xl border border-purple-500/30 bg-[#131C31]/90 px-3 py-2 shadow-lg shadow-purple-900/40 backdrop-blur-sm">
                <Bell className="h-4 w-4 text-purple-400" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Agora</p>
                  <p className="text-sm font-semibold text-foreground">Novo lead do site</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faixa animada com o que o app reúne. */}
        <section aria-label="O que o aplicativo reúne" className="border-y border-[#1A2540] bg-[#131C31]/40 py-5">
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-marquee gap-3">
              {[...SOURCES, ...SOURCES].map((source, index) => (
                <span
                  key={`${source}-${index}`}
                  aria-hidden={index >= SOURCES.length}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#1A2540] bg-background px-4 py-1.5 text-sm text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  {source}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Seções alternadas: texto de um lado, tela do app do outro. */}
        <section id="recursos" className="mx-auto w-full max-w-6xl scroll-mt-20 space-y-24 px-4 py-20 md:space-y-32 md:py-28">
          {SHOWCASE.map((item, index) => (
            <div key={item.title} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <Reveal className={cn(index % 2 === 1 && 'md:order-2')}>
                <Eyebrow>{item.eyebrow}</Eyebrow>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground md:text-4xl">{item.title}</h2>
                <p className="mt-4 text-muted-foreground">{item.text}</p>
                <ul className="mt-6 space-y-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600/20">
                        <Check className="h-3 w-3 text-purple-300" />
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={150} className={cn('relative', index % 2 === 1 && 'md:order-1')}>
                <div aria-hidden="true" className="absolute inset-6 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="relative">{item.visual}</div>
              </Reveal>
            </div>
          ))}
        </section>

        {/* Números. */}
        <section className="relative overflow-hidden border-y border-[#1A2540] bg-linear-to-br from-purple-950/40 via-background to-background py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 100} className="border-l-2 border-purple-500/40 pl-5">
                <p className="text-4xl font-semibold text-foreground">
                  <CountUp to={stat.to} suffix={stat.suffix} />
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* E mais — lista com ícones, sem caixas. */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <Reveal>
            <Eyebrow>E ainda</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">Tudo do seu projeto em um lugar só</h2>
          </Reveal>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <item.icon className="h-7 w-7 text-purple-400" />
                <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Linha do tempo. */}
        <section id="como-funciona" className="scroll-mt-20 bg-[#131C31]/40 py-20">
          <div className="mx-auto w-full max-w-6xl px-4">
            <Reveal>
              <Eyebrow>Como funciona</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold text-foreground">Do primeiro acesso à otimização</h2>
            </Reveal>
            <div className="relative mt-12">
              <div
                aria-hidden="true"
                className="absolute bottom-5 left-5 top-5 w-px bg-linear-to-b from-purple-500 to-purple-900 md:bottom-auto md:right-5 md:h-px md:w-auto md:bg-linear-to-r"
              />
              <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="relative pl-16 md:pl-0">
                    <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/50 bg-background text-sm font-semibold text-purple-300 shadow-[0_0_20px] shadow-purple-600/40 md:relative">
                      {index + 1}
                    </span>
                    <Reveal delay={index * 120}>
                      <h3 className="font-semibold text-foreground md:mt-5">{step.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Segurança — visual de um lado, garantias do outro. */}
        <section id="seguranca" className="mx-auto grid w-full max-w-6xl scroll-mt-20 items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <Reveal className="relative mx-auto flex h-64 w-64 items-center justify-center md:h-80 md:w-80">
            <span className="absolute inset-0 animate-ping rounded-full border border-purple-500/20 [animation-duration:3s] motion-reduce:animate-none" />
            <span className="absolute inset-6 rounded-full border border-purple-500/25" />
            <span className="absolute inset-14 rounded-full border border-purple-500/35 bg-purple-600/5" />
            <span className="absolute inset-24 rounded-full bg-purple-600/20 blur-xl" />
            <ShieldCheck className="relative h-20 w-20 text-purple-300" />
          </Reveal>
          <div>
            <Reveal>
              <Eyebrow>Segurança e transparência</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-foreground md:text-4xl">
                Seus dados e suas contas continuam seus
              </h2>
            </Reveal>
            <div className="mt-8 space-y-6">
              {SECURITY.map((item, index) => (
                <Reveal key={item.title} delay={index * 100} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-600/15">
                    <item.icon className="h-5 w-5 text-purple-400" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Quais dados são lidos e como são guardados:{' '}
              <Link to="/privacy" className="text-purple-400 hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Dúvidas. */}
        <section id="duvidas" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 pb-20">
          <Reveal className="text-center">
            <Eyebrow>Dúvidas</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">Perguntas frequentes</h2>
          </Reveal>
          <div className="mt-10 divide-y divide-[#1A2540] border-y border-[#1A2540]">
            {FAQ.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-purple-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Chamada final. */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-purple-600/30 bg-linear-to-br from-purple-700/40 via-purple-900/30 to-background px-6 py-12 text-center md:py-16">
              <div aria-hidden="true" className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-500/30 blur-3xl" />
              <h2 className="relative text-3xl font-semibold text-foreground md:text-4xl">Ainda não é cliente?</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-muted-foreground">
                Conheça os planos no site da Ametista Conversões ou tire suas dúvidas direto no WhatsApp.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
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
          </Reveal>

          <section lang="en" className="mt-10 rounded-xl border border-[#1A2540] bg-secondary/30 p-5">
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
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
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
