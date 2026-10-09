import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { WasichaiModule } from '@wasichai/core'

// WCAG 3.1.1: <html lang> sigue al idioma de la interfaz. el código de i18n sigue siendo `es` (core lo usa como clave de
// sus textos y en sgspe.lang); el atributo lleva la variante del design system (docs/ux/design-system.md §7): es-PE
export const langHtml = (idioma: string | undefined): string => (!idioma || idioma === 'es' ? 'es-PE' : idioma)

// desde 0.5.1 core escribe <html lang> con el código de i18n (`es`); este módulo solo aporta un proveedor, por fuera de
// el, que lo deja en la variante es-PE. lo usan /admin y el portal (el portal además lo fija al arrancar en ajustarI18n)
function SeguirIdioma({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const idioma = i18n.resolvedLanguage ?? i18n.language
  useEffect(() => {
    document.documentElement.lang = langHtml(idioma)
  }, [idioma])
  return children
}

export const idiomaHtmlModule = (): WasichaiModule => ({ id: 'sgspe-idioma-html', providers: [SeguirIdioma] })
