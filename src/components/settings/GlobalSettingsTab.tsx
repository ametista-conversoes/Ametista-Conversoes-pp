import { useState } from 'react'
import { Flag, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFeatureFlags } from '@/hooks/useClientPortalData'
import { recreateDemoData, removeDemoData } from '@/lib/demo-data'

export function GlobalSettingsTab() {
  const { data: flags, isLoading } = useFeatureFlags()
  const [recreating, setRecreating] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleRecreate() {
    setRecreating(true)
    try {
      await recreateDemoData()
      toast.success('Dados de demonstração recriados.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível recriar os dados de demonstração.')
    } finally {
      setRecreating(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeDemoData()
      toast.success('Dados de demonstração removidos.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover os dados de demonstração.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4 text-purple-400" />
            Sinalizadores de funcionalidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && (flags ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum sinalizador cadastrado.</p>
          )}
          {(flags ?? []).map((flag) => (
            <div key={flag.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{flag.label ?? flag.key}</p>
                <p className="text-xs text-muted-foreground">
                  {flag.key} · escopo: {flag.scope}
                </p>
              </div>
              <Badge
                className={
                  flag.enabled
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-500/20 bg-slate-500/10 text-slate-400'
                }
              >
                {flag.enabled ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          ))}
          <p className="pt-2 text-xs text-muted-foreground/70">
            A edição destes sinalizadores chega no Portal do Gestor (Fase 5). Por enquanto esta aba é só leitura.
          </p>
        </CardContent>
      </Card>

      {/* Fase 50.B — motor de Dados de demonstração (Loja Aurora +
       * Clínica Sorriso). "Recriar" apaga e gera tudo de novo com datas
       * relativas a hoje; "Remover" só apaga. Nenhum dos dois toca
       * cliente real (não-demo). */}
      <Card className="rounded-xl border border-[#1A2540] bg-[#131C31] p-5 hover:border-purple-600/30 md:p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Dados de demonstração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pt-4">
          <p className="text-sm text-muted-foreground">
            Gera (ou apaga) a conta fictícia usada pra demonstrar a plataforma a prospects — sempre com datas
            relativas a hoje, nunca mexe em cliente real.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleRecreate} disabled={recreating || removing}>
              <RefreshCw className="h-4 w-4" />
              {recreating ? 'Recriando...' : 'Recriar dados de demonstração'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleRemove} disabled={recreating || removing}>
              <Trash2 className="h-4 w-4" />
              {removing ? 'Removendo...' : 'Remover dados de demonstração'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
