import { useCallback, useEffect } from 'react'

// la versión imprimible de una pantalla (S03, la revisión ejecutiva): mientras se imprime, <html> lleva data-impresion (la hoja
// @media print de theme/componentes.css quita la cabecera, la navegación y los controles, y deja correr la página entera) y el
// tema claro (data-theme="light", con su color-scheme), sea cual sea el de la persona; al terminar (afterprint) vuelve el suyo.
// «Imprimir o guardar en PDF» llama a imprimir(); Ctrl+P en la misma pantalla pasa por beforeprint y queda igual, salvo los
// gráficos, que con el botón alcanzan a redibujarse en claro antes de abrir el diálogo

// lo que dura un redibujo del tema en los gráficos (GraficoImpl reaplica el tema al cambiar data-theme)
export const ESPERA_DEL_TEMA_MS = 150

interface Previo {
  tema: string | undefined
  esquema: string
}

let previo: Previo | null = null

function entrar() {
  const raiz = document.documentElement
  if (previo) return
  previo = { tema: raiz.dataset.theme, esquema: raiz.style.colorScheme }
  raiz.dataset.impresion = ''
  raiz.dataset.theme = 'light'
  raiz.style.colorScheme = 'light'
}

function salir() {
  const raiz = document.documentElement
  if (!previo) return
  if (previo.tema === undefined) delete raiz.dataset.theme
  else raiz.dataset.theme = previo.tema
  raiz.style.colorScheme = previo.esquema
  delete raiz.dataset.impresion
  previo = null
}

export function useImpresionEnClaro(): () => Promise<void> {
  useEffect(() => {
    window.addEventListener('beforeprint', entrar)
    window.addEventListener('afterprint', salir)
    return () => {
      window.removeEventListener('beforeprint', entrar)
      window.removeEventListener('afterprint', salir)
      salir()
    }
  }, [])
  return useCallback(async () => {
    entrar()
    await new Promise((listo) => setTimeout(listo, ESPERA_DEL_TEMA_MS))
    window.print()
  }, [])
}
