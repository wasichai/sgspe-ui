import { useTranslation } from 'react-i18next'

// el texto del prototipo en el idioma de VistaSgspe: l('Inicio', 'Home')
export function useL() {
  const { i18n } = useTranslation()
  const en = i18n.language?.startsWith('en')
  return (es: string, ingles: string) => (en ? ingles : es)
}
