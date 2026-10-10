import { useState } from 'react'
import { Pause } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProjects, useTriggerEmergencyPause } from '@/hooks/useClientPortalData'

export function EmergencyPauseButton() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const { data: projects } = useProjects()
  const triggerEmergencyPause = useTriggerEmergencyPause()

  const pausableProjects = (projects ?? []).filter((p) => p.status === 'active')

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setReason('')
      setSelectedProjectIds([])
    }
  }

  function toggleProject(projectId: string, checked: boolean) {
    setSelectedProjectIds((current) =>
      checked ? [...current, projectId] : current.filter((id) => id !== projectId),
    )
  }

  async function handleConfirm() {
    try {
      await triggerEmergencyPause.mutateAsync({ reason: reason.trim(), projectIds: selectedProjectIds })
      toast.success('Pausa de emergência registrada. A agência foi notificada.')
      handleOpenChange(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  const canConfirm = reason.trim().length > 0 && selectedProjectIds.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Pause className="h-4 w-4" />
          Pausa de Emergência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Pausa de Emergência</DialogTitle>
          <DialogDescription>
            Isso pausa as campanhas escolhidas e abre um incidente crítico para a agência atender com prioridade
            máxima. Use só em situações urgentes. A agência tem até 1 dia útil para executar a pausa (contrato,
            cláusula 4.2-VIII) — para interrupção imediata, você também pode pausar direto na sua conta de anúncios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-reason">Motivo da pausa</Label>
            <Textarea
              id="emergency-reason"
              placeholder="Explique rapidamente o que está acontecendo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Campanhas a pausar</Label>
            {pausableProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma campanha ativa no momento.</p>
            )}
            <div className="space-y-2">
              {pausableProjects.map((project) => (
                <label
                  key={project.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2"
                >
                  <Checkbox
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={(checked) => toggleProject(project.id, checked === true)}
                  />
                  <span className="text-sm text-foreground">{project.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="destructive" disabled={!canConfirm || triggerEmergencyPause.isPending} onClick={handleConfirm}>
            {triggerEmergencyPause.isPending ? 'Registrando...' : 'Confirmar pausa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
