import { EnlaceConRastro } from '../contexto/Rastro'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { FiltroDeLista, FormaDelFiltro } from '../componentes/FiltroDeLista'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { useSearchParams } from 'react-router'
import { Cargando, ErrorDeCarga, esProhibido, NoDisponible } from '../componentes/Estados'
import { useProyectos } from '../contexto/proyectos'
import { rutaParaAbrir } from '../datos/fichas'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { REVISIONES, useCalidad, type Revision } from './consultas'

// S63 · calidad de datos (spec F6 §3.6 y §3.7, gis.md §8; decisión 21 del plan 6.3): las cinco revisiones de SpatialGate en
// pestañas, con filtros de objeto y proyecto en la URL y la lista paginada (sin total: «Siguiente» sigue a hasNext). cada
// registro con ficha en el portal se abre por /r/, que lo lee como quien mira y salta a su ficha (un 404 es «Registro
// reservado»); uno sin ficha se lista sin enlace
export const OBJETOS_CON_FICHA: ReadonlySet<string> = new Set([
  'locality',
  'community',
  'project_component',
  'area_of_influence',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'commitment',
  'social_risk',
  'incident'
])

const GESTION = ['grievance', 'inquiry', 'stakeholder_request', 'commitment', 'social_risk', 'incident']
const CAPAS = [
  'administrative_unit',
  'locality',
  'community',
  'community_sector',
  'road_access',
  'mining_concession',
  'environmental_feature',
  'project',
  'project_component',
  'area_of_influence',
  'land_parcel',
  'school',
  'health_facility'
]
// los objetos que cada revisión acepta (DataQuality.kt); cualquier otro es un 400 sobre object
const OBJETOS_DE: Record<Revision, readonly string[]> = {
  INVALID: [...CAPAS, ...GESTION],
  OUT_OF_ZONE: [...CAPAS, ...GESTION],
  STALE_AREA: ['area_of_influence', 'community', 'land_parcel', 'mining_concession'],
  NO_TERRITORY: GESTION,
  NO_GEOMETRY: ['locality', 'community']
}
// con un proyecto elegido solo entran los objetos que tienen proyecto
const CON_PROYECTO: ReadonlySet<string> = new Set(['project', 'project_component', 'area_of_influence', ...GESTION])

const objetosOfrecidos = (revision: Revision, hayProyecto: boolean) => OBJETOS_DE[revision].filter((o) => !hayProyecto || CON_PROYECTO.has(o))

