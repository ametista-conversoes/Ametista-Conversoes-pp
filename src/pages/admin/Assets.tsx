import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ListChecks, Plug, Plus, RefreshCw, Search, UserPlus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AssetCard } from '@/components/assets/AssetCard'
import { AssetFormDialog } from '@/components/assets/AssetFormDialog'
import { FormResponsesDialog } from '@/components/assets/FormResponsesDialog'
import { ManualLeadsDialog } from '@/components/leads/ManualLeadsDialog'
import { DeleteModeToggle } from '@/components/shared/DeleteModeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAllClients, useAllDigitalAssets, useDigitalAssetConnections } from '@/hooks/useManagerPortalData'
import { formatDateTime } from '@/lib/format'
import { syncIntegration } from '@/lib/integrations'
import { connectionProviderLabels, connectionStatusLabels, connectionStatusStyles } from '@/lib/status-styles'

const ALL_CLIENTS = 'all'
const SYNCABLE_PROVIDERS = ['google_ads', 'meta_ads', 'google_forms']

/** Fase 34e — "Integrações" (antes uma aba própria do Portal Gestor)
 * virou uma sub-aba aqui dentro, por pedido do usuário: as duas telas
 * sempre mostraram o mesmo conjunto de dados (ativos + conexões), só
 * separadas — juntar reduz um item de menu sem perder nada. `/integrations`
 * continua existindo como redirecionamento (`App.tsx`) pra quem tiver o
 * link antigo salvo. */
export default function Assets() {
  const queryClient = useQueryClient()
  const { data: clients } = useAllClients()
  const { data: assets, isLoading } = useAllDigitalAssets()
  const { data: connections } = useDigitalAssetConnections()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'integracoes' ? 'integracoes' : 'ativos'

  const [assetClientFilter, setAssetClientFilter] = useState(ALL_CLIENTS)
  const [deleteMode, setDeleteMode] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')

  const [integrationClientFilter, setIntegrationClientFilter] = useState(ALL_CLIENTS)
  const [integrationSearch, setIntegrationSearch] = useState('')
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Volta do /callback da Edge Function "integrations" (Google/Meta) —
  // ela redireciona pra cá com o resultado na query string, em vez de
  // mostrar uma página própria (rotas sem autenticação têm o
  // Content-Type forçado pro texto puro pelo Supabase, então nunca
  // renderizaria bonita ali).
  useEffect(() => {
    const integration = searchParams.get('integration')
    if (!integration) return
    const message = searchParams.get('message')
    if (integration === 'connected') {
      toast.success(message ?? 'Integração conectada com sucesso.')
    } else if (integration === 'error') {
      toast.error(message ?? 'Não foi possível conectar a integração.')
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('integration')
        next.delete('message')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  function handleTabChange(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'integracoes') params.set('tab', 'integracoes')
        else params.delete('tab')
        return params
      },
      { replace: true },
    )
  }

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    try {
      const result = await syncIntegration(connectionId)
      const message =
        result.syncedResponses !== undefined
          ? `Sincronizado — ${result.syncedQuestions ?? 0} pergunta(s) e ${result.syncedResponses} resposta(s) atualizadas.`
          : `Sincronizado — ${result.syncedDays ?? 0} dia(s) de métricas atualizados.`
      toast.success(message)
      queryClient.invalidateQueries({ queryKey: ['digital-asset-connections'] })
      queryClient.invalidateQueries({ queryKey: ['form-responses'] })
      queryClient.invalidateQueries({ queryKey: ['audience-insights'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível sincronizar.')
    } finally {
      setSyncingId(null)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>
  }

  const assetTerm = assetSearch.trim().toLowerCase()
  const filteredAssets = (assets ?? [])
    .filter((asset) => assetClientFilter === ALL_CLIENTS || asset.client_id === assetClientFilter)
    .filter(
      (asset) =>
        !assetTerm || asset.name.toLowerCase().includes(assetTerm) || (asset.platform ?? '').toLowerCase().includes(assetTerm),
    )

  const assetsById = new Map((assets ?? []).map((asset) => [asset.id, asset]))
  const integrationTerm = integrationSearch.trim().toLowerCase()
  const integrationRows = (connections ?? [])
    .map((connection) => ({ connection, asset: assetsById.get(connection.digital_asset_id) }))
    .filter((row) => !!row.asset)
    .filter((row) => integrationClientFilter === ALL_CLIENTS || row.asset!.client_id === integrationClientFilter)
    .filter((row) => !integrationTerm || row.asset!.name.toLowerCase().includes(integrationTerm))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Portal Gestor</p>
        <h1 className="text-2xl font-semibold text-foreground">Ativos Digitais</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DeleteModeToggle active={deleteMode} onToggle={() => setDeleteMode((v) => !v)} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar ativo..."
                  className="w-48 pl-9"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                />
              </div>
              <Select value={assetClientFilter} onValueChange={setAssetClientFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLIENTS}>Todos os clientes</SelectItem>
                  {(clients ?? []).map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AssetFormDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Novo ativo
                  </Button>
                }
              />
            </div>
          </div>

          {filteredAssets.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum ativo digital encontrado.</p>
          )}

          <div className="content-grid-container">
            <div className="content-grid gap-4">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} deleteMode={deleteMode} connections={connections} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integracoes" className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar ativo..."
                className="w-48 pl-9"
                value={integrationSearch}
                onChange={(e) => setIntegrationSearch(e.target.value)}
              />
            </div>
            <Select value={integrationClientFilter} onValueChange={setIntegrationClientFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLIENTS}>Todos os clientes</SelectItem>
                {(clients ?? []).map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
            <CardHeader className="p-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="h-4 w-4 text-purple-400" />
                Conexões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0 pt-4">
              {integrationRows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma integração conectada ainda. Vá na aba "Ativos" pra conectar a primeira.
                </p>
              )}
              {integrationRows.map(({ connection, asset }) => {
                return (
                  <div
                    key={connection.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {connectionProviderLabels[connection.provider] ?? connection.provider}
                        </p>
                        <Badge className={connectionStatusStyles[connection.status]}>
                          {connectionStatusLabels[connection.status] ?? connection.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {asset!.name} · {asset!.client?.name ?? 'Cliente'}
                      </p>
                      {/* Fase 35.2 — nome de verdade do formulário (o
                          "asset!.name" acima é só o rótulo do Ativo
                          Digital, escolhido por quem cadastrou — sem
                          isso não dava pra saber qual formulário real
                          cada Ativo representava). */}
                      {connection.provider === 'google_forms' && connection.external_account_name && (
                        <p className="mt-0.5 text-xs text-purple-300">Formulário: {connection.external_account_name}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        Última sincronização: {formatDateTime(connection.last_synced_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {connection.status === 'connected' && connection.provider === 'google_forms' && (
                        <FormResponsesDialog
                          connectionId={connection.id}
                          formTitle={connection.external_account_name}
                          trigger={
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                              <ListChecks className="h-3.5 w-3.5" />
                              Ver respostas
                            </Button>
                          }
                        />
                      )}
                      {connection.status === 'connected' && connection.provider === 'google_forms' && (
                        <ManualLeadsDialog
                          clientId={asset!.client_id}
                          trigger={
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                              <UserPlus className="h-3.5 w-3.5" />
                              Leads manuais
                            </Button>
                          }
                        />
                      )}
                      {connection.status === 'connected' && SYNCABLE_PROVIDERS.includes(connection.provider) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={syncingId === connection.id}
                          onClick={() => handleSync(connection.id)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${syncingId === connection.id ? 'animate-spin' : ''}`} />
                          Sincronizar agora
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
