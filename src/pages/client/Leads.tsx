import { useState } from 'react'
import { differenceInMinutes, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Info, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ManualLeadsDialog } from '@/components/leads/ManualLeadsDialog'
import { UnlinkedClientNotice } from '@/components/shared/UnlinkedClientNotice'
import { useAuth } from '@/contexts/AuthContext'
import {
  LEADS_PAGE_SIZE,
  useLeadQuestions,
  useLeads,
  useSetLeadStatus,
  useSetLeadsStatusBulk,
  type LeadStatus,
} from '@/hooks/useClientPortalData'
import { monthStartIso } from '@/hooks/useMonthlySales'
import { useMarkNavSeen } from '@/hooks/useNavSeen'
import { formatDateTime, getTodayIsoDate } from '@/lib/format'
import { leadSourceLabels, leadStatusLabels, leadStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const FILTERS = ['todos', 'novo', 'qualificado', 'venda', 'perdido'] as const
type Filter = (typeof FILTERS)[number]

// Fase 60 — filtro por origem (formulário do site x Google Forms).
const SOURCE_FILTERS = ['todas', 'site_form', 'google_forms'] as const
type SourceFilter = (typeof SOURCE_FILTERS)[number]

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['novo', 'qualificado', 'venda', 'perdido']

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Mês atual e os 11 anteriores. */
function recentMonths(): { value: string; label: string }[] {
  const [year, month] = getTodayIsoDate().split('-').map(Number)
  return Array.from({ length: 12 }, (_, back) => {
    const d = new Date(year, month - 1 - back, 1)
    return {
      value: monthStartIso(d.getFullYear(), d.getMonth() + 1),
      label: `${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}${back === 0 ? ' (atual)' : ''}`,
    }
  })
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick}>
      <Badge
        className={
          active ? 'border-purple-600/20 bg-purple-600/15 text-purple-400' : 'border-[#1A2540] bg-secondary/50 text-muted-foreground'
        }
      >
        {children}
      </Badge>
    </button>
  )
}

/** Fase 35, Parte 2 — cada resposta de formulário (Google Forms ou, desde a
 * Fase 60, o formulário do site) aparece aqui como lead, com status
 * Novo/Qualificado/Venda/Perdido. Fase 63: marcar o status é OPCIONAL — o
 * funil, as vendas e a meta de qualificados vêm das "Etiquetas da semana".
 * Para aguentar volume: um mês por vez, 50 por página, filtros no banco e
 * marcação de vários leads de uma vez. */