export function CalidadPage() {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const proyectos = useProyectos()
  const pedida = busqueda.get('check')
  const revision: Revision = (REVISIONES as readonly string[]).includes(pedida ?? '') ? (pedida as Revision) : 'INVALID'
  const proyecto = busqueda.get('project') ?? undefined
  const ofrecidos = objetosOfrecidos(revision, Boolean(proyecto))
  // un object que la revisión o el proyecto no admiten no se pide (sería un 400)
  const pedido = busqueda.get('object') ?? undefined
  const objeto = pedido && ofrecidos.includes(pedido) ? pedido : undefined
  const pagina = Math.max(0, Math.trunc(Number(busqueda.get('page') ?? '0')) || 0)
  const consulta = useCalidad({ check: revision, object: objeto, project: proyecto, page: pagina })
  const cambiar = (cambios: Record<string, string | null>) => {
    const siguiente = new URLSearchParams(busqueda)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguiente.set(clave, valor)
      else siguiente.delete(clave)
    }
    // otro filtro empieza en la primera página y borra el objeto que ya no aplica
    if (!('page' in cambios)) siguiente.delete('page')
    const nuevaRevision = (cambios.check ?? revision) as Revision
    const nuevoProyecto = 'project' in cambios ? cambios.project : proyecto
    const actual = siguiente.get('object')
    if (actual && !objetosOfrecidos(nuevaRevision, Boolean(nuevoProyecto)).includes(actual)) siguiente.delete('object')
    fijar(siguiente, { replace: true })
  }
  return (
    // el ancho único y el encabezado común (design-system.md §6.1); las revisiones como las pestañas de §5.3 y los filtros como chips
    <ContenedorDePagina elemento="section">
      <EncabezadoDePagina titulo={t('calidad.titulo')} descripcion={t('calidad.ayuda')} />
      <div role="tablist" aria-label={t('calidad.titulo')} className="flex flex-wrap border-b-2 border-sg-border">
        {REVISIONES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === revision}
            // como las pestañas de design-system.md §5.3: la elegida en primary-text 800 con un borde inferior de 4 px primary
            className={`-mb-0.5 inline-flex min-h-8 items-center border-b-4 px-4 py-1.5 text-sg-body ${
              r === revision
                ? 'border-sg-primary font-extrabold text-sg-primary-text'
                : 'border-transparent font-semibold text-sg-text-secondary hover:text-sg-text'
            }`}
            onClick={() => cambiar({ check: r })}
          >
            {t(`calidad.revisiones.${r}`)}
          </button>
        ))}
      </div>
      <p className="text-sg-caption text-sg-text-muted">{t(`calidad.explicaciones.${revision}`)}</p>
      <FormaDelFiltro.Provider value="chip">
        <div className="flex flex-wrap items-center gap-2">
          <FiltroDeLista
            etiqueta={t('calidad.objeto')}
            value={objeto ?? ''}
            onChange={(e) => cambiar({ object: e.target.value })}
            opciones={ofrecidos.map((o) => ({ valor: o, etiqueta: t(`calidad.objetos.${o}`) }))}
          />
          <FiltroDeLista
            etiqueta={t('calidad.proyecto')}
            value={proyecto ?? ''}
            onChange={(e) => cambiar({ project: e.target.value })}
            opciones={(proyectos.data ?? []).map((p) => ({ valor: p.id, etiqueta: `${texto(p, 'code')} · ${texto(p, 'name')}` }))}
          />
        </div>
      </FormaDelFiltro.Provider>
      {proyecto ? <p className="text-sg-caption text-sg-text-muted">{t('calidad.notaTenant')}</p> : null}
      {consulta.isPending ? <Cargando /> : null}
      {consulta.isError && esProhibido(consulta.error) ? <NoDisponible enLista /> : null}
      {consulta.isError && !esProhibido(consulta.error) ? <ErrorDeCarga error={consulta.error} alReintentar={() => void consulta.refetch()} /> : null}
      {consulta.isPlaceholderData ? (
        <p role="status" aria-busy="true" className="text-sm text-sg-text-muted">
          {t('calidad.actualizando')}
        </p>
      ) : null}
      {consulta.data ? (
        <>
          <Table aria-label={t(`calidad.revisiones.${revision}`)} aria-busy={consulta.isPlaceholderData || undefined}>
            <thead>
              <tr>
                <Th scope="col">{t('calidad.columnas.objeto')}</Th>
                <Th scope="col">{t('calidad.columnas.registro')}</Th>
                <Th scope="col">{t('calidad.columnas.campo')}</Th>
                <Th scope="col">{t('calidad.columnas.detalle')}</Th>
              </tr>
            </thead>
            <tbody>
              {consulta.data.content.map((f) => (
                <tr key={`${f.object}-${f.id}-${f.field}`}>
                  <Td>{t(`calidad.objetos.${f.object}`, { defaultValue: f.object })}</Td>
                  <Td>
                    {OBJETOS_CON_FICHA.has(f.object) ? (
                      <EnlaceConRastro to={rutaParaAbrir(f.object, f.id)} className="text-sg-primary-text underline">
                        {f.label ?? t('calidad.sinNombre')}
                      </EnlaceConRastro>
                    ) : (
                      (f.label ?? t('calidad.sinNombre'))
                    )}
                  </Td>
                  <Td>{f.field ? t(`calidad.campos.${f.object}.${f.field}`, { defaultValue: f.field }) : '—'}</Td>
                  <Td className="text-sg-text-secondary">{f.detail ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {consulta.data.content.length === 0 ? <p className="text-sm text-sg-text-muted">{t('calidad.vacio')}</p> : null}
          {pagina > 0 || consulta.data.hasNext ? (
            <div className="flex items-center gap-2 text-sm">
              <Button size="sm" variant="secondary" disabled={pagina === 0} onClick={() => cambiar({ page: pagina - 1 > 0 ? String(pagina - 1) : null })}>
                {t('calidad.anterior')}
              </Button>
              <span>{t('calidad.pagina', { n: pagina + 1 })}</span>
              <Button size="sm" variant="secondary" disabled={!consulta.data.hasNext} onClick={() => cambiar({ page: String(pagina + 1) })}>
                {t('calidad.siguiente')}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </ContenedorDePagina>
  )
}
