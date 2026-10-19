import { createWasichaiI18n, type WasichaiModule } from '@wasichai/core'
import type { i18n as I18n } from 'i18next'
import { langHtml } from '../idiomaHtml'
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
export const fechaYHoraPe = (valor: Date): string =>
  new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(valor)
// un día AAAA-MM-DD (assessment_date, start_date…) se dice como fecha es-PE sin correrse de día: se toma su mediodía de Lima.
// lo que no es un día se devuelve tal cual
export const diaPe = (dia: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(dia) ? fechaPe(new Date(`${dia}T12:00:00-05:00`)) : dia)
// un mes AAAA-MM (el del calendario) se dice con su nombre: «octubre de 2026»; lo que no es un mes, tal cual
export const mesPe = (mes: string): string =>
  /^\d{4}-\d{2}$/.test(mes)
    ? new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(`${mes}-15T12:00:00-05:00`))
    : mes
// el periodo de una serie, corto para un eje: un mes «nov. 2025», un día como diaPe; lo demás, tal cual
export const periodoPe = (periodo: string): string =>
  /^\d{4}-\d{2}$/.test(periodo)
    ? new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(`${periodo}-15T12:00:00-05:00`))
    : diaPe(periodo)

// los textos del portal y los formateadores es-PE sobre los de i18next (como ajustarI18n de caja-ui@a45b224,
// src/portal/i18n.ts)
export function ajustarI18n(i18n: I18n): void {
  i18n.addResourceBundle('es', NS, ES, true, true)
  i18n.addResourceBundle('en', NS, EN, true, true)
  i18n.services.formatter?.add('number', numeroPe)
  i18n.services.formatter?.add('datetime', fechaPe)
  // WCAG 3.1.1: <html lang> sigue al idioma del portal, al arrancar y cada vez que cambia; es-PE para el español
  const alIdioma = (idioma: string | undefined) => {
    document.documentElement.lang = langHtml(idioma)
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
