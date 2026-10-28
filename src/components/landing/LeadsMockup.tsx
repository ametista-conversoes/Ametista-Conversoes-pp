import { Bell, Megaphone } from 'lucide-react'

const LEADS = [
  { name: 'Mariana Costa', time: 'há 2 min', ad: '#014 | VID | Antes e depois | v2', status: 'Novo', style: 'border-sky-500/20 bg-sky-500/10 text-sky-400' },
  { name: 'Rafael Lima', time: 'há 1 h', ad: '#009 | CAR | Prova social | v1', status: 'Qualificado', style: 'border-amber-500/20 bg-amber-500/10 text-amber-400' },
  { name: 'Juliana Alves', time: 'ontem', ad: '#014 | VID | Antes e depois | v2', status: 'Venda', style: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
]

/** Aba Leads do Portal do Cliente (dados de exemplo): cada lead com o anúncio
 * de onde veio e o status do funil. */
export function LeadsMockup() {
  return (
    <div className="relative">
      <div className="absolute -right-2 -top-5 z-10 flex animate-float items-center gap-2 rounded-xl border border-purple-500/30 bg-[#131C31]/95 px-3 py-2 shadow-lg shadow-purple-900/30 backdrop-blur-sm">
        <Bell className="h-4 w-4 text-purple-400" />
        <div>
          <p className="text-xs font-semibold text-foreground">Novo lead do site</p>
          <p className="text-[10px] text-muted-foreground">Formulário da landing page</p>
        </div>
      </div>
      <div className="space-y-2.5 rounded-2xl border border-[#1A2540] bg-background/80 p-4 shadow-2xl shadow-purple-950/40">
        <p className="text-sm font-semibold text-foreground">Leads</p>
        {LEADS.map((lead) => (
          <div key={lead.name} className="rounded-xl border border-[#1A2540] bg-[#131C31] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600/20 text-[11px] font-semibold text-purple-300">
                  {lead.name[0]}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground">{lead.name}</p>
                  <p className="text-[10px] text-muted-foreground">Formulário do site · {lead.time}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${lead.style}`}>{lead.status}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1 text-[10px] text-purple-300">
              <Megaphone className="h-3 w-3 shrink-0" />
              {lead.ad}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
