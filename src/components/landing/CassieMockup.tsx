import { Sparkles } from 'lucide-react'
import { useInView } from '@/hooks/useInView'
import { cn } from '@/lib/utils'

const MESSAGES = [
  { from: 'cliente', text: 'Por que meu custo por lead subiu essa semana?' },
  {
    from: 'cassie',
    text: 'O CPL foi de R$ 31 para R$ 38 porque o anúncio #009 saturou: a frequência passou de 3,2. O #014 segue em R$ 27. A análise do gestor de sexta já prevê trocar o criativo.',
  },
  { from: 'cliente', text: 'E as vendas do mês, estão no ritmo da meta?' },
]

/** Conversa com a C.A.S.S.I.E. (exemplo). As mensagens entram em sequência
 * quando a seção aparece; no fim, a assistente "digitando". */
export function CassieMockup() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="rounded-2xl border border-[#1A2540] bg-background/80 p-4 shadow-2xl shadow-purple-950/40">
      <div className="flex items-center gap-2 border-b border-[#1A2540] pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-purple-800">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">C.A.S.S.I.E.</p>
          <p className="text-[10px] text-emerald-400">online</p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {MESSAGES.map((message, index) => (
          <div
            key={message.text}
            style={{ transitionDelay: `${index * 700}ms` }}
            className={cn(
              'max-w-[85%] rounded-2xl px-3 py-2 text-xs transition-all duration-500',
              inView ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
              message.from === 'cliente'
                ? 'ml-auto rounded-br-sm bg-purple-600 text-white'
                : 'rounded-bl-sm border border-[#1A2540] bg-[#131C31] text-foreground',
            )}
          >
            {message.text}
          </div>
        ))}
        <div
          style={{ transitionDelay: `${MESSAGES.length * 700}ms` }}
          className={cn(
            'flex w-14 items-center justify-center gap-1 rounded-2xl rounded-bl-sm border border-[#1A2540] bg-[#131C31] py-2.5 transition-opacity duration-500',
            inView ? 'opacity-100' : 'opacity-0',
          )}
        >
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              style={{ animationDelay: `${delay}ms` }}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
