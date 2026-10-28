import { Button, ConfirmDialog } from '@wasichai/ui'
import { useContext, useEffect, useRef, type FormEvent, type MutableRefObject, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router'
import { NS } from '../i18n'
import { EncabezadoDePagina } from './Pagina'
import { Pasos } from './Pasos'

// el formulario por pasos de design-system.md §6.3 (revisión de UX, etapa 5): la misma forma para toda alta larga. título y
// descripción arriba; los pasos a la izquierda (arriba en el teléfono); el paso actual con su título; y abajo, siempre en el mismo
// lugar, «Cancelar» y «Anterior» a la izquierda y «Guardar y salir» y la acción del paso a la derecha. con cambios sin guardar,
// salir avisa: por un enlace del portal (useBlocker, solo bajo un router de datos) y al cerrar o recargar la pestaña. la lógica
// del alta (validar, el borrador, el comando) sigue en cada pantalla: esta pieza solo le da la forma. el foco (tercera pasada de UX,
// 2.3): al cambiar de paso va a su título, y si un intento de avanzar o de registrar deja errores, al primer control inválido
export interface PropsDeFormularioPorPasos {
  titulo: string
  descripcion?: ReactNode
  // lo que va a la derecha del título (el conmutador del modo rápido de campo en S24)
  accionesDeCabecera?: ReactNode
  pasos: string[]
  actual: number
  visitados: number
  alIr?: (indice: number) => void
  // lo que va entre el encabezado y el formulario (el aviso del borrador recuperado)
  avisos?: ReactNode
  // sin alEnviar, el paso no es un <form> sino un grupo: la pantalla pone sus propios formularios (el asistente de proyecto,
  // cuyos pasos llevan formularios y diálogos que no pueden anidarse en otro) y su acción los envía con form=
  alEnviar?: (e: FormEvent<HTMLFormElement>) => void
  // lo que reemplaza al título del paso (un paso previo que la pantalla exige, como asignarse al proyecto)
  encabezadoDelPaso?: ReactNode
  etiquetaDelPaso?: string
  alAnterior: () => void
  anteriorDeshabilitado?: boolean
  alCancelar?: () => void
  alGuardarYSalir?: () => void
  // la acción del paso: «Siguiente» (un submit) o las del último paso
  acciones?: ReactNode
  ocupado?: boolean
  conCambios?: boolean
  // lo escrito queda como borrador en este navegador (useBorradorLocal): el aviso de salida lo dice en vez de «se perderá»
  conBorrador?: boolean
  // la pantalla la pone en true justo antes de navegar al terminar el alta o al «Guardar y salir»: esa salida no avisa
  salidaPermitida?: MutableRefObject<boolean>
  children: ReactNode
}

// la marca de una salida que no avisa (el alta terminada, «Guardar y salir»): la pantalla la pone en true antes de navegar
export function useSalidaPermitida(): MutableRefObject<boolean> {
  return useRef(false)
}

export function FormularioPorPasos({
  titulo,
  descripcion,
  accionesDeCabecera,
  pasos,
  actual,
  visitados,
  alIr,
  avisos,
  alEnviar,
  encabezadoDelPaso,
  etiquetaDelPaso,
  alAnterior,
  anteriorDeshabilitado,
  alCancelar,
  alGuardarYSalir,
  acciones,
  ocupado = false,
  conCambios = false,
  conBorrador = false,
  salidaPermitida,
  children
}: PropsDeFormularioPorPasos) {
  const { t } = useTranslation(NS)
  const contenedor = useRef<HTMLFormElement & HTMLDivElement>(null)
  const tituloDelPaso = useRef<HTMLHeadingElement>(null)
  const pasoAnterior = useRef(actual)
  useEffect(() => {
    if (pasoAnterior.current === actual) return
    pasoAnterior.current = actual
    tituloDelPaso.current?.focus()
  }, [actual])
  // después de que la pantalla validó y dibujó sus errores (o cambió de paso, incluso al que tiene la falta)
  const enfocarElPrimerError = () => setTimeout(() => contenedor.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
  const contenido = (
    <>
      {encabezadoDelPaso ?? (
        <h2 ref={tituloDelPaso} tabIndex={-1} className="text-sg-h2 font-semibold focus:outline-none">
          {pasos[actual]}
        </h2>
      )}
      {children}
      <div className="flex flex-wrap justify-between gap-2 border-t border-sg-border pt-3">
        <div className="flex flex-wrap gap-2">
          {alCancelar ? (
            <Button type="button" variant="ghost" data-navegacion disabled={ocupado} onClick={alCancelar}>
              {t('paginas.formulario.cancelar')}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" data-navegacion disabled={anteriorDeshabilitado ?? (actual === 0 || ocupado)} onClick={alAnterior}>
            {t('paginas.formulario.anterior')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {alGuardarYSalir ? (
            <Button type="button" variant="secondary" data-navegacion disabled={ocupado} onClick={alGuardarYSalir}>
              {t('paginas.formulario.guardarYSalir')}
            </Button>
          ) : null}
          {acciones ?? <Button type="submit">{t('paginas.formulario.siguiente')}</Button>}
        </div>
      </div>
    </>
  )
  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <EncabezadoDePagina titulo={titulo} descripcion={descripcion} secundarias={accionesDeCabecera} />
      {avisos}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Pasos pasos={pasos} actual={actual} visitados={visitados} alIr={alIr} />
        {alEnviar ? (
          // cada pantalla valida con su esquema y lo dice junto al control: la validación nativa no detiene el paso
          <form
            ref={contenedor}
            className="space-y-3"
            aria-label={etiquetaDelPaso ?? pasos[actual]}
            onSubmit={(e) => {
              alEnviar(e)
              enfocarElPrimerError()
            }}
            onClickCapture={(e) => {
              // la acción del último paso puede ser un botón que no envía (registrar): también busca el primer error
              if (e.target instanceof HTMLElement && e.target.closest('button[type="button"]:not([data-navegacion])')) enfocarElPrimerError()
            }}
            noValidate
          >
            {contenido}
          </form>
        ) : (
          <div ref={contenedor} role="group" className="space-y-3" aria-label={etiquetaDelPaso ?? pasos[actual]}>
            {contenido}
          </div>
        )}
      </div>
      <AvisoAlSalir conCambios={conCambios} conBorrador={conBorrador} salidaPermitida={salidaPermitida} />
    </section>
  )
}

// salir con cambios sin guardar pide confirmar: por un enlace del portal (solo bajo un router de datos, que es el del portal) y
// al cerrar o recargar la pestaña (el navegador dice su propio texto). «Guardar y salir» y el alta terminada ponen
// salidaPermitida antes de navegar, así que no lo disparan. también la usa un alta de una sola página (la QCS). con un borrador
// en el navegador, el aviso dice que lo escrito queda (tercera pasada de UX, 2.4)
export function AvisoAlSalir({
  conCambios,
  conBorrador = false,
  salidaPermitida
}: {
  conCambios: boolean
  conBorrador?: boolean
  salidaPermitida?: MutableRefObject<boolean>
}) {
  const conRouterDeDatos = useContext(UNSAFE_DataRouterContext) !== null
  useEffect(() => {
    if (!conCambios) return
    const avisar = (e: BeforeUnloadEvent) => {
      if (!salidaPermitida?.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [conCambios, salidaPermitida])
  return conRouterDeDatos ? <ConfirmarSalida conCambios={conCambios} conBorrador={conBorrador} salidaPermitida={salidaPermitida} /> : null
}

function ConfirmarSalida({
  conCambios,
  conBorrador,
  salidaPermitida
}: {
  conCambios: boolean
  conBorrador: boolean
  salidaPermitida?: MutableRefObject<boolean>
}) {
  const { t } = useTranslation(NS)
  // la condición se lee al navegar: la marca de salidaPermitida ya está puesta aunque el estado no se haya vuelto a dibujar. solo
  // salir de la página avisa: cambiar la búsqueda (el ?draft= del asistente de proyecto) sigue en ella
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) => conCambios && !salidaPermitida?.current && currentLocation.pathname !== nextLocation.pathname
  )
  if (bloqueo.state !== 'blocked') return null
  return (
    <ConfirmDialog
      title={t('paginas.formulario.salirTitulo')}
      description={t(conBorrador ? 'paginas.formulario.salirTextoConBorrador' : 'paginas.formulario.salirTexto')}
      confirmLabel={t('paginas.formulario.salir')}
      cancelLabel={t('paginas.formulario.quedarse')}
      variant={conBorrador ? 'primary' : 'danger'}
      onConfirm={() => bloqueo.proceed()}
      onCancel={() => bloqueo.reset()}
    />
  )
}
