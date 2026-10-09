import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Tabs } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { Cargando, Consulta, ErrorDeCarga } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { Rastro } from '../contexto/Rastro'
import { usePedir } from '../datos/http'
import { atributo, leerTodos, texto, useRegistro, useTodos, usePuedeEditar, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { Dato, TrabajarEnProyecto, useRegistrosPorId } from './comunes'

// S13 · ficha de comunidad (screens.md §4, flujos 2 y 17): quién es la comunidad (registros, vida orgánica, sectores y la
// organización que la representa con sus cargos), sus grupos de interés y las áreas que la incluyen. las cifras del lugar
// (KPI-TER-01) llegan en F6. cada consulta auxiliar dice si carga o falló: nunca una lista vacía en su lugar
const HA = (v: unknown) => (v === null || v === undefined ? '—' : `${numeroPe(Number(v))} ha`)

export function FichaComunidadPage() {
  const { id = '' } = useParams()
  const comunidad = useRegistro('community', id)
  return <Consulta consulta={comunidad}>{(c) => <Ficha comunidad={c} />}</Consulta>
}

function Ficha({ comunidad }: { comunidad: Registro }) {
  const { t } = useTranslation(NS)
  const puedeEditar = usePuedeEditar('community')
  const [editando, setEditando] = useState(false)
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <Rastro />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-territory">{texto(comunidad, 'community_type')}</p>
          <h1 className="text-sg-h1 font-semibold">{texto(comunidad, 'name')}</h1>
          <p className="text-sm text-sg-text-secondary">{texto(comunidad, 'organic_status')}</p>
          {atributo(comunidad, 'registry_records_unverified') ? (
            <p
              className="inline-flex rounded-sg-sm bg-sg-warning-soft px-2 py-0.5 text-sg-caption font-medium text-sg-warning"
              title={t('territorio.comunidad.partidasAyuda')}
            >
              {t('territorio.comunidad.partidasPorVerificar')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <TrabajarEnProyecto tipo="community" id={comunidad.id} />
          <Button asChild size="sm" variant="secondary">
            <Link to="/territory">{t('territorio.verEnMapa')}</Link>
          </Button>
          {puedeEditar ? (
            <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
              {t('territorio.editar')}
            </Button>
          ) : null}
        </div>
      </header>
      {atributo(comunidad, 'registry_records_unverified') ? <Alert tone="warning">{t('territorio.comunidad.partidasAyuda')}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs
          label={texto(comunidad, 'name')}
          tabs={[
            { id: 'resumen', label: t('territorio.pestanas.resumen'), render: () => <Resumen comunidad={comunidad} /> },
            {
              id: 'registros',
              label: t('territorio.pestanas.registros'),
              render: () => <p className="pt-3 text-sm text-sg-text-muted">{t('territorio.registrosLlegan')}</p>
            },
            {
              id: 'documentos',
              label: t('territorio.pestanas.documentos'),
              render: () => <p className="pt-3 text-sm text-sg-text-muted">{t('territorio.documentosLlegan')}</p>
            }
          ]}
        />
        <AreasQueLaIncluyen comunidad={comunidad.id} />
      </div>
      <Drawer titulo={t('territorio.editar')} abierto={editando} alCerrar={() => setEditando(false)}>
        <FormularioDeRegistro objeto="community" registro={comunidad} alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      </Drawer>
    </article>
  )
}

function Resumen({ comunidad }: { comunidad: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const organizaciones = useTodos('organization', { community: comunidad.id })
  const sectores = useTodos('community_sector', { community: comunidad.id })
  const [agregando, setAgregando] = useState(false)
  return (
    <div className="space-y-4 pt-3">
      <section aria-label={t('territorio.comunidad.registro')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="mb-2 font-medium">{t('territorio.comunidad.registro')}</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <Dato etiqueta={t('territorio.comunidad.personeria')}>{texto(comunidad, 'legal_entity_record') || '—'}</Dato>
          <Dato etiqueta={t('territorio.comunidad.propiedad')}>{texto(comunidad, 'property_record') || '—'}</Dato>
          <Dato etiqueta={t('territorio.comunidad.titulo')}>{texto(comunidad, 'title_reference') || '—'}</Dato>
          <Dato etiqueta={t('territorio.comunidad.emisor')}>{texto(comunidad, 'title_issuer_as_written') || '—'}</Dato>
          <Dato etiqueta={t('territorio.comunidad.areaInscrita')}>{HA(atributo(comunidad, 'registered_area_ha'))}</Dato>
          <Dato etiqueta={t('territorio.comunidad.areaCalculada')}>{HA(atributo(comunidad, 'calculated_area_ha'))}</Dato>
        </dl>
      </section>
      <section aria-label={t('territorio.comunidad.vidaOrganica')} className="rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="mb-2 font-medium">{t('territorio.comunidad.vidaOrganica')}</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <Dato etiqueta={t('territorio.comunidad.estadoOrganico')}>{texto(comunidad, 'organic_status') || '—'}</Dato>
          <Dato etiqueta={t('territorio.comunidad.juntaInscrita')}>{atributo(comunidad, 'board_registered') ? t('comun.si') : t('comun.no')}</Dato>
          <Dato etiqueta={t('territorio.comunidad.comuneros')}>
            {atributo(comunidad, 'registered_members_count') === undefined || atributo(comunidad, 'registered_members_count') === null
              ? '—'
              : numeroPe(Number(atributo(comunidad, 'registered_members_count')))}
          </Dato>
        </dl>
        {organizaciones.isPending ? <Cargando /> : null}
        {organizaciones.isError && !organizaciones.data ? (
          <ErrorDeCarga error={organizaciones.error} alReintentar={() => void organizaciones.refetch()} />
        ) : null}
        {organizaciones.data?.length === 0 ? <p className="mt-3 text-sm text-sg-text-muted">{t('territorio.comunidad.sinRepresentante')}</p> : null}
        {(organizaciones.data ?? []).map((o) => (
          <Representante key={o.id} organizacion={o} />
        ))}
      </section>
      <section aria-label={t('territorio.comunidad.sectores')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="font-medium">{t('territorio.comunidad.sectores')}</h2>
        {sectores.isPending ? <Cargando /> : null}
        {sectores.isError && !sectores.data ? <ErrorDeCarga error={sectores.error} alReintentar={() => void sectores.refetch()} /> : null}
        <ul className="text-sm">
          {(sectores.data ?? []).map((s) => (
            <li key={s.id}>
              {texto(s, 'name')}
              {atributo(s, 'delegates_count') !== null && atributo(s, 'delegates_count') !== undefined
                ? ` · ${t('territorio.comunidad.delegados', { n: Number(atributo(s, 'delegates_count')) })}`
                : ''}
            </li>
          ))}
        </ul>
        {sectores.data?.length === 0 ? <p className="text-sm text-sg-text-muted">{t('comun.vacio')}</p> : null}
        {can('community_sector', 'CREATE') ? (
          <Button size="sm" variant="secondary" onClick={() => setAgregando(true)}>
            {t('territorio.comunidad.agregarSector')}
          </Button>
        ) : null}
      </section>
      <GruposDelLugar organizaciones={organizaciones} />
      <Drawer titulo={t('territorio.comunidad.agregarSector')} abierto={agregando} alCerrar={() => setAgregando(false)}>
        <FormularioDeRegistro
          objeto="community_sector"
          fijos={{ community: comunidad.id }}
          alGuardar={() => setAgregando(false)}
          alCancelar={() => setAgregando(false)}
        />
      </Drawer>
    </div>
  )
}

function Representante({ organizacion }: { organizacion: Registro }) {
  const { t } = useTranslation(NS)
  const cargos = useTodos('position', { organization: organizacion.id })
  return (
    <div className="mt-3 space-y-1 text-sm">
      <p>
        {t('territorio.comunidad.representa')}:{' '}
        <Link to={`/actors/${organizacion.id}`} className="text-sg-primary-text underline">
          {texto(organizacion, 'name')}
        </Link>
      </p>
      {cargos.isPending ? <Cargando /> : null}
      {cargos.isError && !cargos.data ? <ErrorDeCarga error={cargos.error} alReintentar={() => void cargos.refetch()} /> : null}
      {cargos.data ? (
        <ul aria-label={t('territorio.comunidad.cargos')} className="ml-4 list-disc">
          {cargos.data.map((c) => (
            <li key={c.id}>
              {texto(c, 'position_title')} · {texto(c, 'position_status')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

// los grupos de interés del lugar: los de las organizaciones que lo representan, en todos los proyectos legibles. una
// consulta por organización, reunidas aquí para que la sección diga si todas llegaron, si alguna falló o si no hay ninguno
function GruposDelLugar({ organizaciones: lectura }: { organizaciones: UseQueryResult<Registro[]> }) {
  const organizaciones = lectura.data
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const consultas = useQueries({
    queries: (organizaciones ?? []).map((o) => ({
      queryKey: ['records', 'stakeholder', 'todos', `organization=${o.id}`],
      queryFn: () => leerTodos(pedir, 'stakeholder', { organization: o.id }),
      retry: false
    }))
  })
  // si las organizaciones no se pudieron leer, el error es el de esa lectura y no hay nada que esperar
  const fallidaDeOrganizaciones = lectura.isError && !lectura.data
  const pendiente = !fallidaDeOrganizaciones && (organizaciones === undefined || consultas.some((c) => c.isPending))
  const fallida = fallidaDeOrganizaciones ? { error: lectura.error } : consultas.find((c) => c.isError && !c.data)
  const grupos = consultas.flatMap((c) => c.data ?? [])
  return (
    <section aria-label={t('territorio.comunidad.grupos')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="font-medium">{t('territorio.comunidad.grupos')}</h2>
      {pendiente ? <Cargando /> : null}
      {fallida ? (
        <ErrorDeCarga
          error={fallida.error}
          alReintentar={() => (fallidaDeOrganizaciones ? void lectura.refetch() : consultas.forEach((c) => c.isError && void c.refetch()))}
        />
      ) : null}
      <ul className="text-sm">
        {grupos.map((g) => (
          <FilaDeGrupo key={g.id} grupo={g} />
        ))}
      </ul>
      {!pendiente && !fallida && grupos.length === 0 ? <p className="text-sm text-sg-text-muted">{t('territorio.comunidad.sinGrupos')}</p> : null}
    </section>
  )
}

function FilaDeGrupo({ grupo }: { grupo: Registro }) {
  const nombre = useNombreDelGrupo(grupo)
  return (
    <li>
      <Link to={`/projects/${String(atributo(grupo, 'project'))}/stakeholders/${grupo.id}`} className="text-sg-primary-text underline">
        {nombre}
      </Link>{' '}
      · {texto(grupo, 'influence_group') || '—'}
    </li>
  )
}

function AreasQueLaIncluyen({ comunidad }: { comunidad: string }) {
  const { t } = useTranslation(NS)
  const miembros = useTodos('area_of_influence_member', { community: comunidad })
  return (
    <aside aria-label={t('territorio.comunidad.areas')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="font-medium">{t('territorio.comunidad.areas')}</h2>
      {miembros.isPending ? <Cargando /> : null}
      {miembros.isError && !miembros.data ? <ErrorDeCarga error={miembros.error} alReintentar={() => void miembros.refetch()} /> : null}
      {miembros.data ? <AreasDeMiembros miembros={miembros.data} /> : null}
    </aside>
  )
}

// un área de un proyecto que la cuenta no puede leer no se lista (screens.md S13): se lee cada una y se muestran las legibles
function AreasDeMiembros({ miembros }: { miembros: Registro[] }) {
  const { t } = useTranslation(NS)
  const areas = useRegistrosPorId('area_of_influence', [...new Set(miembros.map((m) => String(atributo(m, 'area_of_influence'))))])
  const condicionDe = (area: string) =>
    miembros
      .filter((m) => String(atributo(m, 'area_of_influence')) === area)
      .map((m) => texto(m, 'member_condition'))
      .filter(Boolean)
      .join(', ')
  return (
    <>
      {areas.pendiente ? <Cargando /> : null}
      {areas.error ? <ErrorDeCarga error={areas.error} alReintentar={areas.reintentar} /> : null}
      <ul>
        {areas.registros.map((a) => (
          <li key={a.id}>
            <Link to={`/projects/${String(atributo(a, 'project'))}/areas/${a.id}`} className="text-sg-primary-text underline">
              {texto(a, 'area_type')} · v{texto(a, 'version_number')}
            </Link>{' '}
            · {condicionDe(a.id)}
          </li>
        ))}
      </ul>
      {!areas.pendiente && !areas.error && areas.registros.length === 0 ? <p className="text-sg-text-muted">{t('territorio.comunidad.sinAreas')}</p> : null}
    </>
  )
}
