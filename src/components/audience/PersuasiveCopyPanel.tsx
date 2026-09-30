import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CassieMessageForm } from '@/components/cassie/CassieMessageForm'
import { OptionBreakdownBarChart } from '@/components/charts/OptionBreakdownBarChart'
import { PersuasiveCopyThread } from '@/components/audience/PersuasiveCopyThread'
import { useOpenTextAnswers } from '@/hooks/useManagerPortalData'
import { usePersuasiveCopyMessages, useSendPersuasiveCopyMessage, usePersuasiveCopySending } from '@/hooks/usePersuasiveCopyMessages'
import { extractWordFrequency } from '@/lib/word-frequency'

interface PersuasiveCopyPanelProps {
  clientId: string
  connectionIds: string[]
  connectionId?: string
}

const INITIAL_TRIGGER_MESSAGE = 'Gere sugestões de headlines e textos com base nas respostas abertas do público.'

/** Fase 8.4/8.4b, "Comunicação Persuasiva" — palavras mais frequentes
 * das respostas abertas (`extractWordFrequency`, função pura testada)
 * + chat persistido pra gerar e ajustar headlines/textos com a Cassie
 * (`usePersuasiveCopyMessages`, guardado no banco — sobrevive a trocar
 * de aba ou recarregar a página). */
export function PersuasiveCopyPanel({ clientId, connectionIds, connectionId }: PersuasiveCopyPanelProps) {
  const { data: answers, isLoading } = useOpenTextAnswers(clientId, connectionIds)
  const { data: messages, isLoading: messagesLoading } = usePersuasiveCopyMessages(clientId, connectionId ?? null)
  const sendMessage = useSendPersuasiveCopyMessage(clientId, connectionId ?? null)
  const sending = usePersuasiveCopySending(clientId, connectionId ?? null)
  const [draft, setDraft] = useState('')

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>

  if ((answers ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma resposta de pergunta aberta sincronizada ainda pra esse cliente. Conecte e sincronize um Google Forms
        em "Integrações" pra começar.
      </p>
    )
  }

  const wordFrequency = extractWordFrequency(answers ?? [])
  const hasConversation = (messages ?? []).length > 0

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-base font-medium">Palavras mais frequentes nas respostas abertas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <OptionBreakdownBarChart
            data={wordFrequency.map((w) => ({ label: w.word, count: w.count, percentage: w.percentage }))}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-0">
          <CardTitle className="text-base font-medium">Sugestões de headlines e textos</CardTitle>
          {!messagesLoading && !hasConversation && (
            <Button type="button" size="sm" disabled={sending} onClick={() => sendMessage.mutate(INITIAL_TRIGGER_MESSAGE)}>
              <Sparkles className={`h-3.5 w-3.5 ${sending ? 'animate-pulse' : ''}`} />
              {sending ? 'Gerando...' : 'Gerar sugestões com IA'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-0 pt-4">
          <p className="text-xs text-muted-foreground">
            Trechos das respostas do formulário são enviados à OpenAI só para gerar estas sugestões e não são usados
            para treinar modelos de IA.
          </p>
          {messagesLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!messagesLoading && !hasConversation && !sending && (
            <p className="text-sm text-muted-foreground">
              Clique em "Gerar sugestões com IA" pra pedir pra Cassie sugerir headlines e textos de anúncio com base na
              linguagem real dessas respostas.
            </p>
          )}
          {!messagesLoading && hasConversation && (
            <>
              <PersuasiveCopyThread messages={messages ?? []} sending={sending} />
              <CassieMessageForm
                value={draft}
                onChange={setDraft}
                onSend={(message) => sendMessage.mutate(message)}
                sending={sending}
                placeholder="Se quiser modificações ou melhorias, é só dizer"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
