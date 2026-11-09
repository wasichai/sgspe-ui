import { Alert, cn } from '@wasichai/ui'
import { MapPin } from 'lucide-react'
import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { PERU, useCapas, type Coleccion } from './api'
import { capa, conPostura, dibujoDe } from './capas'
import { Mapa, type CapaDibujada } from './Mapa'

// la vista «Lista + mapa» (préstamo de B, design-system.md §5.3): la lista a la izquierda y el mapa a la derecha (40 % del ancho,
// mínimo 420 px), sincronizados por la selección (?selected=objeto:id): elegir una fila centra y marca su punto en el mapa, y
// elegir un punto marca su fila. el lugar de cada registro sale de la capa de gestión que ya lo ubica (gis.md §2.2), que el
// servidor arma con su propia geometría o la de su localidad o comunidad, como quien llama: el portal no calcula ubicaciones.
// se ofrece solo si algún registro de la lista trae una ubicación legible (ofreceMapa); un registro sin ella sigue en la lista
// con «Sin ubicación» y no mueve el mapa
interface DeLaLista {
  // la capa de gestión que dibuja los registros del objeto
  capa: string
  // el id del elemento de la capa que dibuja el registro, o null si el registro no trae ubicación legible
  lugar: (r: Registro) => string | null
}

const conLugarPropio =
  (campos: readonly string[]) =>
  (r: Registro): string | null =>
    r.geometries?.location || campos.some((c) => texto(r, c)) ? r.id : null

// los objetos con ubicación (gis.md §2.2): un compromiso (LYR-19), una QCS (LYR-20; una confidencial solo sale a quien la lee) y
// un riesgo (LYR-21) se dibujan en su punto, o en el de su localidad, comunidad o (el riesgo) área; un grupo de interés no tiene punto propio (nunca el punto de una persona, RQ-GIS-015): se dibuja la
// localidad del grupo en LYR-17, que es un lugar con sus conteos
export const DE_LA_LISTA: Readonly<Record<string, DeLaLista>> = {
  commitment: { capa: 'LYR-19', lugar: conLugarPropio(['locality', 'community']) },
  grievance: { capa: 'LYR-20', lugar: conLugarPropio(['locality', 'community']) },
  inquiry: { capa: 'LYR-20', lugar: conLugarPropio(['locality', 'community']) },
  stakeholder_request: { capa: 'LYR-20', lugar: conLugarPropio(['locality', 'community']) },
  social_risk: { capa: 'LYR-21', lugar: conLugarPropio(['locality', 'community', 'area_of_influence']) },
  stakeholder: { capa: 'LYR-17', lugar: (r) => texto(r, 'locality') || null }
}

export const lugarDe = (objeto: string, r: Registro): string | null => DE_LA_LISTA[objeto]?.lugar(r) ?? null

// la vista se ofrece solo si la lista trae algún registro con ubicación
export const ofreceMapa = (objeto: string | ((r: Registro) => string), registros: readonly Registro[]): boolean =>
  registros.some((r) => lugarDe(typeof objeto === 'string' ? objeto : objeto(r), r) !== null)

// la vista del selector que la ofrece: nunca la de entrada
export const VISTA_MAPA = 'mapa'

