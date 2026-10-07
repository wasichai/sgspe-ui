import { changeLanguage } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { client } from '../api'
import { NS } from '../i18n'

// español o inglés. changeLanguage de core guarda la elección en sgspe.lang, la clave de /admin: el idioma se comparte
export function LanguageMenu() {
  const { t, i18n } = useTranslation(NS)
  return (
    <select
      aria-label={t('shell.idioma')}
      value={i18n.resolvedLanguage ?? 'es'}
      onChange={(event) => void changeLanguage(i18n, client.keys.lang, event.target.value)}
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
