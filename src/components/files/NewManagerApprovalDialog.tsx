import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateManagerApproval } from '@/hooks/useManagerPortalData'
import { uploadClientFile } from '@/lib/storage'

interface NewManagerApprovalDialogProps {
  clientId: string
}

/** Manda um arquivo pra aprovação do cliente — fica pendente em
 * Aprovações até ele decidir; se aprovar, aparece em Arquivos sozinho. */
export function NewManagerApprovalDialog({ clientId }: NewManagerApprovalDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [requiresExplicit, setRequiresExplicit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const createApproval = useCreateManagerApproval()

  async function handleSubmit() {
    if (!file || !title.trim()) return
    setSubmitting(true)
    try {
      const path = await uploadClientFile(file, clientId)
      await createApproval.mutateAsync({
        title: title.trim(),
        client_id: clientId,
        file_url: path,
        file_type: file.type || null,
        requires_explicit_approval: requiresExplicit,
      })
      toast.success('Enviado para aprovação do cliente.')
      setFile(null)
      setTitle('')
      setRequiresExplicit(false)
      setOpen(false)
    } catch {
      toast.error('Não foi possível enviar para aprovação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus className="h-4 w-4" />
          Enviar para aprovação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para aprovação</DialogTitle>
          <DialogDescription>
            O cliente vai ver esse item em Aprovações e decidir aprovar, pedir revisão ou rejeitar. Se aprovar, o
            arquivo aparece automaticamente em Arquivos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="approval-title-input">Título</Label>
            <Input
              id="approval-title-input"
              placeholder="Ex: Criativo campanha de verão"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="approval-file-input">Arquivo</Label>
            <Input id="approval-file-input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={requiresExplicit}
              onCheckedChange={(checked) => setRequiresExplicit(checked === true)}
            />
            <span>
              Contém preço, oferta, promoção ou condição comercial
              <span className="block text-xs text-muted-foreground">
                Nunca aprova sozinho por atraso — precisa sempre de uma decisão expressa do cliente (contrato 4.1 §4).
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!file || !title.trim() || submitting}>
            {submitting ? 'Enviando...' : 'Enviar para aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
