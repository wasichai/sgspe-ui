import { Button, cn } from '@wasichai/ui'
import { useAvailableTransitions, type AvailableTransition } from '@wasichai/workflow'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ITEM_DE_MENU, MasAcciones } from '../componentes/Pagina'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { siguienteTransicion } from '../fichas/siguienteAccion'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion } from './api'
import { useTextoDeAviso } from './avisos'
import { DialogoDeTransicion } from './DialogoDeTransicion'
import { esDeComando } from './reglas'

// las transiciones del estado actual para quien mira (GET …/transitions, de @wasichai/workflow). las que su rol no tiene
// no aparecen (design-system.md §6.2); las de comando tampoco: tienen su propia pantalla. la primera es la primaria, salvo
// con sinPrimaria (la ficha ya tiene la suya: un solo botón primario por encabezado). las que anulan, cancelan, retiran o
// resuelven van al final, como secundarias con texto de peligro y nombrando el objeto («Anular el proyecto»), para que no se
// confundan con «cerrar el diálogo». las de comprobarAntes consultan transition-checks al dibujarse y, si una regla las
// bloquea, salen deshabilitadas con la razón.
// agrupadas es el encabezado de una ficha (rediseño de UX, 2026-10-20): a la vista solo la del camino (siguienteTransicion, la
// misma «Siguiente acción» del panel de decisión), primaria o, con sinPrimaria, secundaria; las demás, las acciones poco
// frecuentes de la ficha (mas) y al final las destructivas van en «Más acciones», donde una bloqueada dice a la vista por qué
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
  agrupadas = false,
  mas
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
  agrupadas?: boolean
  // con agrupadas: las acciones de la ficha que no se usan a diario (Reclasificar, Crear compromiso desde esta queja), con
  // ITEM_DE_MENU, entre las transiciones y las destructivas del menú
  mas?: ReactNode
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
  const visibles = [...permitidas.filter((tr) => !esDestructiva(tr)), ...permitidas.filter(esDestructiva)]
  const abrir = (tr: AvailableTransition) => {
    setHecha(null)
    setAbierta(tr)
  }
  const confirmacion = hecha ? (
    <p role="status" className="text-sm text-sg-success">
      {t('transiciones.hecho', { a: hecha })}
    </p>
  ) : null
  const dialogo = abierta ? (
    <DialogoDeTransicion
      objeto={objeto}
      registro={registro}
      transicion={abierta}
      alCerrar={() => setAbierta(null)}
      alAplicar={() => setHecha(abierta.toLabel)}
      anexo={anexos?.[abierta.name]}
    />
  ) : null
  if (agrupadas) {
    const noDestructivas = visibles.filter((tr) => !esDestructiva(tr))
    const principal = siguienteTransicion(objeto, noDestructivas) ?? noDestructivas[0] ?? null
    const enMenu = noDestructivas.filter((tr) => tr !== principal)
    const destructivas = visibles.filter(esDestructiva)
    const conMenu = enMenu.length > 0 || destructivas.length > 0 || Boolean(mas)
    if (!principal && !conMenu && !hecha) return null
    const item = (tr: AvailableTransition) => (
      <BotonDeTransicion
        key={tr.name}
        objeto={objeto}
        registro={registro}
        transicion={tr}
        primaria={false}
        enMenu
        comprobar={comprobarAntes.includes(tr.name)}
        alAbrir={() => abrir(tr)}
      />
    )
    return (
      <div className="space-y-2">
        {/* las comprobaciones del menú corren con el menú cerrado: al abrirlo, la razón de un bloqueo ya está, y una escritura que
          las invalida (responder una pregunta) las vuelve a pedir */}
        {[...enMenu, ...destructivas]
          .filter((tr) => comprobarAntes.includes(tr.name))
          .map((tr) => (
            <ObservaComprobacion key={tr.name} objeto={objeto} id={registro.id} transicion={tr.name} />
          ))}
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap items-center gap-2">
          {conMenu ? (
            <MasAcciones etiqueta={t('paginas.mas')}>
              {enMenu.map(item)}
              {mas}
              {destructivas.length > 0 ? (
                <>
                  {enMenu.length > 0 || mas ? <hr aria-hidden className="my-1 border-sg-border" /> : null}
                  {destructivas.map(item)}
                </>
              ) : null}
            </MasAcciones>
          ) : null}
          {principal ? (
            <BotonDeTransicion
              objeto={objeto}
              registro={registro}
              transicion={principal}
              primaria={!sinPrimaria}
              comprobar={comprobarAntes.includes(principal.name)}
              alAbrir={() => abrir(principal)}
            />
          ) : null}
        </div>
        {confirmacion}
        {dialogo}
      </div>
    )
  }
  if (visibles.length === 0 && !hecha) return null
  return (
    <div className="space-y-2">
      {visibles.length > 0 ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap gap-2">
          {visibles.map((tr, i) => (
            <BotonDeTransicion
              key={tr.name}
              objeto={objeto}
              registro={registro}
              transicion={tr}
              primaria={!sinPrimaria && i === 0 && !esDestructiva(tr)}
              comprobar={comprobarAntes.includes(tr.name)}
              alAbrir={() => abrir(tr)}
            />
          ))}
        </div>
      ) : null}
      {confirmacion}
      {dialogo}
    </div>
  )
}

function ObservaComprobacion({ objeto, id, transicion }: { objeto: string; id: string; transicion: string }) {
  useComprobacion(objeto, id, transicion)
  return null
}

function BotonDeTransicion({
  objeto,
  registro,
  transicion,
  primaria,
  comprobar,
  alAbrir,
  enMenu = false
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  primaria: boolean
  comprobar: boolean
  alAbrir: () => void
  // dentro de «Más acciones»: con el aspecto del menú y, si está bloqueada, la razón a la vista bajo su nombre
  enMenu?: boolean
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
  const nombre = elObjeto ? `${transicion.label} ${elObjeto}` : transicion.label
  if (enMenu)
    return (
      <div>
        <button
          type="button"
          className={cn(ITEM_DE_MENU, destructiva && 'text-sg-danger')}
          onClick={alAbrir}
          disabled={bloqueado}
          aria-describedby={razon ? id : undefined}
        >
          {nombre}
        </button>
        {razon ? (
          <p id={id} className="px-2.5 pb-1.5 text-sg-caption text-sg-text-muted">
            {razon}
          </p>
        ) : null}
      </div>
    )
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
        {nombre}
      </Button>
      {razon ? (
        <span id={id} className="sr-only">
          {razon}
        </span>
      ) : null}
    </>
  )
}
