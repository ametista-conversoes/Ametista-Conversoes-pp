import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useAuth } from '@/contexts/AuthContext'
import { AuthLayout } from './AuthLayout'

const loginSchema = z.object({
  email: z.string().min(1, 'Digite seu e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Digite sua senha'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    setSubmitting(true)
    const { error, isOffline } = await signIn(values.email, values.password)
    setSubmitting(false)

    if (error) {
      setFormError(
        isOffline
          ? 'Sem conexão com a internet. Verifique sua conexão e tente novamente.'
          : 'E-mail ou senha incorretos.',
      )
      return
    }

    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard'
    navigate(redirectTo, { replace: true })
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse o Ametista Conversões"
      footer={
        <>
          <Link to="/forgot-password" className="text-purple-400 hover:underline">
            Esqueci minha senha
          </Link>
          <span className="mx-2">·</span>
          <Link to="/register" className="text-purple-400 hover:underline">
            Criar conta
          </Link>
          <div className="mt-3 text-xs">
            <Link to="/privacy" className="text-muted-foreground hover:underline">
              Política de Privacidade
            </Link>
            <span className="mx-2">·</span>
            <Link to="/terms" className="text-muted-foreground hover:underline">
              Termos de Uso
            </Link>
          </div>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="voce@empresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
