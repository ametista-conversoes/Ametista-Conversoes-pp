import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateManualLead,
  useManualLeads,
  useSearchFormResponses,
  useSetFormResponseStatus,
  useSetManualLeadStatus,
  type LeadStatus,
} from '@/hooks/useManagerPortalData'
import { formatDateTime } from '@/lib/format'
import { leadStatusLabels, leadStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['novo', 'qualificado', 'venda', 'perdido']

interface ManualLeadsDialogProps {
  trigger: ReactNode
  clientId: string
}

/** Fase 37, Bloco 3 — registro manual de lead qualificado que não
 * preencheu formulário nenhum (ex: respondeu no WhatsApp), pedido do
 * usuário pra cobrir a lacuna sem precisar de uma integração de
 * WhatsApp de verdade. Busca primeiro nas respostas de formulário já
 * sincronizadas pra não duplicar quem já tem uma linha lá — só registra
 * um lead novo quando a busca não acha ninguém. Usado tanto no Portal
 * Gestor (Ativos Digitais → Integrações) quanto no Portal Cliente
 * (Leads), mesmo componente — RLS/RPC já cobrem os dois papéis. */
export function ManualLeadsDialog({ trigger, clientId }: ManualLeadsDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')

  const { data: leads } = useManualLeads(open ? clientId : null)
  const searchResults = useSearchFormResponses(open ? clientId : null, search)
  const createLead = useCreateManualLead()
  const setManualStatus = useSetManualLeadStatus()
  const setResponseStatus = useSetFormResponseStatus()

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Digite o nome do lead.')
      return
    }
    await createLead.mutateAsync({
      client_id: clientId,
      name: name.trim(),
      contact: contact.trim() || null,
      note: note.trim() || null,
    })
    setName('')
    setContact('')
    setNote('')
  }

  const showSearchResults = search.trim().length >= 2

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leads qualificados manuais</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Pra lead que qualificou por um canal que o app ainda não rastreia (ex: respondeu no WhatsApp). Busque
          primeiro nas respostas de formulário já sincronizadas antes de registrar — evita duplicar quem já tem uma
          linha lá.
        </p>

        <div className="space-y-2">
          <Label>Buscar nas respostas de formulário (nome, telefone, e-mail...)</Label>
          <Input placeholder="Digite pra buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {showSearchResults && (searchResults.data?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma resposta de formulário encontrada com esse termo.</p>
          )}
          {(searchResults.data ?? []).map((hit) => (
            <div
              key={hit.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate text-foreground">{hit.matchedAnswer || '—'}</p>
                <p className="text-muted-foreground">
                  {formatDateTime(hit.submitted_at)} · {leadStatusLabels[hit.status]}
                </p>
              </div>
              {hit.status !== 'qualificado' && hit.status !== 'venda' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 shrink-0 text-[10px]"
                  disabled={setResponseStatus.isPending}
                  onClick={() => setResponseStatus.mutate({ responseId: hit.id, status: 'qualificado' })}
                >
                  Já é esse — marcar Qualificado
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-[#1A2540] p-3">
          <p className="text-xs font-medium text-muted-foreground">Não achou? Registrar como lead novo</p>
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Contato — telefone/e-mail (opcional)" value={contact} onChange={(e) => setContact(e.target.value)} />
          <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="button" size="sm" disabled={createLead.isPending} onClick={handleCreate}>
            Registrar como lead qualificado
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Leads manuais registrados</p>
          {(leads ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum ainda.</p>}
          {(leads ?? []).map((lead) => (
            <div key={lead.id} className="rounded-lg bg-secondary/30 p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-foreground">{lead.name}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={setManualStatus.isPending}>
                    <Badge className={cn('cursor-pointer', leadStatusStyles[lead.status])}>
                      {leadStatusLabels[lead.status]}
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {LEAD_STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onSelect={() => setManualStatus.mutate({ leadId: lead.id, status })}
                      >
                        {leadStatusLabels[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {lead.contact && <p className="text-xs text-muted-foreground">{lead.contact}</p>}
              {lead.note && <p className="text-xs text-muted-foreground">{lead.note}</p>}
              <p className="mt-1 text-xs text-muted-foreground/70">{formatDateTime(lead.created_at)}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
