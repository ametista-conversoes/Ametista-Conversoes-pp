import { useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface DetailsToggleFieldProps {
  value: string | undefined
  onChange: (value: string) => void
}

/** Fase 56 — editor de modelo de workflow: botão "Detalhes" que abre uma
 * caixa de texto (o "como fazer" do item). Item com detalhes mostra o ícone
 * FileText. Texto puro — quebras de linha e links viram formatação só na
 * exibição (`ItemDetailsButton`). */
export function DetailsToggleField({ value, onChange }: DetailsToggleFieldProps) {
  const filled = !!value?.trim()
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={
          filled
            ? 'h-7 border border-purple-600/20 bg-purple-600/15 px-2 text-xs text-purple-400 hover:bg-purple-600/20'
            : 'h-7 px-2 text-xs text-muted-foreground'
        }
      >
        <FileText className="h-3.5 w-3.5" />
        {open ? 'Fechar detalhes' : filled ? 'Detalhes (preenchido)' : 'Detalhes'}
      </Button>
      {open && (
        <Textarea
          rows={6}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Como fazer: passo a passo, onde clicar, links úteis, cuidados..."
          className="text-sm"
        />
      )}
    </div>
  )
}
