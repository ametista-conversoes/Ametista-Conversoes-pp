import { useState } from 'react'
import { Boxes, ExternalLink, Pencil, Plug, RefreshCw, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { ConnectIntegrationDialog } from '@/components/assets/ConnectIntegrationDialog'
import { AssetFormDialog } from '@/components/assets/AssetFormDialog'
import { SelectGoogleAdsAccountDialog } from '@/components/assets/SelectGoogleAdsAccountDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteItemButton } from '@/components/shared/DeleteItemButton'
import type { DigitalAssetConnectionRecord, ManagerDigitalAssetRecord } from '@/hooks/useManagerPortalData'
import { useDeleteDigitalAsset, useDisconnectIntegration, useUpdateDigitalAssetStatus } from '@/hooks/useManagerPortalData'
import { syncIntegration } from '@/lib/integrations'
import {
  connectionProviderLabels,
  connectionStatusLabels,
  connectionStatusStyles,
  digitalAssetStatusLabels,
  digitalAssetStatusStyles,
  digitalAssetTypeLabels,
} from '@/lib/status-styles'

interface AssetCardProps {
  asset: ManagerDigitalAssetRecord
  deleteMode?: boolean
  connections?: DigitalAssetConnectionRecord[]
}

const CHANGEABLE_STATUSES = ['active', 'inactive', 'pending', 'revoked']

export function AssetCard({ asset, deleteMode, connections }: AssetCardProps) {
  const updateStatus = useUpdateDigitalAssetStatus()
  const deleteAsset = useDeleteDigitalAsset()
  const disconnectIntegration = useDisconnectIntegration()
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const assetConnections = (connections ?? []).filter((c) => c.digital_asset_id === asset.id)
  // Fase 35.2 — enquanto tiver uma conexão de verdade conectada, troca
  // o botão "Conectar integração" por "Desconectar integração" (antes
  // os dois ficavam juntos ao mesmo tempo, contraintuitivo — pedido
  // explícito do usuário).
  const connectedConnection = assetConnections.find((c) => c.status === 'connected')

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId)
    try {
      const result = await syncIntegration(connectionId)
      toast.success(`Sincronizado — ${result.syncedDays} dia(s) de métricas atualizados.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível sincronizar.')
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <Card className="flex flex-col rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
      <CardHeader className="p-0">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2">
            <Boxes className="h-4 w-4 shrink-0 text-purple-400" />
            <span className="truncate">{asset.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <AssetFormDialog
              asset={asset}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Editar ${asset.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            {deleteMode && (
              <DeleteItemButton label={`o ativo "${asset.name}"`} onDelete={() => deleteAsset.mutateAsync(asset.id)} />
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 p-0 pt-4">
        <p className="text-sm text-muted-foreground">
          {asset.type ? (digitalAssetTypeLabels[asset.type] ?? asset.type) : 'Tipo não informado'}
          {asset.platform ? ` · ${asset.platform}` : ''}
        </p>
        <p className="text-xs text-muted-foreground/70">{asset.client?.name ?? 'Cliente'}</p>

        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-purple-400 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{asset.url}</span>
          </a>
        )}

        {asset.code && (
          <code className="block max-h-24 overflow-y-auto rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
            {asset.code}
          </code>
        )}

        <div className="space-y-1.5">
          {assetConnections.map((connection) => (
            <div key={connection.id} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <Plug className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{connectionProviderLabels[connection.provider] ?? connection.provider}</span>
                  <Badge className={connectionStatusStyles[connection.status]}>
                    {connectionStatusLabels[connection.status] ?? connection.status}
                  </Badge>
                </span>
                {connection.status === 'connected' &&
                  (connection.provider === 'google_ads' || connection.provider === 'meta_ads') &&
                  (connection.external_account_id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-muted-foreground hover:text-foreground"
                      disabled={syncingId === connection.id}
                      onClick={() => handleSync(connection.id)}
                    >
                      <RefreshCw className={`h-3 w-3 ${syncingId === connection.id ? 'animate-spin' : ''}`} />
                      Sincronizar agora
                    </Button>
                  ) : (
                    connection.provider === 'google_ads' && <SelectGoogleAdsAccountDialog connectionId={connection.id} />
                  ))}
              </div>
              {/* Fase 35.2 — nome de verdade do formulário, diferente do
                  nome do Ativo Digital (que é só um rótulo escolhido por
                  quem cadastrou) — sem isso não dava pra saber qual
                  formulário real cada Ativo "google forms N" representava. */}
              {connection.provider === 'google_forms' && connection.external_account_name && (
                <p className="pl-4 text-xs text-muted-foreground/70">Formulário: {connection.external_account_name}</p>
              )}
            </div>
          ))}
          {connectedConnection ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs text-destructive hover:text-destructive"
              disabled={disconnectIntegration.isPending}
              onClick={() => disconnectIntegration.mutate(connectedConnection.id)}
            >
              <Unplug className="h-3.5 w-3.5" />
              {disconnectIntegration.isPending ? 'Desconectando...' : 'Desconectar integração'}
            </Button>
          ) : (
            <ConnectIntegrationDialog
              asset={asset}
              trigger={
                <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs">
                  <Plug className="h-3.5 w-3.5" />
                  Conectar integração
                </Button>
              }
            />
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={updateStatus.isPending}>
              <Badge className={`cursor-pointer ${digitalAssetStatusStyles[asset.status]}`}>
                {digitalAssetStatusLabels[asset.status] ?? asset.status}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CHANGEABLE_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => updateStatus.mutate({ assetId: asset.id, status })}
                >
                  {digitalAssetStatusLabels[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
