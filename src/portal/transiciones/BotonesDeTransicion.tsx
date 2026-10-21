import { Button } from '@wasichai/ui'
import { useAvailableTransitions, type AvailableTransition } from '@wasichai/workflow'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MasAcciones } from '../componentes/Pagina'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { siguienteTransicion } from '../fichas/siguienteAccion'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion } from './api'
import { useTextoDeAviso } from './avisos'
import { DialogoDeTransicion } from './DialogoDeTransicion'
import { esDeComando } from './reglas'

// las transiciones del estado actual para quien mira (GET …/transitions, de @wasichai/workflow). las que su rol no tiene
// no aparecen (design-system.md §6.2); las de comando tampoco: tienen su propia pantalla. la primaria es la siguiente acción
// del camino del flujo (siguienteTransicion, la misma del panel de decisión; DD-02 del rediseño de UX) o, si no hay una del
// camino, la primera; salvo con sinPrimaria (la ficha ya tiene la suya: un solo botón primario por encabezado). las que anulan,
// cancelan, retiran o terminan van al final, como secundarias con texto de peligro y nombrando el objeto («Anular el
// proyecto»), para que no se confundan con «cerrar el diálogo»; con destructivasEnMenu, en «Más acciones», lejos de la primaria. las de comprobarAntes consultan transition-checks al dibujarse y, si una regla las
// bloquea, salen deshabilitadas con la razón
const DURACION_DE_LA_CONFIRMACION = 6000
const DESTINOS_DESTRUCTIVOS = new Set(['cancelled', 'voided', 'retired', 'terminated'])
export const esDestructiva = (tr: AvailableTransition): boolean => DESTINOS_DESTRUCTIVOS.has(tr.to)

export function BotonesDeTransicion({
  objeto,
  registro,
  ocultar = [],
  solo,
  comprobarAntes = [],
  proyecto,
  anexos,
  sinPrimaria = false,
  destructivasEnMenu = false
}: {
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
  // las destructivas en «Más acciones» (el encabezado de una ficha, DD-02): no quedan junto a la primaria
  destructivasEnMenu?: boolean
}) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const [abierta, setAbierta] = useState<AvailableTransition | null>(null)
  // el estado al que llevó la última transición aplicada: se confirma aunque el estado nuevo ya no ofrezca botones
  const [hecha, setHecha] = useState<string | null>(null)
  // la confirmación se va sola a los pocos segundos, o al abrir otra transición (re-revisión, menor 3)
  useEffect(() => {
    if (!hecha) return
    const plazo = setTimeout(() => setHecha(null), DURACION_DE_LA_CONFIRMACION)
    return () => clearTimeout(plazo)
  }, [hecha])
  const ofrece = proyecto === undefined || escribeEnElProyecto
  const permitidas = ofrece
    ? (transiciones.data ?? []).filter((tr) => tr.allowed && !esDeComando(objeto, tr.name) && !ocultar.includes(tr.name) && (!solo || solo.includes(tr.name)))
    : []
  const avanzan = permitidas.filter((tr) => !esDestructiva(tr))
  const destructivas = permitidas.filter(esDestructiva)
  const primaria = sinPrimaria ? null : (siguienteTransicion(objeto, avanzan) ?? avanzan[0] ?? null)
  const visibles = [...(primaria ? [primaria] : []), ...avanzan.filter((tr) => tr !== primaria), ...(destructivasEnMenu ? [] : destructivas)]
  const enMenu = destructivasEnMenu ? destructivas : []
  const abrir = (tr: AvailableTransition) => {
    setHecha(null)
    setAbierta(tr)
  }
  const boton = (tr: AvailableTransition) => (
    <BotonDeTransicion
      key={tr.name}
      objeto={objeto}
      registro={registro}
      transicion={tr}
      primaria={tr === primaria}
      comprobar={comprobarAntes.includes(tr.name)}
      alAbrir={() => abrir(tr)}
    />
  )
  if (visibles.length === 0 && enMenu.length === 0 && !hecha) return null
  return (
    <div className="space-y-2">
      {visibles.length > 0 || enMenu.length > 0 ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap gap-2">
          {visibles.map(boton)}
          {enMenu.length > 0 ? <MasAcciones>{enMenu.map(boton)}</MasAcciones> : null}
        </div>
      ) : null}
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {t('transiciones.hecho', { a: hecha })}
        </p>
      ) : null}
      {abierta ? (
        <DialogoDeTransicion
          objeto={objeto}
          registro={registro}
          transicion={abierta}
          alCerrar={() => setAbierta(null)}
          alAplicar={() => setHecha(abierta.toLabel)}
          anexo={anexos?.[abierta.name]}
        />
      ) : null}
    </div>
  )
}

function BotonDeTransicion({
  objeto,
  registro,
  transicion,
  primaria,
  comprobar,
  alAbrir
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  primaria: boolean
  comprobar: boolean
  alAbrir: () => void
}) {
  const id = useId()
  const comprobacion = useComprobacion(objeto, registro.id, comprobar ? transicion.name : null)
  // un bloqueo deshabilita el botón aunque no traiga qué decir; la razón se dice solo si existe
  const bloqueado = (comprobacion.data?.blocking.length ?? 0) > 0
  // la razón con el texto de su regla, nunca el mensaje del servidor con los nombres de la API (humo F4, D3)
  const textoDe = useTextoDeAviso(objeto)
  const razon = (comprobacion.data?.blocking ?? []).map((b) => textoDe(b, transicion).texto).find((x) => x) ?? undefined
  const { t } = useTranslation(NS)
  const destructiva = esDestructiva(transicion)
  const elObjeto = destructiva ? t(`transiciones.elObjeto.${objeto}`, { defaultValue: '' }) : ''
  return (
    <>
      <Button
        variant={primaria ? 'primary' : 'secondary'}
        size="sm"
        className={destructiva ? 'text-sg-danger' : undefined}
        onClick={alAbrir}
        disabled={bloqueado}
        title={razon}
        aria-describedby={razon ? id : undefined}
      >
        {elObjeto ? `${transicion.label} ${elObjeto}` : transicion.label}
      </Button>
      {razon ? (
        <span id={id} className="sr-only">
          {razon}
        </span>
      ) : null}
    </>
  )
}
