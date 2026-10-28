import { Button } from '@wasichai/ui'
import { type AvailableTransition } from '@wasichai/workflow'
import { useAvailableTransitions } from '../datos/flujos'
import { useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MasAcciones } from '../componentes/Pagina'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { siguienteTransicion } from '../fichas/siguienteAccion'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion } from './api'
import { useTextoDeAviso } from './avisos'
import { useBloqueosDelPaso } from './DatosDelPaso'
import { DialogoDeTransicion } from './DialogoDeTransicion'
import { esDeComando, esDestructiva } from './reglas'

// las transiciones del estado actual para quien mira (GET …/transitions, de @wasichai/workflow). las que su rol no tiene
// no aparecen (design-system.md §6.2); las de comando tampoco: tienen su propia pantalla. la primaria es la siguiente acción
// del camino del flujo (siguienteTransicion, la misma del panel de decisión; DD-02 del rediseño de UX) o, si no hay una del
// camino, la primera; salvo con sinPrimaria (la ficha ya tiene la suya: un solo botón primario por encabezado). las que anulan,
// cancelan, retiran o terminan van al final, como secundarias con texto de peligro y nombrando el objeto («Anular el
// proyecto»), para que no se confundan con «cerrar el diálogo»; con destructivasEnMenu, en «Más acciones», lejos de la primaria. las de comprobarAntes consultan transition-checks al dibujarse y, si una regla las
// bloquea, salen deshabilitadas con la razón dicha a la vista, bajo su nombre

// una transición ofrecida, lista para dibujarse donde la pantalla la ponga (la cabecera de una ficha la reparte)
export interface TransicionOfrecida {
  clave: string
  // la etiqueta de la transición («Resolver»), para decir de qué paso son las reglas que se vuelven a comprobar
  etiqueta: string
  nodo: ReactNode
}

export interface OpcionesDeTransiciones {
  objeto: string
  registro: Registro
  ocultar?: readonly string[]
  // solo estas, si se dan: la verificación de un compromiso (S32) ofrece verify y reopen_execution y nada más
  solo?: readonly string[]
  comprobarAntes?: readonly string[]
  // el proyecto del registro, si su objeto tiene alcance de proyecto: ProjectScopeGuard rechaza la transición de quien no
  // está asignado (salvo ADMIN), así que no se le ofrece (re-revisión, menor 4)
  proyecto?: string
  // por transición, lo que se agrega al motivo (DialogoDeTransicion.anexo)
  anexos?: Partial<Record<string, string>>
  sinPrimaria?: boolean
  // la ficha tiene una acción propia que es primaria cuando no hay una transición del camino: entonces no se elige otra
  primariaSoloDelCamino?: boolean
  // lo que impide la primaria, dicho en la pantalla con este id (CabeceraDeFicha): la primaria lo referencia y sale
  // deshabilitada (DD-02)
  faltaDeLaPrimaria?: { id: string; texto: string }
  // la transición se aplicó: la bandeja de aprobaciones relee sus avisos (el resuelto sale de la lista)
  alAplicar?: (transicion: AvailableTransition) => void
}

// las transiciones del registro repartidas: la primaria, las que avanzan, las destructivas, la confirmación de la última
// aplicada y el diálogo abierto
export function useTransicionesOfrecidas({
  objeto,
  registro,
  ocultar = [],
  solo,
  comprobarAntes = [],
  proyecto,
  anexos,
  sinPrimaria = false,
  primariaSoloDelCamino = false,
  faltaDeLaPrimaria,
  alAplicar
}: OpcionesDeTransiciones) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const [abierta, setAbierta] = useState<AvailableTransition | null>(null)
  // el estado al que llevó la última transición aplicada y cuándo: se confirma aunque el estado nuevo ya no ofrezca botones y queda
  // hasta la siguiente acción, abrir otra transición (DD-34 de la tercera pasada de UX: la que se iba sola a los 6 s no se leía)
  const [hecha, setHecha] = useState<{ a: string; en: number } | null>(null)
  // aplicado el paso, el foco va a la confirmación: el botón que abrió el diálogo puede irse con el estado nuevo
  const confirmacion = useRef<HTMLParagraphElement>(null)
  const ofrece = proyecto === undefined || escribeEnElProyecto
  const permitidas = ofrece
    ? (transiciones.data ?? []).filter((tr) => tr.allowed && !esDeComando(objeto, tr.name) && !ocultar.includes(tr.name) && (!solo || solo.includes(tr.name)))
    : []
  const avanzan = permitidas.filter((tr) => !esDestructiva(tr))
  const destructivas = permitidas.filter(esDestructiva)
  const delCamino = siguienteTransicion(objeto, avanzan)
  const primaria = sinPrimaria ? null : (delCamino ?? (primariaSoloDelCamino ? null : (avanzan[0] ?? null)))
  // lo que sigue, solo con las transiciones ya releídas tras el paso: las de antes dirían el paso que se acaba de dar
  const releidas = hecha !== null && transiciones.dataUpdatedAt >= hecha.en && !transiciones.isFetching
  const ahora = releidas ? delCamino?.label : undefined
  const abrir = (tr: AvailableTransition) => {
    setHecha(null)
    setAbierta(tr)
  }
  const ofrecida = (tr: AvailableTransition): TransicionOfrecida => ({
    clave: tr.name,
    etiqueta: tr.label,
    nodo: (
      <BotonDeTransicion
        key={tr.name}
        objeto={objeto}
        registro={registro}
        transicion={tr}
        primaria={tr === primaria}
        comprobar={comprobarAntes.includes(tr.name)}
        falta={tr === primaria ? faltaDeLaPrimaria : undefined}
        alAbrir={() => abrir(tr)}
      />
    )
  })
  return {
    primaria: primaria ? ofrecida(primaria) : null,
    otras: avanzan.filter((tr) => tr !== primaria).map(ofrecida),
    destructivas: destructivas.map(ofrecida),
    confirmacion: hecha ? (
      <p ref={confirmacion} role="status" tabIndex={-1} className="text-sm text-sg-success">
        {t('transiciones.hecho', { a: hecha.a })}
        {ahora ? ` ${t('transiciones.ahora', { accion: ahora })}` : null}
      </p>
    ) : null,
    dialogo: abierta ? (
      <DialogoDeTransicion
        objeto={objeto}
        registro={registro}
        transicion={abierta}
        alCerrar={() => setAbierta(null)}
        alAplicar={() => {
          setHecha({ a: abierta.toLabel, en: Date.now() })
          alAplicar?.(abierta)
        }}
        focoAlAplicar={() => confirmacion.current}
        anexo={anexos?.[abierta.name]}
      />
    ) : null
  }
}

