import { Clock, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useClient } from '@/hooks/useClientPortalData'
import { formatCurrency } from '@/lib/format'
import { clientStatusLabels, clientStatusStyles, planLabels } from '@/lib/status-styles'

// Fase 21.2: só renderiza pra role 'cliente' (Settings.tsx filtra a
// aba antes disso) — o branch de "conta sem cliente vinculado" que
// existia aqui pra admin/gestor não faz mais sentido, removido.
export function ClientSettingsTab() {
  const { data: client, isLoading } = useClient()

  if (isLoading || !client) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-purple-400" />
            Dados do cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium text-foreground">{client.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Empresa</span>
            <span className="font-medium text-foreground">{client.company ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium text-foreground">{client.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="font-medium text-foreground">{client.plan ? (planLabels[client.plan] ?? client.plan) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mensalidade</span>
            <span className="font-medium text-foreground">{formatCurrency(client.monthly_fee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge className={clientStatusStyles[client.status]}>
              {clientStatusLabels[client.status] ?? client.status}
            </Badge>
          </div>
          <p className="pt-2 text-xs text-muted-foreground/70">
            A edição desses dados é feita pela agência. Por enquanto esta aba é só leitura.
          </p>
        </CardContent>
      </Card>

      {/* Fase 49 (achado #2 da auditoria contrato x app): prazos do
       * contrato (cláusula 4.2-VIII) nunca eram mostrados ao cliente em
       * lugar nenhum da plataforma. */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-purple-400" />
            Prazos de atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-0 pt-4 text-sm text-muted-foreground">
          <p>Mensagens e solicitações: até 1 dia útil.</p>
          <p>Pausa de Emergência: executada em até 1 dia útil.</p>
          <p>Correção de erros técnicos identificados: até 2 dias úteis.</p>
          <p className="pt-2 text-xs text-muted-foreground/70">
            Prazos do contrato (cláusula 4.2-VIII). Se a Plataforma estiver indisponível, peça pausas ou solicitações
            por WhatsApp ou e-mail — os mesmos prazos valem.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
