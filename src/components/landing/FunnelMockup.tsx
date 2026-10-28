import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'

const STAGES = [
  { label: 'Impressões', value: '182.400', width: 100 },
  { label: 'Cliques', value: '6.930', width: 78 },
  { label: 'Leads', value: '412', width: 56 },
  { label: 'Qualificados', value: '168', width: 38 },
  { label: 'Vendas', value: '49', width: 22 },
]

const GOALS = [
  { title: 'Gerar 400 leads no mês', percent: 100, detail: '412 de 400' },
  { title: 'CPA abaixo de R$ 45', percent: 100, detail: 'R$ 38,97 · meta R$ 45' },
  { title: 'Fechar 60 vendas', percent: 82, detail: '49 de 60' },
]

/** Funil do mês + metas (dados de exemplo). As barras enchem quando a seção
 * aparece na tela. */
export function FunnelMockup() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="space-y-4 rounded-2xl border border-[#1A2540] bg-background/80 p-5 shadow-2xl shadow-purple-950/40">
      <div>
        <p className="text-sm font-semibold text-foreground">Funil do mês</p>
        <div className="mt-3 space-y-2">
          {STAGES.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{stage.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-secondary/60">
                <div
                  style={{ width: inView ? `${stage.width}%` : '0%', transitionDelay: `${index * 120}ms` }}
                  className="flex h-full items-center justify-end rounded-md bg-linear-to-r from-purple-700 to-purple-400 pr-2 transition-[width] duration-1000 ease-out"
                >
                  <span className="text-[10px] font-semibold text-white">{stage.value}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 border-t border-[#1A2540] pt-4">
        <p className="text-sm font-semibold text-foreground">Metas SMART</p>
        {GOALS.map((goal, index) => (
          <div key={goal.title}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground">{goal.title}</span>
              <span className={cn(goal.percent >= 100 ? 'text-emerald-400' : 'text-amber-400')}>{goal.percent}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary">
              <div
                style={{ width: inView ? `${goal.percent}%` : '0%', transitionDelay: `${600 + index * 150}ms` }}
                className={cn(
                  'h-1.5 rounded-full transition-[width] duration-1000 ease-out',
                  goal.percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{goal.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
