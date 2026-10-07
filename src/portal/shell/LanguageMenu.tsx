import { useSetLocale } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// español o inglés. useSetLocale de core es lo que usa /admin: guarda la elección en sgspe.lang y, con la sesión abierta,
// en las preferencias del usuario (PUT /auth/me/preferences), así que el idioma se comparte y sobrevive a la recarga
export function LanguageMenu() {
  const { t, i18n } = useTranslation(NS)
  const setLocale = useSetLocale()
  return (
    <select
      aria-label={t('shell.idioma')}
      value={i18n.resolvedLanguage ?? 'es'}
      onChange={(event) => void setLocale(event.target.value)}
      className="h-8 rounded-sg-md border border-sg-border-strong bg-sg-surface px-1.5 text-sm text-sg-text"
    >
      <option value="es" lang="es">
        Español
      </option>
      <option value="en" lang="en">
        English
      </option>
    </select>
  )
}
