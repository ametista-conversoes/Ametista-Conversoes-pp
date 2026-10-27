import { CalendarDays, CircleDollarSign, Gauge, Pause, Target, TrendingUp } from 'lucide-react'

const METRICS = [
  { icon: CircleDollarSign, label: 'Investimento', value: 'R$ 59.237,53' },
  { icon: TrendingUp, label: 'Receita', value: 'R$ 319.200,00' },
  { icon: Gauge, label: 'ROAS', value: '5,4x' },
  { icon: Target, label: 'CPA', value: 'R$ 38,97' },
]

const GOALS = [
  { title: 'Manter ROAS acima de 4,5', detail: '5,4 de 4,5 (100%)', percent: 100 },
  { title: 'CPA médio abaixo de R$ 45', detail: 'R$ 38,97 · meta R$ 45 (100%)', percent: 100 },
]

/** Celular com o Dashboard do Portal do Cliente, montado em código (mesma
 * ilustração da seção "Aplicativo Ametista" do site da agência) — dados de
 * exemplo, só decorativo. */
export function ClientDashboardMockup() {
  return (
    <figure className="relative mx-auto w-full max-w-[300px]">
      <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-purple-600/25 blur-3xl" />
      <div
        role="img"
        aria-label="Celular mostrando o Dashboard do Portal do Cliente da Ametista Conversões, com investimento, receita, ROAS, CPA, metas e próximas reuniões"
        className="relative rounded-[2.5rem] border border-purple-400/30 bg-[#05080F] p-2.5 shadow-2xl shadow-purple-900/40"
      >
        <div className="relative overflow-hidden rounded-[2rem] bg-background px-3.5 pb-5 pt-9">
          <div aria-hidden="true" className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Portal Cliente</p>
              <p className="text-sm font-semibold text-foreground">Dashboard</p>
            </div>
            <span className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[9px] font-medium text-white">
              <Pause className="h-2.5 w-2.5" />
              Pausa de Emergência
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {METRICS.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-[#1A2540] bg-[#131C31] p-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-600/15">
                  <metric.icon className="h-3 w-3 text-purple-400" />
                </span>
                <p className="mt-1.5 text-[9px] text-muted-foreground">{metric.label}</p>
                <p className="text-[11px] font-semibold text-foreground">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2 rounded-lg border border-[#1A2540] bg-[#131C31] p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <Target className="h-3 w-3 text-purple-400" />
              Objetivos &amp; metas
            </p>
            {GOALS.map((goal) => (
              <div key={goal.title} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[9px]">
                  <span className="text-foreground">{goal.title}</span>
                  <span className="shrink-0 text-emerald-400">No caminho certo</span>
                </div>
                <div className="h-1 rounded-full bg-secondary">
                  <div className="h-1 rounded-full bg-purple-500" style={{ width: `${goal.percent}%` }} />
                </div>
                <p className="text-[8px] text-muted-foreground">{goal.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-lg border border-[#1A2540] bg-[#131C31] p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              <CalendarDays className="h-3 w-3 text-purple-400" />
              Próximas reuniões
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-medium text-foreground">Reunião semanal</p>
                <p className="text-[8px] text-muted-foreground">12/10/2026, 11:00</p>
              </div>
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[8px] text-sky-400">
                Agendada
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="relative mt-3 text-center text-xs text-muted-foreground">
        Imagem ilustrativa · dados de exemplo
      </figcaption>
    </figure>
  )
}
