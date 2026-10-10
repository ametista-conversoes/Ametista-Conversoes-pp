import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApprovalRecord } from '@/hooks/useClientPortalData'
import { useRespondToApproval } from '@/hooks/useClientPortalData'
import { formatDateTime } from '@/lib/format'
import { getFileSignedUrl } from '@/lib/storage'
import { getApprovalStatusLabel, getApprovalStatusStyle } from '@/lib/status-styles'
import { ApprovalFeedbackDialog } from './ApprovalFeedbackDialog'

interface ApprovalListProps {
  approvals: ApprovalRecord[]
}

export function ApprovalList({ approvals }: ApprovalListProps) {
  const respondToApproval = useRespondToApproval()
  const [dialogFor, setDialogFor] = useState<{ approval: ApprovalRecord; status: 'rejected' | 'revision_requested' } | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleOpenFile(approval: ApprovalRecord) {
    if (!approval.file_url) return
    setOpeningId(approval.id)
    try {
      const url = approval.file_url.startsWith('http') ? approval.file_url : await getFileSignedUrl(approval.file_url)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Não foi possível abrir o arquivo.')
    } finally {
      setOpeningId(null)
    }
  }

  async function handleApprove(approval: ApprovalRecord) {
    try {
      await respondToApproval.mutateAsync({ approvalId: approval.id, status: 'approved', feedback: null })
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  async function handleConfirmFeedback(feedback: string) {
    if (!dialogFor) return
    try {
      await respondToApproval.mutateAsync({
        approvalId: dialogFor.approval.id,
        status: dialogFor.status,
        feedback,
      })
      setDialogFor(null)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <>
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
            Aprovações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pt-4">
          {approvals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma aprovação pendente.</p>}
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-lg bg-secondary/50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{approval.title}</p>
                <Badge className={getApprovalStatusStyle(approval)}>{getApprovalStatusLabel(approval)}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(approval.created_at)}</p>
              {approval.file_url && (
                <button
                  type="button"
                  disabled={openingId === approval.id}
                  onClick={() => handleOpenFile(approval)}
                  className="mt-1 inline-block text-xs text-purple-400 hover:underline"
                >
                  {openingId === approval.id ? 'Abrindo...' : 'Ver arquivo'}
                </button>
              )}
              {approval.feedback && (
                <p className="mt-2 text-xs text-muted-foreground">Feedback: {approval.feedback}</p>
              )}
              {approval.status === 'pending' && approval.requires_explicit_approval && (
                <p className="mt-2 text-xs text-amber-400">
                  Este item tem preço, oferta ou condição comercial — não vence sozinho, só avança quando você decidir.
                </p>
              )}
              {approval.status === 'pending' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApprove(approval)} disabled={respondToApproval.isPending}>
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDialogFor({ approval, status: 'revision_requested' })}
                  >
                    Pedir revisão
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDialogFor({ approval, status: 'rejected' })}
                  >
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <ApprovalFeedbackDialog
        open={!!dialogFor}
        onOpenChange={(open) => !open && setDialogFor(null)}
        title={dialogFor?.status === 'rejected' ? 'Rejeitar aprovação' : 'Pedir revisão'}
        description="Conte pra agência o motivo — esse comentário fica salvo na aprovação."
        submitting={respondToApproval.isPending}
        onConfirm={handleConfirmFeedback}
      />
    </>
  )
}
