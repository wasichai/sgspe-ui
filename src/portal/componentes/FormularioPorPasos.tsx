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
// del alta (validar, el borrador, el comando) sigue en cada pantalla: esta pieza solo le da la forma
export interface PropsDeFormularioPorPasos {
  titulo: string
  descripcion?: ReactNode
  pasos: string[]
  actual: number
  visitados: number
  alIr?: (indice: number) => void
  // lo que va entre el encabezado y el formulario (el aviso del borrador recuperado)
  avisos?: ReactNode
  alEnviar: (e: FormEvent<HTMLFormElement>) => void
  alAnterior: () => void
  anteriorDeshabilitado?: boolean
  alCancelar?: () => void
  alGuardarYSalir?: () => void
  // la acción del paso: «Siguiente» (un submit) o las del último paso
  acciones?: ReactNode
  ocupado?: boolean
  conCambios?: boolean
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
  pasos,
  actual,
  visitados,
  alIr,
  avisos,
  alEnviar,
  alAnterior,
  anteriorDeshabilitado,
  alCancelar,
  alGuardarYSalir,
  acciones,
  ocupado = false,
  conCambios = false,
  salidaPermitida,
  children
}: PropsDeFormularioPorPasos) {
  const { t } = useTranslation(NS)
  const conRouterDeDatos = useContext(UNSAFE_DataRouterContext) !== null
  // cerrar la pestaña o recargar con cambios pide confirmar (el navegador dice su propio texto)
  useEffect(() => {
    if (!conCambios) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [conCambios])
  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <EncabezadoDePagina titulo={titulo} descripcion={descripcion} />
      {avisos}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Pasos pasos={pasos} actual={actual} visitados={visitados} alIr={alIr} />
        <form className="space-y-3" aria-label={pasos[actual]} onSubmit={alEnviar}>
          <h2 className="text-sg-h2 font-semibold">{pasos[actual]}</h2>
          {children}
          <div className="flex flex-wrap justify-between gap-2 border-t border-sg-border pt-3">
            <div className="flex flex-wrap gap-2">
              {alCancelar ? (
                <Button type="button" variant="ghost" disabled={ocupado} onClick={alCancelar}>
                  {t('paginas.formulario.cancelar')}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" disabled={anteriorDeshabilitado ?? (actual === 0 || ocupado)} onClick={alAnterior}>
                {t('paginas.formulario.anterior')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {alGuardarYSalir ? (
                <Button type="button" variant="secondary" disabled={ocupado} onClick={alGuardarYSalir}>
                  {t('paginas.formulario.guardarYSalir')}
                </Button>
              ) : null}
              {acciones ?? <Button type="submit">{t('paginas.formulario.siguiente')}</Button>}
            </div>
          </div>
        </form>
      </div>
      {conRouterDeDatos ? <AvisoDeSalida conCambios={conCambios} salidaPermitida={salidaPermitida} /> : null}
    </section>
  )
}

// salir por un enlace del portal con cambios sin guardar: se confirma. «Guardar y salir» y el alta terminada ponen
// salidaPermitida antes de navegar, así que no lo disparan
function AvisoDeSalida({ conCambios, salidaPermitida }: { conCambios: boolean; salidaPermitida?: MutableRefObject<boolean> }) {
  const { t } = useTranslation(NS)
  // la condición se lee al navegar: la marca de salidaPermitida ya está puesta aunque el estado no se haya vuelto a dibujar
  const bloqueo = useBlocker(() => conCambios && !salidaPermitida?.current)
  if (bloqueo.state !== 'blocked') return null
  return (
    <ConfirmDialog
      title={t('paginas.formulario.salirTitulo')}
      description={t('paginas.formulario.salirTexto')}
      confirmLabel={t('paginas.formulario.salir')}
      cancelLabel={t('paginas.formulario.quedarse')}
      variant="danger"
      onConfirm={() => bloqueo.proceed()}
      onCancel={() => bloqueo.reset()}
    />
  )
}
