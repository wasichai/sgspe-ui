import { ApiError, useAuth, useAppTitle } from '@wasichai/core'
import { Alert, Button, Input, Label } from '@wasichai/ui'
import { ArrowRight, Eye, EyeOff, Mountain } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Seccion } from '../componentes/Seccion'
import { VERSION_DEL_PORTAL } from '../config'
import { NS } from '../i18n'
import { LanguageMenu } from '../shell/LanguageMenu'
import { irA } from './navegacion'
import { esRutaDeAdmin, safeNext } from './RequireSession'

// el login del portal: la sesión de core. POST /api/auth/login guarda sgspe.token y sgspe.user, los mismos de /admin.
// empieza sin correo: el administrador sembrado es el login de desarrollo de /admin
// S01 de Civic Modern (design-system.md §6.7): sin navegación, la cabecera institucional con la marca y el idioma; a la izquierda
// (560 px) el antetítulo, el título de 36/44, los campos de 48 px con «Mostrar» pegado a la contraseña, la primaria grande y el aviso
// de acceso autorizado; a la derecha, lo que encontrará al ingresar, con el borde superior de 6 px primary; al pie, el aviso y la
// versión. sin enlaces a páginas que no existen (privacidad, accesibilidad, recuperar la contraseña): ningún control que no haga nada
export function LoginPage() {
  const { t } = useTranslation(NS)
  const { user, signIn } = useAuth()
  const { appName } = useAppTitle()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  // /admin no está en el router del portal: se llega con una navegación completa, no con navigate
  const haciaAdmin = esRutaDeAdmin(next)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
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

  const encontrara = t('login.encontrara', { returnObjects: true }) as string[]
  return (
    <div className="flex min-h-full flex-col bg-sg-bg">
      <header className="box-content flex h-14 shrink-0 items-center gap-4 border-b-4 border-sg-stripe bg-sg-header px-4 text-sg-header-text md:px-8 lg:h-sg-masthead">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-sg-md border-2 border-sg-header-text">
            <Mountain className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sg-h2 font-extrabold tracking-wide">{appName}</span>
            <span className="hidden truncate text-sg-body-sm text-sg-header-text/90 sm:block">{t('app.lema')}</span>
          </span>
        </span>
        <span className="flex-1" />
        {/* el idioma, antes de iniciar sesión: sin sesión no hay preferencias que guardar en el servidor */}
        <LanguageMenu />
      </header>
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 content-start gap-10 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16 lg:py-16 xl:px-30">
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-sg-overline text-sg-text-secondary uppercase">{t('login.antetitulo')}</p>
            <h1 className="text-[2.25rem] leading-11 font-bold tracking-tight text-balance text-sg-text">{t('login.titulo', { app: appName })}</h1>
            <p className="max-w-prose text-sg-body-lg text-sg-text-secondary">{t('login.ayuda')}</p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sg-body-lg font-bold">
                {t('login.correo')}
              </Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sg-body-lg font-bold">
                {t('login.contrasena')}
              </Label>
              <div className="flex">
                <Input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 min-w-0 flex-1 rounded-r-none"
                />
                {/* pegado a la derecha del campo; su nombre no cambia y aria-pressed dice si la contraseña está a la vista */}
                <button
                  type="button"
                  aria-pressed={visible}
                  aria-controls="password"
                  onClick={() => setVisible((v) => !v)}
                  className="flex h-12 shrink-0 items-center gap-2 rounded-r-sg-md border-2 border-l-0 border-sg-border-control bg-sg-surface px-4 text-sg-body font-bold text-sg-primary-text hover:bg-sg-surface-hover"
                >
                  {visible ? <EyeOff aria-hidden className="size-4.5" /> : <Eye aria-hidden className="size-4.5" />}
                  {t('login.mostrar')}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sg-body font-bold text-sg-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="h-12 min-w-50 px-5.5 text-base">
              {busy ? t('login.ingresando') : t('login.ingresar')}
              {busy ? null : <ArrowRight aria-hidden className="size-4.5" />}
            </Button>
          </form>
          <Alert tone="notice" className="max-w-[560px]">
            <span className="text-sg-body-sm">
              <strong className="block">{t('login.avisoTitulo')}</strong>
              {t('login.avisoTexto')}
            </span>
          </Alert>
        </section>
        {/* el panel de lo que encontrará, con el borde superior de 6 px primary de S01 */}
        <div className="lg:pt-7">
          <Seccion elemento="aside" titulo={t('login.queEncontrara')} className="space-y-3.5 border-t-6 border-t-sg-primary p-5 sm:px-5">
            <ul className="list-disc space-y-2 pl-5 text-sg-body text-sg-text">
              {encontrara.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
            <p className="border-t border-sg-border pt-3.5 text-sg-body-sm text-sg-text-secondary">{t('login.sinCuenta')}</p>
          </Seccion>
        </div>
      </main>
      <footer className="border-t-4 border-sg-primary bg-sg-surface px-4 py-4 text-sg-body-sm text-sg-text-secondary md:px-8 xl:px-30">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1">
          <span className="flex-1">{t('login.avisoTitulo')}</span>
          <span className="font-sg-mono">{t('login.version', { version: VERSION_DEL_PORTAL })}</span>
        </div>
      </footer>
    </div>
  )
}
