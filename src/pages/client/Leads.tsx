import { useState } from 'react'
import { differenceInMinutes } from 'date-fns'
import { UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ManualLeadsDialog } from '@/components/leads/ManualLeadsDialog'
import { UnlinkedClientNotice } from '@/components/shared/UnlinkedClientNotice'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadQuestions, useLeads, useSetLeadStatus, type LeadStatus } from '@/hooks/useClientPortalData'
import { useMarkNavSeen } from '@/hooks/useNavSeen'
import { formatDateTime } from '@/lib/format'
import { leadSourceLabels, leadStatusLabels, leadStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const FILTERS = ['todos', 'novo', 'qualificado', 'venda', 'perdido'] as const
type Filter = (typeof FILTERS)[number]

// Fase 60 — filtro por origem (formulário do site x Google Forms).
const SOURCE_FILTERS = ['todas', 'site_form', 'google_forms'] as const
type SourceFilter = (typeof SOURCE_FILTERS)[number]

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['novo', 'qualificado', 'venda', 'perdido']

/** Fase 35, Parte 2 — Fechamento do Loop de Venda: cada resposta de
 * formulário já sincronizada (Fase 8.2) aparece aqui como um lead, com
 * um status manual (Novo/Qualificado/Venda/Perdido) que o cliente marca
 * conforme avança a negociação — isso é o que alimenta a contagem de
 * "Leads Qualificados"/"Vendas" nas Metas SMART, em vez de depender do
 * gestor perguntar verbalmente. O gestor também pode marcar (Ativos
 * Digitais → Integrações → Ver respostas), mesma linha dos dois lados. */
export default function Leads() {
  useMarkNavSeen('/leads')
  const { clientId } = useAuth()
  const { data: leads, isLoading } = useLeads()
  const connectionIds = Array.from(new Set((leads ?? []).map((l) => l.connection_id)))
  const { data: questions } = useLeadQuestions(connectionIds)
  const setStatus = useSetLeadStatus()
  const [filter, setFilter] = useState<Filter>('todos')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('todas')

  if (!clientId) {
    return <UnlinkedClientNotice page="Leads" />
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const questionTitles = new Map((questions ?? []).map((q) => [`${q.connection_id}|${q.external_question_id}`, q.title]))

  const allLeads = leads ?? []
  const filteredLeads = allLeads.filter(
    (lead) => (filter === 'todos' || lead.status === filter) && (sourceFilter === 'todas' || lead.source === sourceFilter),
  )
  const hasSiteLeads = allLeads.some((lead) => lead.source === 'site_form')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Portal Cliente</p>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Respostas dos formulários conectados (site e Google Forms) — marque o status de cada uma conforme a negociação
            avança.
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

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((status) => (
          <button key={status} type="button" onClick={() => setFilter(status)}>
            <Badge
              className={
                filter === status
                  ? 'border-purple-600/20 bg-purple-600/15 text-purple-400'
                  : 'border-[#1A2540] bg-secondary/50 text-muted-foreground'
              }
            >
              {status === 'todos' ? 'Todos' : leadStatusLabels[status]}
            </Badge>
          </button>
        ))}
      </div>

      {hasSiteLeads && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Origem:</span>
          {SOURCE_FILTERS.map((source) => (
            <button key={source} type="button" onClick={() => setSourceFilter(source)}>
              <Badge
                className={
                  sourceFilter === source
                    ? 'border-purple-600/20 bg-purple-600/15 text-purple-400'
                    : 'border-[#1A2540] bg-secondary/50 text-muted-foreground'
                }
              >
                {source === 'todas' ? 'Todas' : leadSourceLabels[source]}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {filteredLeads.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {allLeads.length === 0
            ? 'Nenhuma resposta de formulário sincronizada ainda.'
            : 'Nenhum lead com esse status.'}
        </p>
      )}

      <div className="space-y-2">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="rounded-xl border border-[#1A2540] bg-[#131C31] p-4 hover:border-purple-600/30">
            <CardContent className="space-y-2 p-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{formatDateTime(lead.submitted_at)}</p>
                  <Badge className="border-[#1A2540] bg-secondary/50 text-muted-foreground">
                    {leadSourceLabels[lead.source] ?? lead.source}
                  </Badge>
                  {lead.status === 'novo' && lead.submitted_at && differenceInMinutes(new Date(), new Date(lead.submitted_at)) > 15 && (
                    <span className="text-xs font-medium text-amber-400">
                      Passou de 15 min sem resposta
                    </span>
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
                      <DropdownMenuItem
                        key={status}
                        onSelect={() => setStatus.mutate({ responseId: lead.id, status })}
                      >
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
    </div>
  )
}
