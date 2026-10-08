import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { useSiguientePaso } from '../contexto/Rastro'
import { NS } from '../i18n'
import { destinoDe, idDeElemento, useCapas, type Encuadre } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { CAPAS_TERRITORIALES, capa } from '../mapa/capas'
import { ControlDeCapas } from '../mapa/ControlDeCapas'
import { Mapa } from '../mapa/Mapa'

// S12 · mapa territorial en F2 (screens.md §4): las capas públicas de lugares por API, la lista de lugares visibles como
// alternativa de teclado y la selección que abre directamente la ficha de la comunidad (S13) o de la localidad (S14); la
// ficha contextual con KPI-TER-01 llega en F6. "Nueva comunidad" es el flujo 2
const FICHA: Record<string, string> = { community: 'communities', locality: 'localities' }

export function TerritorioPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const paso = useSiguientePaso()
  const [busqueda] = useSearchParams()
  const proyecto = busqueda.get('project') ?? undefined
  const [encendidas, setEncendidas] = useState(() => new Set<string>(['LYR-02', 'LYR-05']))
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null)
  const [creando, setCreando] = useState(false)
  const estados = useCapas([...encendidas], { project: proyecto, bbox: encuadre })
  const sufijo = proyecto ? `?project=${encodeURIComponent(proyecto)}` : ''
  const rutaDe = (objeto: string, id: string) => (FICHA[objeto] ? `/territory/${FICHA[objeto]}/${id}${sufijo}` : null)
  // los lugares con ficha, sin repetir (una localidad puede estar en dos capas); elegir un elemento lleva a su lugar
  const lugares = new Map<string, { id: string; objeto: string; nombre: string }>()
  for (const estado of estados)
    for (const f of estado.datos?.features ?? []) {
      const destino = destinoDe(f.properties)
      const id = destino?.id ?? idDeElemento(f)
      const objeto = destino?.objeto ?? capa(estado.id)?.objeto ?? ''
      if (FICHA[objeto] && !lugares.has(`${objeto}:${id}`)) lugares.set(`${objeto}:${id}`, { id, objeto, nombre: String(f.properties.name ?? '') })
    }
  const cargando = estados.some((e) => e.cargando)
  const conError = estados.some((e) => !e.bloqueada && e.error)
  // acotado: la consulta sigue la vista del mapa, así que un mapa vacío solo dice que la vista lo está
  const aviso = avisoDelMapa(estados, true)
  const abrir = (objeto: string, id: string) => {
    const ruta = rutaDe(objeto, id)
    if (ruta) navegar(ruta, { state: paso(t('mapa.mapaTerritorial')) })
  }

  return (
    <section className="mx-auto max-w-[1440px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('mapa.mapaTerritorial')}</h1>
        <div className="flex gap-2">
          {can('community', 'CREATE') ? (
            <Button size="sm" onClick={() => setCreando(true)}>
              {t('mapa.nuevaComunidad')}
            </Button>
          ) : null}
          {can('project_component', 'CREATE') || can('land_parcel', 'CREATE') || can('mining_concession', 'CREATE') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory/imports/new${sufijo}`}>{t('mapa.importar')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[260px_1fr_260px]">
        <ControlDeCapas
          ids={CAPAS_TERRITORIALES}
          encendidas={encendidas}
          estados={estados}
          alCambiar={(id, si) => {
            const siguiente = new Set(encendidas)
            if (si) siguiente.add(id)
            else siguiente.delete(id)
            setEncendidas(siguiente)
          }}
        />
        <div className="space-y-1">
          <Mapa
            etiqueta={t('mapa.mapaTerritorial')}
            capas={estados.filter((e) => e.datos).map((e) => ({ id: e.id, datos: e.datos!, color: capa(e.id)!.color, seleccionable: true }))}
            alSeleccionar={(id, capaId, objeto) => abrir(objeto ?? capa(capaId)?.objeto ?? '', id)}
            alMoverVista={setEncuadre}
          />
          {aviso ? (
            <p role="status" className="text-sm text-sg-text-muted">
              {t(`mapa.avisos.${aviso}`)}
            </p>
          ) : null}
        </div>
        <nav aria-label={t('mapa.lugares')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
          <h2 className="font-medium">{t('mapa.lugares')}</h2>
          <p className="text-sg-caption text-sg-text-muted">{t('mapa.elegirLugar')}</p>
          {/* sin lugares, la lista dice por qué: cargando, una capa que falló (la lista estaría incompleta) o, solo si todo
              respondió, que no hay lugares en la vista */}
          {lugares.size === 0 && cargando ? (
            <p role="status" className="text-sg-caption text-sg-text-muted">
              {t('comun.cargando')}
            </p>
          ) : null}
          {conError ? (
            <p role="alert" className="text-sg-caption text-sg-danger">
              {t('mapa.errorDeCapa')}
            </p>
          ) : null}
          {lugares.size === 0 && !cargando && !conError && (aviso === null || aviso === 'vistaVacia') ? (
            <p className="text-sg-caption text-sg-text-muted">{t('mapa.sinLugares')}</p>
          ) : null}
          <ul className="max-h-[420px] space-y-1 overflow-y-auto">
            {[...lugares.values()].map((l) => (
              <li key={`${l.objeto}-${l.id}`}>
                <Link to={rutaDe(l.objeto, l.id)!} state={paso(t('mapa.mapaTerritorial'))} className="text-sg-primary-text underline">
                  {l.nombre || l.id}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <Drawer titulo={t('mapa.nuevaComunidad')} abierto={creando} alCerrar={() => setCreando(false)}>
        <FormularioDeRegistro objeto="community" alGuardar={(c) => navegar(`/territory/communities/${c.id}${sufijo}`)} alCancelar={() => setCreando(false)} />
      </Drawer>
    </section>
  )
}
