import { ApiError, useAuth, useWasichaiConfig } from '@wasichai/core'
import { Button, Card, CardBody, Input, Label } from '@wasichai/ui'
import { Mountain } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { NS } from '../i18n'
import { LanguageMenu } from '../shell/LanguageMenu'
import { irA } from './navegacion'
import { esRutaDeAdmin, safeNext } from './RequireSession'

// el login del portal: la sesión de core. POST /api/auth/login guarda sgspe.token y sgspe.user, los mismos de /admin.
// empieza sin correo: el administrador sembrado es el login de desarrollo de /admin
export function LoginPage() {
  const { t } = useTranslation(NS)
  const { user, signIn } = useAuth()
  const { appName } = useWasichaiConfig()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  // /admin no está en el router del portal: se llega con una navegación completa, no con navigate
  const haciaAdmin = esRutaDeAdmin(next)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const sesionAbierta = user !== null
  useEffect(() => {
    if (sesionAbierta && haciaAdmin) irA(next)
  }, [sesionAbierta, haciaAdmin, next])

  if (user) return haciaAdmin ? null : <Navigate to={next} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      // hacia /admin sale el efecto de arriba, en cuanto la sesión queda abierta
      if (!haciaAdmin) navigate(next, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('login.incorrectas') : t('login.fallo'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-full items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageMenu />
      </div>
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-6 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Mountain className="size-6" />
            </span>
            <h1 className="text-xl font-semibold">{appName}</h1>
            <p className="text-sm text-ink-muted">{t('app.lema')}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('login.correo')}</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('login.contrasena')}</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t('login.ingresando') : t('login.ingresar')}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  )
}