export function ListaConMapa({
  objeto,
  objetoDe,
  etiqueta,
  registros,
  proyecto,
  nombreDe,
  detalleDe,
  accionesDe,
  alAbrir
}: {
  // el objeto de la lista, que dice la capa que la ubica; una lista de varios objetos con la misma capa (la cola de QCS: quejas,
  // consultas y solicitudes en LYR-20) da además el de cada registro, que decide su ubicación y su ?selected=
  objeto: string
  objetoDe?: (r: Registro) => string
  etiqueta: string
  registros: readonly Registro[]
  proyecto?: string
  // el nombre de la fila (su nombre accesible) y, debajo, su detalle sin controles: la fila entera es la opción que se elige
  nombreDe: (r: Registro) => string
  detalleDe?: (r: Registro) => ReactNode
  // lo que se hace con el registro elegido (abrir su ficha, su vista previa), bajo la lista
  accionesDe?: (r: Registro) => ReactNode
  // Enter sobre una fila abre el registro, como en las tablas
  alAbrir?: (r: Registro) => void
}) {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const definicion = DE_LA_LISTA[objeto]
  const idDeCapa = definicion?.capa ?? ''
  // la capa entera del proyecto, acotada al Perú: el mapa se encuadra a lo que dibuja, no pide por la vista
  const [estado] = useCapas(definicion ? [idDeCapa] : [], { project: proyecto, bbox: PERU })
  const deCadaUno = (r: Registro) => objetoDe?.(r) ?? objeto
  const lugares = new Map(registros.map((r) => [r.id, lugarDe(deCadaUno(r), r)]))
  const claveDeLugares = [...lugares].map(([id, l]) => `${id}:${l ?? ''}`).join('|')
  // la clave resume los lugares: la misma lista da el mismo conjunto, y el mapa no vuelve a poner sus datos
  const enLaLista = useMemo(() => new Set([...lugares.values()].filter((l): l is string => l !== null)), [claveDeLugares])
  // solo los elementos de los registros de la lista: el mapa no muestra lo que la lista no tiene
  const datos = estado?.datos
  const filtrados = useMemo<Coleccion | null>(
    () => (datos ? conPostura(idDeCapa, { ...datos, features: datos.features.filter((f) => enLaLista.has(String(f.properties.__id ?? ''))) }) : null),
    [datos, enLaLista, idDeCapa]
  )
  const dibujados = new Set((filtrados?.features ?? []).map((f) => String(f.properties.__id)))
  const capas: CapaDibujada[] =
    filtrados && definicion ? [{ id: idDeCapa, datos: filtrados, color: capa(idDeCapa)!.color, ...dibujoDe(idDeCapa), seleccionable: true }] : []

  const [objetoElegido, idElegido] = busqueda.get('selected')?.split(':') ?? []
  const elegido = registros.find((r) => r.id === idElegido && deCadaUno(r) === objetoElegido)
  const elegir = (r: Registro | undefined) => {
    const siguiente = new URLSearchParams(busqueda)
    if (r) siguiente.set('selected', `${deCadaUno(r)}:${r.id}`)
    else siguiente.delete('selected')
    fijar(siguiente, { replace: true })
  }
  // elegir un punto marca su fila: la primera de la lista que se dibuja en él (varios grupos comparten una localidad)
  const alElegirEnElMapa = (id: string) => elegir(registros.find((r) => lugares.get(r.id) === id))

  const opciones = useRef(new Map<string, HTMLLIElement>())
  const enfocable = elegido?.id ?? registros[0]?.id
  const alTeclear = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    const ultimo = registros.length - 1
    const destino =
      e.key === 'ArrowDown' ? Math.min(ultimo, i + 1) : e.key === 'ArrowUp' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? ultimo : null
    if (e.key === 'Enter' && alAbrir) {
      e.preventDefault()
      return alAbrir(registros[i])
    }
    if (e.key === ' ') {
      e.preventDefault()
      return elegir(registros[i])
    }
    if (destino === null) return
    e.preventDefault()
    const r = registros[destino]
    opciones.current.get(r.id)?.focus()
    elegir(r)
  }

  const idDeLaNota = `${objeto}-lista-con-mapa-nota`
  const nombreDeLaCapa = t(`mapa.capasNombre.${idDeCapa}`)
  let aviso: ReactNode = null
  if (estado?.bloqueada) aviso = <Alert tone="notice">{t('mapa.listaConMapa.bloqueada', { capa: nombreDeLaCapa })}</Alert>
  else if (estado?.error && !estado.datos) aviso = <Alert tone="danger">{t('mapa.listaConMapa.conError', { capa: nombreDeLaCapa })}</Alert>
  else if (estado?.truncada) aviso = <Alert tone="warning">{t('mapa.listaConMapa.truncada')}</Alert>

  return (
    <section aria-label={etiqueta} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,40%)]">
      <div className="min-w-0 space-y-3">
        <p id={idDeLaNota} className="text-sg-caption text-sg-text-muted">
          {t('mapa.listaConMapa.ayuda')}
        </p>
        <ul
          role="listbox"
          aria-label={etiqueta}
          aria-describedby={idDeLaNota}
          className="divide-y divide-sg-border-subtle rounded-sg-lg border border-sg-border bg-sg-surface"
        >
          {registros.map((r, i) => {
            const lugar = lugares.get(r.id) ?? null
            const esElegido = elegido?.id === r.id
            return (
              <li
                key={r.id}
                ref={(el) => {
                  if (el) opciones.current.set(r.id, el)
                  else opciones.current.delete(r.id)
                }}
                role="option"
                aria-selected={esElegido}
                tabIndex={r.id === enfocable ? 0 : -1}
                onClick={() => elegir(r)}
                onKeyDown={(e) => alTeclear(e, i)}
                className={cn(
                  'cursor-pointer border-l-4 px-3 py-2 text-sm',
                  esElegido ? 'border-sg-primary bg-sg-primary-soft' : 'border-transparent hover:bg-sg-surface-hover'
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-semibold text-sg-text">{nombreDe(r)}</span>
                  {lugar === null ? (
                    <span className="shrink-0 text-sg-caption italic text-sg-text-muted">{t('mapa.listaConMapa.sinUbicacion')}</span>
                  ) : filtrados && !dibujados.has(lugar) ? (
                    <span className="shrink-0 text-sg-caption text-sg-text-muted">{t('mapa.listaConMapa.sinPunto')}</span>
                  ) : (
                    <MapPin aria-label={t('mapa.listaConMapa.enElMapa')} className="size-4 shrink-0 text-sg-text-muted" />
                  )}
                </span>
                {detalleDe ? <span className="mt-0.5 block text-sg-caption text-sg-text-secondary">{detalleDe(r)}</span> : null}
              </li>
            )
          })}
        </ul>
        {elegido && accionesDe ? (
          <div role="group" aria-label={t('mapa.listaConMapa.elegido', { nombre: nombreDe(elegido) })} className="flex flex-wrap items-center gap-2">
            {accionesDe(elegido)}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 space-y-2 lg:sticky lg:top-4 lg:self-start">
        {aviso}
        <Mapa
          className="relative h-[min(70vh,640px)] min-h-[360px] w-full overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface-sunken"
          etiqueta={t('mapa.listaConMapa.mapa', { lista: etiqueta })}
          capas={capas}
          seleccion={elegido ? (lugares.get(elegido.id) ?? null) : null}
          alSeleccionar={(id) => alElegirEnElMapa(id)}
          zoomAlElegir={12}
        />
        {/* el color sigue a la entidad (§3.3): la leyenda de la capa, en texto */}
        <p className="text-sg-caption text-sg-text-muted">{t('mapa.listaConMapa.leyenda', { capa: nombreDeLaCapa, n: dibujados.size })}</p>
      </div>
    </section>
  )
}
