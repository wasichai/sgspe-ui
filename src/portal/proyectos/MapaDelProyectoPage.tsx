import { useAuth } from '@wasichai/core'
import { Button, Table, Tabs, Td, Th } from '@wasichai/ui'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { useProyecto } from '../contexto/proyectos'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { idDeElemento, useCapas, type Elemento, type Encuadre } from '../mapa/api'
import { CAPAS, capa } from '../mapa/capas'
import { ControlDeCapas } from '../mapa/ControlDeCapas'
import { Mapa } from '../mapa/Mapa'
import { aUtm, zonaDe } from '../mapa/utm'

// S09 · mapa del proyecto (screens.md §3, flujo 16): las dieciséis capas básicas por grupo, capturar PNG, importar, la
// barra de coordenadas en el CRS de trabajo y la tabla sincronizada: elegir en el mapa o en la tabla fija ?selected=. un
// miembro de un área (LYR-13) elige el lugar que dibuja, y una localidad o una comunidad elegida ofrece abrir su ficha
const IDS = CAPAS.map((c) => c.id)
const FICHA: Record<string, string> = { community: 'communities', locality: 'localities' }

export function MapaDelProyectoPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can } = useAuth()
  const proyecto = useProyecto(projectId)
  const [busqueda, fijar] = useSearchParams()
  const [encendidas, setEncendidas] = useState(() => new Set(CAPAS.filter((c) => c.inicial).map((c) => c.id)))
  const [encuadre, setEncuadre] = useState<Encuadre | null>(null)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const capturar = useRef<() => string | null>(() => null)
  const estados = useCapas([...encendidas], { project: projectId, bbox: encuadre })
  const [objetoElegido, seleccion = null] = busqueda.get('selected')?.split(':') ?? []
  const elegir = (objeto: string, id: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set('selected', `${objeto}:${id}`)
    fijar(siguiente, { replace: true })
  }
  const dibujadas = estados
    .filter((e) => e.datos)
    .map((e) => ({ id: e.id, datos: e.datos!, color: capa(e.id)!.color, seleccionable: true, miembros: capa(e.id)!.miembros }))
  const vacio = estados.every((e) => !e.cargando) && dibujadas.every((d) => d.datos.features.length === 0)
  const zona = zonaDe(texto(proyecto.data, 'working_crs'))

  const descargar = () => {
    const png = capturar.current()
    if (!png) return
    const enlace = document.createElement('a')
    enlace.href = png
    enlace.download = `mapa-${texto(proyecto.data, 'code') || projectId}.png`
    enlace.click()
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h2 font-semibold">{t('mapa.mapaDelProyecto')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={descargar}>
            {t('mapa.capturar')}
          </Button>
          {can('project_component', 'CREATE') ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/territory/imports/new?project=${encodeURIComponent(projectId)}`}>{t('mapa.importar')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
        <ControlDeCapas
          ids={IDS}
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
            etiqueta={t('mapa.mapaDelProyecto')}
            capas={dibujadas}
            seleccion={seleccion}
            alSeleccionar={(id, capaId, objeto) => elegir(objeto ?? capa(capaId)?.objeto ?? 'record', id)}
            alMoverVista={setEncuadre}
            alMoverCursor={setCursor}
            alCapturar={(f) => (capturar.current = f)}
          />
          <p className="font-sg-mono text-sg-caption text-sg-text-muted" aria-live="off">
            {cursor
              ? zona
                ? t('mapa.coordenadas', {
                    este: Math.round(aUtm(cursor[0], cursor[1], zona).este),
                    norte: Math.round(aUtm(cursor[0], cursor[1], zona).norte),
                    crs: texto(proyecto.data, 'working_crs')
                  })
                : t('mapa.coordenadasGeo', { lon: cursor[0].toFixed(5), lat: cursor[1].toFixed(5) })
              : ' '}
          </p>
          {vacio ? <p className="text-sm text-sg-text-muted">{t('mapa.sinGeometrias')}</p> : null}
          {seleccion && objetoElegido && FICHA[objetoElegido] ? (
            <p className="text-sm">
              {t('mapa.seleccion')}:{' '}
              <Link to={`/territory/${FICHA[objetoElegido]}/${seleccion}?project=${encodeURIComponent(projectId)}`} className="text-sg-primary-text underline">
                {t('mapa.abrirFicha')}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      <Tabs
        label={t('mapa.mapaDelProyecto')}
        tabs={[
          {
            id: 'componentes',
            label: t('mapa.tabla.componentes'),
            render: () => <Componentes proyecto={projectId} seleccion={seleccion} alElegir={(id) => elegir('project_component', id)} />
          },
          { id: 'areas', label: t('mapa.tabla.areas'), render: () => <Areas proyecto={projectId} /> },
          {
            id: 'predios',
            label: t('mapa.tabla.predios'),
            render: () => (
              <Predios
                elementos={estados.filter((e) => e.id === 'LYR-14' || e.id === 'LYR-15').flatMap((e) => e.datos?.features ?? [])}
                seleccion={seleccion}
                alElegir={(id) => elegir('land_parcel', id)}
              />
            )
          }
        ]}
      />
    </section>
  )
}

function Componentes({ proyecto, seleccion, alElegir }: { proyecto: string; seleccion: string | null; alElegir: (id: string) => void }) {
  const { t } = useTranslation(NS)
  // la versión vigente de cada componente: las reemplazadas se ven en su ficha (gis.md §2.4, RQ-GIS-010)
  const componentes = useTodos('project_component', { project: proyecto, sort: 'code', dir: 'asc' })
  const vigentes = (componentes.data ?? []).filter((c) => atributo(c, 'superseded') !== true)
  return (
    <Table aria-label={t('mapa.tabla.componentes')}>
      <thead>
        <tr>
          {(['codigo', 'tipo', 'estado', 'version'] as const).map((c) => (
            <Th key={c} scope="col">
              {t(`mapa.columnas.${c}`)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vigentes.map((c) => (
          <tr
            key={c.id}
            aria-selected={c.id === seleccion}
            className={c.id === seleccion ? 'bg-sg-primary-soft' : 'cursor-pointer hover:bg-sg-surface-hover'}
            onClick={() => alElegir(c.id)}
          >
            <Td className="font-sg-mono text-sg-caption">
              <button type="button" onClick={() => alElegir(c.id)}>
                {texto(c, 'code')}
              </button>
            </Td>
            <Td className="text-sm">{texto(c, 'component_type')}</Td>
            <Td className="text-sm">{texto(c, 'component_status')}</Td>
            <Td className="text-sm">{texto(c, 'version_number')}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function Areas({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const areas = useTodos('area_of_influence', { project: proyecto, sort: 'version_number', dir: 'desc' })
  return (
    <ul className="space-y-1 pt-2 text-sm">
      {(areas.data ?? []).map((a: Registro) => (
        <li key={a.id} className="flex items-center gap-2">
          <Link to={`/projects/${proyecto}/areas/${a.id}`} className="text-sg-primary-text underline">
            {texto(a, 'area_type')} · v{texto(a, 'version_number')}
          </Link>
          <EstadoChip objeto="area_of_influence" estado={a.state} />
          {atributo(a, 'calculated_area_ha') !== undefined && atributo(a, 'calculated_area_ha') !== null ? (
            <span className="text-sg-caption">{numeroPe(Number(atributo(a, 'calculated_area_ha')))} ha</span>
          ) : null}
        </li>
      ))}
      {areas.isSuccess && areas.data.length === 0 ? <li className="text-sg-text-muted">{t('comun.vacio')}</li> : null}
    </ul>
  )
}

function Predios({ elementos, seleccion, alElegir }: { elementos: Elemento[]; seleccion: string | null; alElegir: (id: string) => void }) {
  const { t } = useTranslation(NS)
  return (
    <Table aria-label={t('mapa.tabla.predios')}>
      <thead>
        <tr>
          {(['codigo', 'tenencia', 'area'] as const).map((c) => (
            <Th key={c} scope="col">
              {t(`mapa.columnas.${c}`)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {elementos.map((e) => {
          const id = idDeElemento(e)
          return (
            <tr key={id} aria-selected={id === seleccion} className={id === seleccion ? 'bg-sg-primary-soft' : 'cursor-pointer'} onClick={() => alElegir(id)}>
              <Td className="font-sg-mono text-sg-caption">{String(e.properties.code ?? '')}</Td>
              <Td className="text-sm">{String(e.properties.tenure_type ?? '')}</Td>
              <Td className="text-sm">
                {e.properties.calculated_area_ha === undefined || e.properties.calculated_area_ha === null
                  ? '—'
                  : numeroPe(Number(e.properties.calculated_area_ha))}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
