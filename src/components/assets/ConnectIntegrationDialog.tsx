import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAgencyProviderConnections } from '@/hooks/useManagerPortalData'
import type { ManagerDigitalAssetRecord } from '@/hooks/useManagerPortalData'
import {
  type AgencyAdAccount,
  type AgencyProvider,
  connectIntegration,
  connectWithToken,
  linkAgencyAccount,
  listAgencyAccounts,
} from '@/lib/integrations'

const PROVIDER_LABELS: Record<'google_ads' | 'google_forms' | 'meta_ads', string> = {
  google_ads: 'Google Ads',
  google_forms: 'Google Forms',
  meta_ads: 'Meta Ads',
}

type IntegrationProvider = keyof typeof PROVIDER_LABELS

interface ConnectIntegrationDialogProps {
  trigger: ReactNode
  asset: ManagerDigitalAssetRecord
}

/** Fase 28 — pra Google Ads/Meta Ads, escolhe a conta a partir de uma
 * lista (via a conta administradora da agência já conectada), sem
 * nenhum OAuth nessa etapa. Google Forms continua exatamente como
 * antes — não faz parte da conta administradora MCC/Business Manager,
 * cada formulário segue com o próprio OAuth por cliente. */
export function ConnectIntegrationDialog({ trigger, asset }: ConnectIntegrationDialogProps) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<IntegrationProvider>('google_ads')
  const [formId, setFormId] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [showTokenField, setShowTokenField] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const queryClient = useQueryClient()

  const isAgencyProvider = provider === 'google_ads' || provider === 'meta_ads'
  const { data: agencyConnections } = useAgencyProviderConnections()
  const agencyConnection = isAgencyProvider ? agencyConnections?.find((c) => c.provider === provider) : undefined
  const agencyConnected = agencyConnection?.status === 'connected'

  const accountsQuery = useQuery({
    queryKey: ['agency-accounts', provider],
    queryFn: () => listAgencyAccounts(provider as AgencyProvider),
    enabled: open && isAgencyProvider && agencyConnected,
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setProvider('google_ads')
      setFormId('')
      setSelectedAccountId('')
      setShowTokenField(false)
      setManualToken('')
    }
  }

  function handleProviderChange(next: IntegrationProvider) {
    setProvider(next)
    setSelectedAccountId('')
    setShowTokenField(false)
    setManualToken('')
  }

  async function handleConnectWithToken() {
    if (!manualToken.trim()) {
      toast.error('Cole o token de acesso.')
      return
    }
    setConnecting(true)
    try {
      const result = await connectWithToken(asset.id, manualToken.trim())
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
      toast.success(`Conectado — ${result.externalAccountName ?? result.externalAccountId}.`)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível conectar com esse token.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleConnectAgencyAccount(account: AgencyAdAccount) {
    setConnecting(true)
    try {
      await linkAgencyAccount(asset.id, provider as AgencyProvider, account)
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
      toast.success('Conta vinculada com sucesso.')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível vincular a conta.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleConnectGoogleForms() {
    if (!formId.trim()) {
      toast.error('Cole o link de edição do formulário.')
      return
    }

    setConnecting(true)
    try {
      const authorizationUrl = await connectIntegration({
        provider: 'google_forms',
        digitalAssetId: asset.id,
        formId: formId.trim(),
      })
      window.location.href = authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível iniciar a conexão.')
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar integração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as IntegrationProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider === 'google_forms' && (
            <>
              <div className="space-y-2">
                <Label>Link de edição do formulário</Label>
                <Input
                  placeholder="https://docs.google.com/forms/d/.../edit"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Precisa ser o link de EDIÇÃO (abra o formulário pra editar as perguntas e copie a URL da barra de
                  endereço) — o link público de resposta (.../viewform) não funciona aqui.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Você vai ser levado pra tela de login do Google pra autorizar o acesso.</p>
            </>
          )}

          {isAgencyProvider && !agencyConnected && (
            <p className="text-xs text-muted-foreground">
              Conecte a conta administradora do {PROVIDER_LABELS[provider]} em Configurações → Agência antes de vincular um
              cliente.
            </p>
          )}

          {isAgencyProvider && agencyConnected && (
            <div className="space-y-2">
              <Label>Conta de anúncios do cliente</Label>
              {accountsQuery.isLoading && <p className="text-xs text-muted-foreground">Buscando contas...</p>}
              {accountsQuery.isError && (
                <p className="text-xs text-destructive">
                  {accountsQuery.error instanceof Error ? accountsQuery.error.message : 'Não foi possível buscar as contas.'}
                </p>
              )}
              {accountsQuery.data && (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data.accounts.length === 0 && !accountsQuery.data.warning && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma conta encontrada — confirme que o cliente já foi vinculado ao MCC/Business Manager dentro do próprio Google Ads/Meta.</p>
                    )}
                    {accountsQuery.data.accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name ?? account.id} ({account.id}){account.testAccount ? ' — conta de teste' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {accountsQuery.data?.warning && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  {accountsQuery.data.warning}
                </p>
              )}
            </div>
          )}

          {/* Uso avançado — contas que o token enxerga mas o Business
              Manager da agência não (ex: conta de sandbox/teste do Meta
              Ads, criada pra testar a integração sem afetar dado real).
              Só meta_ads: Google Ads sempre exige OAuth de verdade. */}
          {provider === 'meta_ads' && (
            <div className="space-y-2 border-t border-[#1A2540] pt-3">
              {!showTokenField ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs text-muted-foreground"
                  onClick={() => setShowTokenField(true)}
                >
                  Ou conectar com um token de acesso (avançado/sandbox)
                </Button>
              ) : (
                <>
                  <Label>Token de acesso (Meta Graph API)</Label>
                  <Input
                    type="password"
                    placeholder="EAAxxxxxxxxxxxxx..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pula o OAuth — usa esse token direto pra descobrir e conectar a conta de anúncios que ele enxerga
                    (útil pra contas de sandbox/teste que não passam pelo Business Manager da agência).
                  </p>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {provider === 'google_forms' ? (
            <Button onClick={handleConnectGoogleForms} disabled={connecting}>
              {connecting ? 'Redirecionando...' : 'Conectar'}
            </Button>
          ) : showTokenField ? (
            <Button onClick={handleConnectWithToken} disabled={connecting || !manualToken.trim()}>
              {connecting ? 'Conectando...' : 'Conectar com token'}
            </Button>
          ) : (
            <Button
              disabled={!agencyConnected || !selectedAccountId || connecting}
              onClick={() => {
                const account = accountsQuery.data?.accounts.find((a) => a.id === selectedAccountId)
                if (account) handleConnectAgencyAccount(account)
              }}
            >
              {connecting ? 'Vinculando...' : 'Vincular conta'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
