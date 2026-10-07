import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { WasichaiModule } from '@wasichai/core'

// WCAG 3.1.1: <html lang> sigue al idioma de la interfaz. el código de i18n sigue siendo `es` (core lo usa como clave de
// sus textos y en sgspe.lang); el atributo lleva la variante del design system (docs/ux/design-system.md §7): es-PE
export const langHtml = (idioma: string | undefined): string => (!idioma || idioma === 'es' ? 'es-PE' : idioma)

// core no toca <html lang>: /admin lo sigue con este módulo, que solo aporta un proveedor dentro del i18n de WasichaiApp
// (el portal lo hace en ajustarI18n, sobre su propia instancia)
function SeguirIdioma({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const idioma = i18n.resolvedLanguage ?? i18n.language
  useEffect(() => {
    document.documentElement.lang = langHtml(idioma)
  }, [idioma])
  return children
}

export const idiomaHtmlModule = (): WasichaiModule => ({ id: 'sgspe-idioma-html', providers: [SeguirIdioma] })
