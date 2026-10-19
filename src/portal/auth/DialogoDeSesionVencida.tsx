import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@wasichai/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { alVencerLaSesion, client } from '../api'
import { Campo } from '../componentes/Campo'
import { NS } from '../i18n'

// la sesión vencida a mitad del trabajo (design-system.md §6.5, WAS-ADR-0031): un 401 abre este diálogo en lugar de llevar al
// login, así que la pantalla no se desmonta y lo escrito sigue ahí. con la contraseña se pide un token nuevo (el mismo correo:
// la sesión es de esa persona) y se vuelven a leer las consultas; lo que no se guardó se guarda de nuevo. «Salir» cierra la
// sesión como antes. el login va por fetch y no por el cliente: un 401 del login no debe volver a abrir este diálogo
export function DialogoDeSesionVencida() {
  const { t } = useTranslation(NS)
  const { user, signOut } = useAuth()
  const consultas = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<'incorrecta' | 'fallo' | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(
    () =>
      alVencerLaSesion(() => {
        setAbierto(true)
        return true
      }),
    []
  )
  if (!user) return null
  const ingresar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await fetch(`${client.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: user.email, password: contrasena })
      })
      if (!respuesta.ok) {
        setError(respuesta.status === 401 ? 'incorrecta' : 'fallo')
        return
      }
      const sesion = (await respuesta.json()) as { token: string; user: unknown }
      client.setToken(sesion.token)
      localStorage.setItem(client.keys.user, JSON.stringify(sesion.user))
      setContrasena('')
      setAbierto(false)
      void consultas.invalidateQueries()
    } catch {
      setError('fallo')
    } finally {
      setEnviando(false)
    }
  }
  return (
    // cerrarlo sin ingresar deja la pantalla como está (por ejemplo, para copiar lo escrito); el próximo 401 lo vuelve a abrir
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-sg-h3 font-semibold">{t('sesionVencida.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('sesionVencida.texto')}</DialogDescription>
        <form className="space-y-3" onSubmit={(e) => void ingresar(e)}>
          <p className="text-sm">
            <span className="text-sg-text-muted">{t('login.correo')}: </span>
            {user.email}
          </p>
          <Campo etiqueta={t('login.contrasena')}>
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
            )}
          </Campo>
          {error ? <Alert tone="danger">{t(error === 'incorrecta' ? 'sesionVencida.incorrecta' : 'login.fallo')}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={signOut}>
              {t('shell.salir')}
            </Button>
            <Button type="submit" disabled={enviando || !contrasena} aria-busy={enviando}>
              {enviando ? t('login.ingresando') : t('login.ingresar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
