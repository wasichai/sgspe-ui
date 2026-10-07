import { useSetLocale } from '@wasichai/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// español o inglés. useSetLocale de core es lo que usa /admin: guarda la elección en sgspe.lang y, con la sesión abierta,
// en las preferencias del usuario (PUT /auth/me/preferences), así que el idioma se comparte y sobrevive a la recarga
export function LanguageMenu() {
  const { t, i18n } = useTranslation(NS)
  const setLocale = useSetLocale()
  const [fallo, setFallo] = useState(false)
  // si el servidor rechaza guardarlo, core devuelve el idioma anterior y vuelve a lanzar: se avisa como en ThemeMenu
  // (title y color de error) y también a los lectores de pantalla
  const elegir = (idioma: string) => {
    setFallo(false)
    setLocale(idioma).catch(() => setFallo(true))
  }
  return (
    <>
      <select
        aria-label={t('shell.idioma')}
        value={i18n.resolvedLanguage ?? 'es'}
        onChange={(event) => elegir(event.target.value)}
        title={fallo ? t('shell.idiomaNoGuardado') : undefined}
        aria-invalid={fallo || undefined}
        className={`h-8 rounded-sg-md border bg-sg-surface px-1.5 text-sm ${fallo ? 'border-sg-danger text-sg-danger' : 'border-sg-border-strong text-sg-text'}`}
      >
        <option value="es" lang="es">
          Español
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
      {fallo && (
        <span role="alert" className="sr-only">
          {t('shell.idiomaNoGuardado')}
        </span>
      )}
    </>
  )
}
