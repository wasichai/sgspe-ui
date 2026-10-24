import { Button } from '@wasichai/ui'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { useEspecificacion } from '../entregables/contrato'
import { NS } from '../i18n'
import { laminaTrasTecla } from './teclas'

// el presentador de una presentación LISTO (deliverables.md §16.2, ADR-0031): ocupa la pantalla, baja la especificación (con la
// lista ya confirmada si el nivel la pide) y la dibuja con el Player de Remotion, que llega en su propio chunk (PresentadorImpl,
// como el mapa y los gráficos). cada lámina anima su entrada y se queda en su estado completo, el mismo que el PDF; se avanza con
// el teclado o los botones. sin el chunk, o con una especificación que el esquema del paquete no admite, dice que se use el PDF
export interface PropsDelReproductor {
  especificacion: unknown
  // la lámina que se muestra, desde 0
  lamina: number
  etiqueta: string
  // la especificación no es de la versión de esquema del paquete o el esquema la rechaza
  alNoAdmitir: () => void
}

const PresentadorImpl = lazy(() => import('./PresentadorImpl'))

// la pantalla completa se pide en el mismo clic que abre el presentador (el navegador la exige dentro de un gesto); si no se
// puede, el presentador ocupa la ventana igual
export function pedirPantallaCompleta(elemento: Element = document.documentElement): void {
  try {
    void elemento.requestFullscreen?.().catch(() => undefined)
  } catch {
    // sin la API (un navegador viejo, jsdom): se presenta en la ventana
  }
}

function salirDePantallaCompleta(): void {
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined)
}

export function Presentador({
  presentacion,
  etiqueta,
  listaConfirmada,
  alCerrar
}: {
  presentacion: string
  etiqueta: string
  listaConfirmada: boolean
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const especificacion = useEspecificacion(presentacion, listaConfirmada)
  const [lamina, setLamina] = useState(0)
  const [noAdmitida, setNoAdmitida] = useState(false)
  const [sinReproductor, setSinReproductor] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const slides = (especificacion.data as { slides?: unknown } | undefined)?.slides
  const total = Array.isArray(slides) ? slides.length : 0
  const muestra = especificacion.isSuccess && !noAdmitida && !sinReproductor && total > 0
  const cerrar = useCallback(() => {
    salirDePantallaCompleta()
    alCerrar()
  }, [alCerrar])
  const alNoAdmitir = useCallback(() => setNoAdmitida(true), [])
  useEffect(() => raiz.current?.focus(), [])
  // el teclado se escucha en todo el documento mientras el presentador está abierto: un botón que se deshabilita (la primera o la
  // última lámina) suelta el foco, y la presentación tiene que seguir respondiendo
  useEffect(() => {
    const teclas = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        cerrar()
        return
      }
      // la barra espaciadora y Enter sobre un botón son su clic, no un avance
      if (evento.target instanceof HTMLButtonElement && (evento.key === ' ' || evento.key === 'Enter')) return
      const siguiente = muestra ? laminaTrasTecla(evento.key, lamina, total) : null
      if (siguiente === null) return
      evento.preventDefault()
      setLamina(siguiente)
    }
    document.addEventListener('keydown', teclas)
    return () => document.removeEventListener('keydown', teclas)
  }, [cerrar, muestra, lamina, total])
  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={etiqueta}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-sg-bg text-sg-text outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="min-w-0 truncate font-medium">{etiqueta}</p>
        <div className="flex flex-wrap items-center gap-2">
          {muestra ? (
            <>
              <span aria-live="polite" className="tabular-nums">
                {t('presentaciones.presentador.lamina', { n: lamina + 1, total })}
              </span>
              <Button size="sm" variant="ghost" disabled={lamina === 0} onClick={() => setLamina((l) => Math.max(l - 1, 0))}>
                {t('presentaciones.presentador.anterior')}
              </Button>
              <Button size="sm" variant="ghost" disabled={lamina >= total - 1} onClick={() => setLamina((l) => Math.min(l + 1, total - 1))}>
                {t('presentaciones.presentador.siguiente')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pedirPantallaCompleta(raiz.current ?? undefined)}>
                {t('presentaciones.presentador.pantallaCompleta')}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="secondary" onClick={cerrar}>
            {t('presentaciones.presentador.cerrar')}
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {especificacion.isPending ? (
          <Cargando etiqueta={t('presentaciones.presentador.cargando')} />
        ) : especificacion.isError ? (
          <p role="alert" className="max-w-xl text-center">
            {mensaje(especificacion.error)}
          </p>
        ) : noAdmitida || total === 0 ? (
          <p role="alert" className="max-w-xl text-center">
            {t('presentaciones.presentador.noAdmitida')}
          </p>
        ) : (
          <LimiteDeError mensaje={t('presentaciones.presentador.fallo')} alFallar={() => setSinReproductor(true)}>
            <Suspense fallback={<Cargando etiqueta={t('presentaciones.presentador.cargando')} />}>
              {/* el ancho manda la escala: a lo sumo el alto disponible por 16:9 */}
              <div className="aspect-video w-full max-w-[calc((100vh-6rem)*16/9)]">
                <PresentadorImpl especificacion={especificacion.data} lamina={lamina} etiqueta={etiqueta} alNoAdmitir={alNoAdmitir} />
              </div>
            </Suspense>
          </LimiteDeError>
        )}
      </div>
      {muestra ? <p className="px-4 pb-2 text-sg-caption text-sg-text-muted">{t('presentaciones.presentador.teclado')}</p> : null}
    </div>
  )
}