export default function Leads() {
  useMarkNavSeen('/leads')
  const { clientId } = useAuth()
  const months = recentMonths()
  const [month, setMonth] = useState(months[0].value)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Filter>('todos')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('todas')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading, isFetching } = useLeads({
    month,
    page,
    status: filter === 'todos' ? null : filter,
    source: sourceFilter === 'todas' ? null : sourceFilter,
  })
  const leads = data?.leads ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE))
  const connectionIds = Array.from(new Set(leads.map((l) => l.connection_id)))
  const { data: questions } = useLeadQuestions(connectionIds)
  const setStatus = useSetLeadStatus()
  const setStatusBulk = useSetLeadsStatusBulk()

  if (!clientId) {
    return <UnlinkedClientNotice page="Leads" />
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const questionTitles = new Map((questions ?? []).map((q) => [`${q.connection_id}|${q.external_question_id}`, q.title]))
  const allOnPageSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))

  // Trocar mês, filtro ou página volta pra página 1 (menos a página) e limpa a seleção.
  function resetWith(update: () => void, keepPage = false) {
    update()
    if (!keepPage) setPage(0)
    setSelected(new Set())
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function markSelected(status: LeadStatus) {
    try {
      await setStatusBulk.mutateAsync({ responseIds: [...selected], status })
      setSelected(new Set())
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Portal Cliente</p>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quem chegou pelos formulários (site e Google Forms) e de qual anúncio veio.
          </p>
        </div>
        {clientId && (
          <ManualLeadsDialog
            clientId={clientId}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <UserPlus className="h-4 w-4" />
                Registrar lead manual
              </Button>
            }
          />
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-purple-600/20 bg-purple-600/10 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Marcar o status de cada lead é opcional.</span> O funil, as vendas e
          a meta de qualificados vêm das <span className="text-foreground">Etiquetas da semana</span> que você registra no
          Dashboard toda sexta. Use esta aba para ver quem chegou e, se quiser, marcar vários leads de uma vez.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={(next) => resetWith(() => setMonth(next))}>
          <SelectTrigger aria-label="Mês dos leads" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} lead(s) no mês com esses filtros</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((status) => (
            <FilterChip key={status} active={filter === status} onClick={() => resetWith(() => setFilter(status))}>
              {status === 'todos' ? 'Todos' : leadStatusLabels[status]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Origem:</span>
          {SOURCE_FILTERS.map((source) => (
            <FilterChip key={source} active={sourceFilter === source} onClick={() => resetWith(() => setSourceFilter(source))}>
              {source === 'todas' ? 'Todas' : leadSourceLabels[source]}
            </FilterChip>
          ))}
        </div>
      </div>

      {leads.length > 0 && (
        <div
          role="toolbar"
          aria-label="Marcar leads selecionados"
          className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-[#1A2540] bg-[#131C31]/95 px-3 py-2 backdrop-blur-sm"
        >
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allOnPageSelected}
              onCheckedChange={(checked) => setSelected(checked ? new Set(leads.map((l) => l.id)) : new Set())}
              aria-label="Selecionar todos desta página"
            />
            Selecionar todos desta página
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-foreground">{selected.size} selecionado(s) — marcar como:</span>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={setStatusBulk.isPending}
                  onClick={() => markSelected(status)}
                >
                  {leadStatusLabels[status]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {leads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filter === 'todos' && sourceFilter === 'todas' ? 'Nenhum lead neste mês.' : 'Nenhum lead com esses filtros neste mês.'}
        </p>
      )}

      <div className={cn('space-y-2', isFetching && 'opacity-60')}>
        {leads.map((lead) => (
          <Card key={lead.id} className="rounded-xl border border-[#1A2540] bg-[#131C31] p-4 hover:border-purple-600/30">
            <CardContent className="space-y-2 p-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} aria-label="Selecionar lead" />
                  <p className="text-xs text-muted-foreground">{formatDateTime(lead.submitted_at)}</p>
                  <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                    {leadSourceLabels[lead.source] ?? lead.source}
                  </Badge>
                  {/* Só no dia em que o lead chegou: em lead antigo o aviso é ruído. */}
                  {lead.status === 'novo' &&
                    lead.submitted_at &&
                    isToday(new Date(lead.submitted_at)) &&
                    differenceInMinutes(new Date(), new Date(lead.submitted_at)) > 15 && (
                      <span className="text-xs font-medium text-amber-400">Passou de 15 min sem resposta</span>
                    )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={setStatus.isPending}>
                    <Badge className={cn('cursor-pointer', leadStatusStyles[lead.status])}>
                      {leadStatusLabels[lead.status]}
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {LEAD_STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem key={status} onSelect={() => setStatus.mutate({ responseId: lead.id, status })}>
                        {leadStatusLabels[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {(lead.utm_content || lead.utm_campaign) && (
                <div className="rounded-md bg-secondary/50 px-2 py-1.5 text-xs">
                  <span className="text-muted-foreground">Anúncio: </span>
                  <span className="text-purple-300">{lead.utm_content ?? '—'}</span>
                  {lead.utm_campaign && <span className="text-muted-foreground"> · Campanha: {lead.utm_campaign}</span>}
                  {lead.utm_source && <span className="text-muted-foreground"> · {lead.utm_source}</span>}
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                {lead.form_answers.map((answer) => (
                  <div key={answer.external_question_id}>
                    <p className="text-xs text-muted-foreground">
                      {questionTitles.get(`${lead.connection_id}|${answer.external_question_id}`) ?? answer.external_question_id}
                    </p>
                    <p className="text-foreground">{answer.answer_text ?? '—'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => resetWith(() => setPage((p) => p - 1), true)}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => resetWith(() => setPage((p) => p + 1), true)}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
