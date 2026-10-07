import { createWasichaiI18n, type WasichaiModule } from '@wasichai/core'
import type { i18n as I18n } from 'i18next'
import { client } from './api'
import { EN } from './textos/en'
import { ES } from './textos/es'

// el espacio de nombres de los textos del portal; los de core siguen en el suyo
export const NS = 'sgspe'
// español por defecto e inglés (RNF-I18N-001); el idioma elegido se guarda en sgspe.lang, la misma clave de /admin
export const IDIOMAS = ['es', 'en']

// números y fechas es-PE en los dos idiomas: 12,345.5, y la fecha en la hora de Lima
export const numeroPe = (valor: number): string => new Intl.NumberFormat('es-PE').format(valor)
export const fechaPe = (valor: Date): string => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' }).format(valor)

// los textos del portal y los formateadores es-PE sobre los de i18next (como ajustarI18n de caja-ui@a45b224,
// src/portal/i18n.ts)
export function ajustarI18n(i18n: I18n): void {
  i18n.addResourceBundle('es', NS, ES, true, true)
  i18n.addResourceBundle('en', NS, EN, true, true)
  i18n.services.formatter?.add('number', numeroPe)
  i18n.services.formatter?.add('datetime', fechaPe)
  // WCAG 3.1.1: <html lang> sigue al idioma del portal, al arrancar y cada vez que cambia
  const alIdioma = (idioma: string | undefined) => {
    document.documentElement.lang = idioma ?? 'es'
  }
  alIdioma(i18n.resolvedLanguage ?? i18n.language)
  i18n.on('languageChanged', alIdioma)
}

// el i18n de core (sus textos y los de los módulos) más los del portal
export function crearI18n(modules: readonly WasichaiModule[] = []): I18n {
  const i18n = createWasichaiI18n({ languages: IDIOMAS, storageKey: client.keys.lang, modules })
  ajustarI18n(i18n)
  return i18n
}
