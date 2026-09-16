import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  useDigitalAssetConnections,
  useFormQuestions,
  useFormResponses,
  useSetFormPurpose,
  useSetFormResponseStatus,
  type LeadStatus,
} from '@/hooks/useManagerPortalData'
import { formatDateTime } from '@/lib/format'
import { leadStatusLabels, leadStatusStyles } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

const LEAD_STATUS_OPTIONS: LeadStatus[] = ['novo', 'qualificado', 'venda', 'perdido']

const FORM_PURPOSE_NONE = 'nenhum'
const FORM_PURPOSE_OPTIONS: { value: string; label: string }[] = [
  { value: FORM_PURPOSE_NONE, label: 'Genérico (classificação manual)' },
  { value: 'vendas', label: 'Formulário de Vendas — resposta nova já nasce "Venda"' },
  { value: 'perdido', label: 'Formulário de Objeções — resposta nova já nasce "Perdido"' },
]

interface FormResponsesDialogProps {
  trigger: ReactNode
  connectionId: string
  /** Fase 35.2 — título real do formulário (diferente do nome do Ativo
   * Digital) — quando disponível, aparece junto do título do diálogo. */
  formTitle?: string | null
}

/** Vitrine das respostas estruturadas sincronizadas de um Google Forms
 * conectado (Fase 8.2) — confirma visualmente que a sincronização
 * trouxe pergunta+resposta reais (não só o Alerta genérico de sempre).
 * A síntese em % das perguntas fechadas fica pra Fase 8.3. */
export function FormResponsesDialog({ trigger, connectionId, formTitle }: FormResponsesDialogProps) {
  const [open, setOpen] = useState(false)
  const { data: questions } = useFormQuestions(open ? connectionId : null)
  const { data: responses, isLoading } = useFormResponses(open ? connectionId : null)
  const { data: connections } = useDigitalAssetConnections()
  const setStatus = useSetFormResponseStatus()
  const setPurpose = useSetFormPurpose()

  const questionTitles = new Map((questions ?? []).map((q) => [q.external_question_id, q.title]))
  const formPurpose = connections?.find((c) => c.id === connectionId)?.form_purpose ?? null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respostas do formulário{formTitle ? ` — ${formTitle}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Propósito deste formulário</p>
          <Select
            value={formPurpose ?? FORM_PURPOSE_NONE}
            disabled={setPurpose.isPending}
            onValueChange={(value) =>
              setPurpose.mutate({ connectionId, purpose: value === FORM_PURPOSE_NONE ? null : (value as 'vendas' | 'perdido') })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_PURPOSE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Só afeta resposta nova sincronizada que ainda está "Novo" — nunca sobrescreve uma classificação manual já
            feita.
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!isLoading && (responses ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma resposta sincronizada ainda. Clique em "Sincronizar agora" pra buscar as respostas reais direto do
            Google Forms.
          </p>
        )}

        <div className="space-y-3">
          {(responses ?? []).map((response) => (
            <div key={response.id} className="rounded-lg bg-secondary/30 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{formatDateTime(response.submitted_at)}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={setStatus.isPending}>
                    <Badge className={cn('cursor-pointer', leadStatusStyles[response.status])}>
                      {leadStatusLabels[response.status]}
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {LEAD_STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onSelect={() => setStatus.mutate({ responseId: response.id, status })}
                      >
                        {leadStatusLabels[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-1.5">
                {response.form_answers.map((answer) => (
                  <div key={answer.external_question_id}>
                    <p className="text-xs text-muted-foreground">
                      {questionTitles.get(answer.external_question_id) ?? answer.external_question_id}
                    </p>
                    <p className="text-foreground">{answer.answer_text ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
