import { useState } from 'react'
import { Copy, FlaskConical, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { ItemDetailsButton } from '@/components/workflows/ItemDetailsButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useRotateSiteFormKey, type DigitalAssetConnectionRecord } from '@/hooks/useManagerPortalData'
import { formatDateTime } from '@/lib/format'
import { sendSiteFormTest, siteFormWebhookUrl } from '@/lib/integrations'

// Mesmo texto do item "Configurar o formulário e conectá-lo ao sistema do
// cliente" do Workflow 3.2 (docs/interno/workflow-detalhes.json).
const ELEMENTOR_STEPS =
  "Formulário do Elementor Pro, salvo como template da agência e reaproveitado em todo site. Campos: nome, WhatsApp, e-mail (opcional), interesse, e os campos OCULTOS utm_source, utm_medium, utm_campaign, utm_content e gclid (valor padrão → tag dinâmica 'Parâmetro de solicitação' com o mesmo nome).\nAções após o envio:\n1) Webhook → cole a URL deste card (ligue \"Dados avançados\");\n2) E-mail → para o e-mail de aviso do cliente;\n3) Redirecionar → /obrigado;\n4) Salvar envios (backup no WordPress).\nTeste: envie um formulário e confira se o lead aparece como Novo na aba Leads, com a UTM."

interface SiteFormWebhookPanelProps {
  connection: DigitalAssetConnectionRecord
}

/** Fase 60 — card do Ativo "Formulário do site": URL do webhook pra colar
 * no Elementor, nova chave, teste e último lead recebido. Só admin/gestor
 * chegam aqui (a RLS da conexão não deixa o cliente ler a chave). */
export function SiteFormWebhookPanel({ connection }: SiteFormWebhookPanelProps) {
  const rotate = useRotateSiteFormKey()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const url = connection.webhook_key ? siteFormWebhookUrl(connection.webhook_key) : null

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URL do webhook copiada.')
    } catch {
      toast.error('Não foi possível copiar. Selecione a URL e copie manualmente.')
    }
  }

  async function handleTest() {
    if (!connection.webhook_key) return
    setTesting(true)
    try {
      const result = await sendSiteFormTest(connection.webhook_key)
      if (result.ok) {
        const ad = result.tracking?.utm_content ? ` · anúncio "${result.tracking.utm_content}"` : ''
        toast.success(`URL funcionando: ${result.campos?.length ?? 0} campo(s) lido(s)${ad}. Nenhum lead foi criado.`)
      } else {
        toast.error(result.error ?? 'A URL respondeu, mas não conseguiu ler o teste.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível testar a URL.')
    } finally {
      setTesting(false)
    }
  }

  async function handleRotate() {
    try {
      await rotate.mutateAsync(connection.id)
      setConfirmOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">URL do webhook (Elementor)</p>
        <ItemDetailsButton title="Configurar no Elementor" details={ELEMENTOR_STEPS} />
      </div>
      <code className="block break-all rounded-md bg-background/60 p-2 text-[11px] text-muted-foreground">
        {url ?? 'Chave ainda não gerada.'}
      </code>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!url} onClick={handleCopy}>
          <Copy className="h-3.5 w-3.5" />
          Copiar URL
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!url || testing} onClick={handleTest}>
          <FlaskConical className="h-3.5 w-3.5" />
          {testing ? 'Testando...' : 'Enviar lead de teste'}
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
              <KeyRound className="h-3.5 w-3.5" />
              Gerar nova chave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar nova chave?</DialogTitle>
              <DialogDescription>
                A URL atual para de funcionar na hora. Os formulários que usam essa URL só voltam a criar leads depois que
                você colar a URL nova no Elementor.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={rotate.isPending} onClick={handleRotate}>
                {rotate.isPending ? 'Gerando...' : 'Gerar nova chave'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-xs text-muted-foreground/70">
        Último lead recebido em: {connection.last_synced_at ? formatDateTime(connection.last_synced_at) : 'nenhum ainda'}
      </p>
    </div>
  )
}
