import { Fragment } from 'react'
import { CircleHelp } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const URL_PATTERN = /(https?:\/\/[^\s)]+)/g

/** Texto puro com quebras de linha; URLs viram links. Nunca renderiza HTML
 * do campo (cada pedaço vira texto ou <a>, nada de innerHTML). */
function DetailsText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN)
  return (
    <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 underline decoration-dotted hover:text-purple-300"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  )
}

interface ItemDetailsButtonProps {
  title: string
  details: string | null | undefined
}

/** Fase 56 — ícone "?" pequeno ao lado de um item de workflow (modelo,
 * checklist do gestor ou tarefa do cliente): abre um card com o "como
 * fazer" daquele item. Não renderiza nada se o item não tem detalhes. */
export function ItemDetailsButton({ title, details }: ItemDetailsButtonProps) {
  if (!details?.trim()) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Detalhes: ${title}`}
          title="Como fazer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-purple-600/15 hover:text-purple-400"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[60vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto border-[#1A2540] bg-[#131C31]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-400">Como fazer</p>
        <p className="mb-3 text-sm font-medium text-foreground">{title}</p>
        <DetailsText text={details} />
      </PopoverContent>
    </Popover>
  )
}
