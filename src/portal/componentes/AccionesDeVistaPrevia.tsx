import { Fragment, useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'
import { MasAcciones } from './Pagina'

// las acciones de la vista previa con cuerpo propio (S08, design-system.md §5.3): la primaria (la siguiente transición del flujo,
// la misma de la ficha y del panel de decisión) sola en su fila, debajo dos secundarias a la vista y el resto en «Más acciones»;
// lo que impide la primaria, dicho debajo. las transiciones son las de la ficha, con su diálogo (verbo en el botón, motivo y
// transition-checks)
const SECUNDARIAS_A_LA_VISTA = 2

export function AccionesDeVistaPrevia({
  objeto,
  registro,
  proyecto,
  comprobarAntes,
  falta
}: {
  objeto: string
  registro: Registro
  proyecto?: string
  comprobarAntes?: readonly string[]
  // lo que impide la siguiente acción (useSiguienteAccion(...).falta)
  falta?: string
}) {
  const { t } = useTranslation(NS)
  const idDeFalta = useId()
  const transiciones = useTransicionesOfrecidas({
    objeto,
    registro,
    proyecto,
    comprobarAntes,
    faltaDeLaPrimaria: falta ? { id: idDeFalta, texto: falta } : undefined
  })
  const aLaVista = transiciones.otras.slice(0, SECUNDARIAS_A_LA_VISTA)
  const enMenu = [...transiciones.otras.slice(SECUNDARIAS_A_LA_VISTA), ...transiciones.destructivas]
  const hayAcciones = transiciones.primaria || aLaVista.length > 0 || enMenu.length > 0
  return (
    <>
      {hayAcciones ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="space-y-2">
          {/* sin secundarias, «Más acciones» va junto a la primaria */}
          {transiciones.primaria && aLaVista.length > 0 ? <div>{transiciones.primaria.nodo}</div> : null}
          <div className="flex flex-wrap items-center gap-2">
            {transiciones.primaria && aLaVista.length === 0 ? transiciones.primaria.nodo : null}
            {aLaVista.map((a) => (
              <Fragment key={a.clave}>{a.nodo}</Fragment>
            ))}
            {enMenu.length > 0 ? (
              <MasAcciones>
                {enMenu.map((a) => (
                  <Fragment key={a.clave}>{a.nodo}</Fragment>
                ))}
              </MasAcciones>
            ) : null}
          </div>
          {falta && transiciones.primaria ? (
            <p id={idDeFalta} className="text-sg-caption text-sg-text-secondary">
              {falta}
            </p>
          ) : null}
        </div>
      ) : null}
      {transiciones.confirmacion}
      {transiciones.dialogo}
    </>
  )
}

// los datos de la vista previa en filas de término y valor (S08); una fila sin valor no se dibuja
export interface DatoDeVistaPrevia {
  clave: string
  termino: string
  valor: ReactNode
}
export function DatosDeVistaPrevia({ filas }: { filas: readonly DatoDeVistaPrevia[] }) {
  const conValor = filas.filter((f) => f.valor !== null && f.valor !== undefined && f.valor !== '')
  if (conValor.length === 0) return null
  return (
    <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2">
      {conValor.map((f) => (
        <Fragment key={f.clave}>
          <dt className="text-sg-text-secondary">{f.termino}</dt>
          <dd className="min-w-0 text-sg-text">{f.valor}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

// la trazabilidad de la vista previa, con su título
export function TrazabilidadDeVistaPrevia({ children }: { children: ReactNode }) {
  const { t } = useTranslation(NS)
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-sm font-bold text-sg-text">
        {t('paginas.trazabilidad.titulo')}
      </h3>
      {children}
    </section>
  )
}
