import { createWasichaiI18n, type WasichaiModule } from '@wasichai/core'
import type { i18n as I18n } from 'i18next'
import { client } from './api'
import { ES } from './textos/es'

// el espacio de nombres de los textos del portal; los de core siguen en el suyo
export const NS = 'sgspe'
// español por defecto e inglés (RNF-I18N-001); el idioma elegido se guarda en sgspe.lang, la misma clave de /admin
export const IDIOMAS = ['es', 'en']

export function ajustarI18n(i18n: I18n): void {
  i18n.addResourceBundle('es', NS, ES, true, true)
}

// el i18n de core (sus textos y los de los módulos) más los del portal
export function crearI18n(modules: readonly WasichaiModule[] = []): I18n {
  const i18n = createWasichaiI18n({ languages: IDIOMAS, storageKey: client.keys.lang, modules })
  ajustarI18n(i18n)
  return i18n
}