export function BotonesDeTransicion({
  destructivasEnMenu = false,
  ...opciones
}: Omit<OpcionesDeTransiciones, 'primariaSoloDelCamino' | 'faltaDeLaPrimaria'> & {
  // las destructivas en «Más acciones» (el encabezado de una ficha, DD-02): no quedan junto a la primaria
  destructivasEnMenu?: boolean
}) {
  const { t } = useTranslation(NS)
  const { primaria, otras, destructivas, confirmacion, dialogo } = useTransicionesOfrecidas(opciones)
  const visibles = [...(primaria ? [primaria] : []), ...otras, ...(destructivasEnMenu ? [] : destructivas)]
  const enMenu = destructivasEnMenu ? destructivas : []
  if (visibles.length === 0 && enMenu.length === 0 && !confirmacion) return null
  return (
    <div className="space-y-2">
      {visibles.length > 0 || enMenu.length > 0 ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap gap-2">
          {visibles.map((x) => x.nodo)}
          {enMenu.length > 0 ? <MasAcciones>{enMenu.map((x) => x.nodo)}</MasAcciones> : null}
        </div>
      ) : null}
      {confirmacion}
      {dialogo}
    </div>
  )
}

function BotonDeTransicion({
  objeto,
  registro,
  transicion,
  primaria,
  comprobar,
  falta,
  alAbrir
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  primaria: boolean
  comprobar: boolean
  falta?: { id: string; texto: string }
  alAbrir: () => void
}) {
  const id = useId()
  const comprobacion = useComprobacion(objeto, registro.id, comprobar ? transicion.name : null)
  // un bloqueo deshabilita el botón aunque no traiga qué decir; la razón se dice solo si existe. un dato que el diálogo pide
  // (useBloqueosDelPaso) no bloquea: el botón abre el diálogo, que lo pide
  const { otros } = useBloqueosDelPaso(objeto, comprobacion.data?.blocking ?? [])
  const bloqueado = otros.length > 0
  // la razón con el texto de su regla, nunca el mensaje del servidor con los nombres de la API (humo F4, D3)
  const textoDe = useTextoDeAviso(objeto)
  const razon = otros.map((b) => textoDe(b, transicion).texto).find((x) => x) ?? undefined
  const { t } = useTranslation(NS)
  const destructiva = esDestructiva(transicion)
  const elObjeto = destructiva ? t(`transiciones.elObjeto.${objeto}`, { defaultValue: '' }) : ''
  // la razón propia y lo que falta, dicho en la pantalla, se combinan; si son el mismo texto, se dice una vez
  const propia = razon && razon !== falta?.texto ? id : null
  const describidoPor = [propia, falta?.id].filter(Boolean).join(' ') || undefined
  const boton = (
    <Button
      variant={primaria ? 'primary' : 'secondary'}
      size="sm"
      className={destructiva ? 'text-sg-danger' : undefined}
      onClick={alAbrir}
      disabled={bloqueado || Boolean(falta)}
      title={razon ?? falta?.texto}
      aria-describedby={describidoPor}
    >
      {elObjeto ? `${transicion.label} ${elObjeto}` : transicion.label}
    </Button>
  )
  // la razón a la vista, bajo el nombre (tercera pasada de UX): en «Más acciones» y en el teléfono, un title no lo ve nadie. el
  // envoltorio es siempre el mismo (sin razón, display: contents, sin caja propia): cuando la comprobación llega, el botón no se
  // vuelve a montar y no pierde el foco
  return (
    <span className={propia ? 'flex max-w-72 flex-col items-start gap-0.5' : 'contents'}>
      {boton}
      {propia ? (
        <span id={id} className="text-sg-caption text-sg-text-secondary">
          {razon}
        </span>
      ) : null}
    </span>
  )
}
