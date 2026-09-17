import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ManagerDigitalAssetRecord } from '@/hooks/useManagerPortalData'
import { useAllClients, useCreateDigitalAsset, useUpdateDigitalAsset } from '@/hooks/useManagerPortalData'
import { FORM_PURPOSE_NONE, FORM_PURPOSE_OPTIONS } from '@/lib/form-purpose'
import { digitalAssetCodeTypes, digitalAssetStatusLabels, digitalAssetTypeLabels } from '@/lib/status-styles'

const assetFormSchema = z.object({
  name: z.string().min(2, 'Digite um nome'),
  clientId: z.string().min(1, 'Escolha um cliente'),
  type: z.string().optional(),
  platform: z.string().optional(),
  url: z
    .string()
    .optional()
    .refine((value) => !value || /^https?:\/\/.+/i.test(value), 'Digite um link válido (começando com http:// ou https://)'),
  code: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending', 'revoked']),
  // Fase 38 — só usado quando type === 'google_forms'.
  formPurpose: z.string().optional(),
})

type AssetFormValues = z.infer<typeof assetFormSchema>

const EMPTY_VALUES: AssetFormValues = {
  name: '',
  clientId: '',
  type: '',
  platform: '',
  url: '',
  code: '',
  status: 'active',
  formPurpose: FORM_PURPOSE_NONE,
}

interface AssetFormDialogProps {
  trigger: ReactNode
  asset?: ManagerDigitalAssetRecord
}

/** Diálogo de criar OU editar um ativo digital — sem `asset` cria um
 * novo; com `asset`, edita o existente. Mesmo padrão do
 * `WorkflowTemplateFormDialog.tsx` (reset no `handleOpenChange` ao
 * abrir, não ao fechar, pra funcionar bem com o diálogo reaberto em
 * modos diferentes). */
export function AssetFormDialog({ trigger, asset }: AssetFormDialogProps) {
  const [open, setOpen] = useState(false)
  const { data: clients } = useAllClients()
  const createAsset = useCreateDigitalAsset()
  const updateAsset = useUpdateDigitalAsset()
  const isEdit = !!asset

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: EMPTY_VALUES,
  })

  const selectedType = form.watch('type')
  const isCodeType = !!selectedType && digitalAssetCodeTypes.includes(selectedType)
  const isGoogleForms = selectedType === 'google_forms'

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      form.reset(
        asset
          ? {
              name: asset.name,
              clientId: asset.client_id,
              type: asset.type ?? '',
              platform: asset.platform ?? '',
              url: asset.url ?? '',
              code: asset.code ?? '',
              status: asset.status as AssetFormValues['status'],
              formPurpose: asset.form_purpose ?? FORM_PURPOSE_NONE,
            }
          : EMPTY_VALUES,
      )
    }
  }

  async function onSubmit(values: AssetFormValues) {
    const input = {
      name: values.name,
      client_id: values.clientId,
      type: values.type?.trim() ? values.type : null,
      platform: values.platform?.trim() ? values.platform.trim() : null,
      url: !isCodeType && values.url?.trim() ? values.url.trim() : null,
      code: isCodeType && values.code?.trim() ? values.code.trim() : null,
      status: values.status,
      // Fase 38 — só vale a pena guardar quando o tipo é mesmo
      // "Formulário (Google Forms)"; nos outros tipos sempre null (não
      // deixa lixo de uma troca de tipo anterior).
      form_purpose:
        isGoogleForms && values.formPurpose && values.formPurpose !== FORM_PURPOSE_NONE
          ? (values.formPurpose as 'vendas' | 'perdido')
          : null,
    }
    try {
      if (asset) {
        await updateAsset.mutateAsync({ id: asset.id, ...input })
        toast.success('Ativo atualizado.')
      } else {
        await createAsset.mutateAsync(input)
        toast.success('Ativo criado.')
      }
      setOpen(false)
    } catch {
      // erro já avisado pelo onError do hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar ativo digital' : 'Novo ativo digital'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: BM Loja Aurora" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients ?? []).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo (opcional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(digitalAssetTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Meta Ads, Google Ads" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isGoogleForms && (
              <FormField
                control={form.control}
                name="formPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propósito deste formulário</FormLabel>
                    <Select value={field.value ?? FORM_PURPOSE_NONE} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FORM_PURPOSE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Só afeta resposta nova sincronizada que ainda está "Novo" — nunca sobrescreve uma classificação
                      manual já feita. Dá pra trocar depois, mesmo já conectado.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isCodeType ? (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código/snippet (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Cole aqui o código do pixel/tag..." className="font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link de acesso (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(digitalAssetStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar ativo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
