import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATIENDE_LAS_TECLAS } from '../componentes/NavegacionDeOrigen'
import { NS } from '../i18n'

// la hoja de atajos de teclado (tercera pasada de UX, 4.7): «?» la abre desde cualquier pantalla, salvo mientras se escribe en un
// campo, y el menú de la cuenta la ofrece con abrirHojaDeAtajos. la tecla de la búsqueda se dice como la del teclado de quien mira

const ABRIR = 'sgspe:atajos'

export const abrirHojaDeAtajos = () => window.dispatchEvent(new Event(ABRIR))

// ⌘ en Mac (y en el iPad con teclado), Ctrl en los demás
export const esMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)

export function useTeclaDeBusqueda(): string {
  const { t } = useTranslation(NS)
  return esMac() ? t('atajos.buscarMac') : t('atajos.buscarOtros')
}

const FILAS = ['hoja', 'saltar', 'abrirFila', 'previa', 'siguiente', 'anterior', 'cerrar'] as const

export function HojaDeAtajos() {
  const { t } = useTranslation(NS)
  const busqueda = useTeclaDeBusqueda()
  const [abierta, setAbierta] = useState(false)
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const objetivo = e.target instanceof Element ? e.target : null
      if (objetivo && (objetivo.closest(ATIENDE_LAS_TECLAS) || (objetivo instanceof HTMLElement && objetivo.isContentEditable))) return
      e.preventDefault()
      setAbierta(true)
    }
    const alPedir = () => setAbierta(true)
    window.addEventListener('keydown', alPulsar)
    window.addEventListener(ABRIR, alPedir)
    return () => {
      window.removeEventListener('keydown', alPulsar)
      window.removeEventListener(ABRIR, alPedir)
    }
  }, [])
  if (!abierta) return null
  return (
    <Dialog open onOpenChange={(abrir) => !abrir && setAbierta(false)}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('atajos.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('atajos.descripcion')}</DialogDescription>
        <Table aria-label={t('atajos.tabla')} className="mt-4">
          <thead>
            <tr>
              <Th scope="col">{t('atajos.columnas.tecla')}</Th>
              <Th scope="col">{t('atajos.columnas.hace')}</Th>
            </tr>
          </thead>
          <tbody>
            {[{ id: 'buscar', tecla: busqueda }, ...FILAS.map((id) => ({ id, tecla: t(`atajos.nombresDeTecla.${id}`) }))].map((fila) => (
              <tr key={fila.id}>
                <Td>
                  <kbd className="rounded-sg-xs border border-sg-border px-1.5 font-sg-mono text-sg-caption">{fila.tecla}</kbd>
                </Td>
                <Td className="text-sm">{t(`atajos.teclas.${fila.id}`)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setAbierta(false)}>{t('atajos.listo')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
