import { EncabezadoDePagina } from '../componentes/Pagina'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando, NoDisponible, Restringido } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { nombreDe } from '../componentes/NombreDeActor'
import { Rastro } from '../contexto/Rastro'
import { usePedir } from '../datos/http'
import { atributo, texto, usePuedeEditar, useRegistro, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// S18 · ficha de actor (screens.md §5): la persona u organización detrás de uno o varios grupos de interés, con sus cargos,
// su red de relaciones, los proyectos donde es grupo de interés y sus medios de contacto con consentimiento. el actor es
// del tenant: /actors/:actorId es una organización o una persona, y se lee la que exista
type Tipo = 'organization' | 'person'

const estadoHttp = (error: unknown): number | undefined => (error instanceof ApiError ? error.status : undefined)

// lo que una lista dice mientras no hay filas que mostrar: la carga, el fallo (solo sin datos: un refetch fallido deja a la
// vista lo leído) o el vacío de verdad, nunca un vacío que en realidad es una lectura pendiente o fallida
function EstadoDeLista({ consultas, vacio }: { consultas: UseQueryResult<Registro[]>[]; vacio: string }) {
  const fallida = consultas.find((c) => c.isError && !c.data)
  if (fallida) return <FalloDeLectura error={fallida.error} alReintentar={() => consultas.forEach((c) => void c.refetch())} />
  if (consultas.some((c) => c.isPending)) return <Cargando compacto />
  if (consultas.every((c) => (c.data ?? []).length === 0)) return <p className="text-sm text-sg-text-muted">{vacio}</p>
  return null
}

export function FichaActorPage() {
  const { actorId = '' } = useParams()
  const organizacion = useRegistro('organization', actorId)
  // solo un registro que no existe como organización (o que la cuenta no lee como tal) se busca como persona
  const buscaPersona = organizacion.isError && [403, 404].includes(estadoHttp(organizacion.error) ?? 0)
  const persona = useRegistro('person', buscaPersona ? actorId : undefined)
  if (organizacion.data) return <Ficha actor={organizacion.data} tipo="organization" />
  if (persona.data) return <Ficha actor={persona.data} tipo="person" />
  if (organizacion.isPending || (buscaPersona && persona.isPending)) return <Cargando />
  const reintentar = () => {
    void organizacion.refetch()
    if (buscaPersona) void persona.refetch()
  }
  const error = buscaPersona && !(estadoHttp(persona.error) === 404 && estadoHttp(organizacion.error) === 403) ? persona.error : organizacion.error
  return <FalloDeLectura error={error} alReintentar={reintentar} />
}

function Ficha({ actor, tipo }: { actor: Registro; tipo: Tipo }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const [editando, setEditando] = useState(false)
  const [agregandoCargo, setAgregandoCargo] = useState(false)
  const puedeEditar = usePuedeEditar(tipo)
  const cargos = useTodos('position', { [tipo]: actor.id })
  const grupos = useTodos('stakeholder', { [tipo]: actor.id })
  const contactos = useTodos('contact_method', { [tipo]: actor.id })
  const desde = useTodos('actor_relationship', { [`from_${tipo}`]: actor.id })
  const hacia = useTodos('actor_relationship', { [`to_${tipo}`]: actor.id })
  const comunidad = useRegistro('community', tipo === 'organization' ? atributo<string>(actor, 'community') : undefined)
  const nombre = nombreDe(actor, tipo, t('comun.personaRegistrada'))
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <Rastro />
      <EncabezadoDePagina
        antetitulo={tipo === 'organization' ? texto(actor, 'organization_type') || t('grupos.actor.organizacion') : t('grupos.actor.persona')}
        titulo={nombre}
        descripcion={
          tipo === 'organization' ? (
            <>
              {[opcion(actor, 'affiliation'), opcion(actor, 'territorial_level')].filter(Boolean).join(' · ')}
              {comunidad.data ? (
                <>
                  {' · '}
                  {t('grupos.actor.representa')}:{' '}
                  <Link to={`/territory/communities/${encodeURIComponent(comunidad.data.id)}`} className="text-sg-primary-text underline">
                    {texto(comunidad.data, 'name')}
                  </Link>
                </>
              ) : null}
            </>
          ) : undefined
        }
        primaria={
          puedeEditar ? (
            <Button size="sm" onClick={() => setEditando(true)}>
              {t('comun.editar')}
            </Button>
          ) : undefined
        }
        secundarias={
          tipo === 'organization' && can('position', 'CREATE') ? (
            <Button size="sm" variant="secondary" onClick={() => setAgregandoCargo(true)}>
              {t('grupos.actor.agregarCargo')}
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section aria-label={t('grupos.actor.cargos')} className="space-y-2">
            <Table aria-label={t('grupos.actor.tablaCargos')}>
              <thead>
                <tr>
                  {(['cargo', 'persona', 'estado', 'periodo'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`grupos.actor.columnasCargo.${c}`)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cargos.data ?? []).map((c) => (
                  <FilaDeCargo key={c.id} cargo={c} tipo={tipo} />
                ))}
              </tbody>
            </Table>
            <EstadoDeLista consultas={[cargos]} vacio={t('grupos.actor.sinCargos')} />
          </section>
          <section aria-label={t('grupos.actor.relaciones')} className="space-y-2">
            <Table aria-label={t('grupos.actor.tablaRelaciones')}>
              <thead>
                <tr>
                  {(['tipo', 'con', 'desde'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`grupos.actor.columnasRelacion.${c}`)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...(desde.data ?? []).map((r) => ({ r, otro: 'to' as const })), ...(hacia.data ?? []).map((r) => ({ r, otro: 'from' as const }))].map(
                  ({ r, otro }) => (
                    <FilaDeRelacion key={`${otro}-${r.id}`} relacion={r} otro={otro} />
                  )
                )}
              </tbody>
            </Table>
            <EstadoDeLista consultas={[desde, hacia]} vacio={t('grupos.actor.sinRelaciones')} />
          </section>
        </div>
        <aside className="space-y-4 text-sm">
          <section aria-label={t('grupos.actor.proyectos')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
            <h2 className="font-medium">{t('grupos.actor.proyectos')}</h2>
            <ProyectosDelActor grupos={grupos.data ?? []} />
            <EstadoDeLista consultas={[grupos]} vacio={t('grupos.actor.sinProyectos')} />
          </section>
          <section aria-label={t('grupos.actor.contactos')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
            <h2 className="font-medium">{t('grupos.actor.contactos')}</h2>
            <ul>
              {(contactos.data ?? []).map((c) => (
                <li key={c.id}>
                  {/* una clave ausente del GET es un campo restringido (security.md §7.9): se dice, no se deja vacío */}
                  {opcion(c, 'channel')}: {'contact_value' in c.attributes ? texto(c, 'contact_value') : <Restringido />}
                  {'consent_given' in c.attributes && c.attributes.consent_given !== true ? (
                    <span className="ml-1 text-sg-caption text-sg-warning">({t('grupos.actor.sinConsentimiento')})</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <EstadoDeLista consultas={[contactos]} vacio={t('grupos.actor.sinContactos')} />
          </section>
        </aside>
      </div>
      <Drawer titulo={t('comun.editar')} abierto={editando} alCerrar={() => setEditando(false)}>
        <FormularioDeRegistro objeto={tipo} registro={actor} alGuardar={() => setEditando(false)} alCancelar={() => setEditando(false)} />
      </Drawer>
      <Drawer titulo={t('grupos.actor.agregarCargo')} abierto={agregandoCargo} alCerrar={() => setAgregandoCargo(false)}>
        <FormularioDeRegistro
          objeto="position"
          fijos={{ organization: actor.id }}
          alGuardar={() => setAgregandoCargo(false)}
          alCancelar={() => setAgregandoCargo(false)}
        />
      </Drawer>
    </article>
  )
}

// el otro lado de un cargo o una relación: mientras se lee, "…"; una persona que no se pudo leer o sin nombres, "Persona
// registrada" (el nombre sale solo de lo que la API devuelve); una organización que no se pudo leer o sin nombre legible,
// "No disponible" (nunca "Persona registrada": no es una persona)
function ActorVinculado({ objeto, id, enlazar }: { objeto: Tipo; id: string | undefined; enlazar: boolean }) {
  const { t } = useTranslation(NS)
  const actor = useRegistro(objeto, id)
  if (!id) return <>—</>
  if (actor.isPending) return <>…</>
  const nombre =
    objeto === 'person' ? nombreDe(actor.data, objeto, t('comun.personaRegistrada')) || t('comun.personaRegistrada') : nombreDe(actor.data, objeto, '')
  if (!nombre) return <NoDisponible />
  return enlazar ? (
    <Link to={`/actors/${encodeURIComponent(id)}`} className="text-sg-primary-text underline">
      {nombre}
    </Link>
  ) : (
    <>{nombre}</>
  )
}

function FilaDeCargo({ cargo, tipo }: { cargo: Registro; tipo: Tipo }) {
  const otro: Tipo = tipo === 'organization' ? 'person' : 'organization'
  return (
    <tr>
      <Td>{texto(cargo, 'position_title')}</Td>
      <Td className="text-sm">
        <ActorVinculado objeto={otro} id={atributo<string>(cargo, otro)} enlazar={false} />
      </Td>
      <Td className="text-sm">{opcion(cargo, 'position_status')}</Td>
      <Td className="text-sm">
        {texto(cargo, 'term_start_date') ? <Dia valor={texto(cargo, 'term_start_date')} /> : '…'} –{' '}
        {texto(cargo, 'term_end_date') ? <Dia valor={texto(cargo, 'term_end_date')} /> : '…'}
      </Td>
    </tr>
  )
}

function FilaDeRelacion({ relacion, otro }: { relacion: Registro; otro: 'to' | 'from' }) {
  const persona = atributo<string>(relacion, `${otro}_person`)
  return (
    <tr>
      <Td className="text-sm">{opcion(relacion, 'relationship_type')}</Td>
      <Td className="text-sm">
        <ActorVinculado objeto={persona ? 'person' : 'organization'} id={persona ?? atributo<string>(relacion, `${otro}_organization`)} enlazar />
      </Td>
      <Td className="text-sm">
        <Dia valor={texto(relacion, 'start_date')} />
      </Td>
    </tr>
  )
}

// los proyectos del actor se leen juntos: mientras alguno carga hay un solo estado de carga (una fila pendiente por proyecto
// diría cuántos grupos tiene el actor fuera del alcance de la cuenta). un proyecto que la cuenta no puede leer (403 o 404) no
// se lista (screens.md S18); cualquier otro error se dice una vez, con su reintento. mismas claves que useRegistro: comparten caché
function ProyectosDelActor({ grupos }: { grupos: Registro[] }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  // un grupo sin proyecto (la clave ausente) no tiene nada que leer: no se pide /records/undefined
  const conProyecto = grupos.flatMap((g) => {
    const proyecto = atributo<string>(g, 'project')
    return proyecto ? [{ grupo: g, proyecto }] : []
  })
  const consultas = useQueries({
    queries: conProyecto.map(({ proyecto }) => ({
      queryKey: ['record', 'project', proyecto],
      queryFn: () => pedir<Registro>(`/objects/project/records/${proyecto}`)
    }))
  })
  if (conProyecto.length === 0) return null
  if (consultas.some((c) => c.isPending)) return <Cargando compacto />
  const fallida = consultas.find((c) => c.isError && !c.data && ![403, 404].includes(estadoHttp(c.error) ?? 0))
  if (fallida) return <FalloDeLectura error={fallida.error} alReintentar={() => consultas.forEach((c) => void c.refetch())} />
  const legibles = conProyecto.flatMap(({ grupo }, i) => (consultas[i].data ? [{ grupo, proyecto: consultas[i].data }] : []))
  // todos ilegibles: se dice con honestidad, sin decir cuántos son
  if (legibles.length === 0) return <p className="text-sm text-sg-text-muted">{t('grupos.actor.proyectosIlegibles')}</p>
  return (
    <ul>
      {legibles.map(({ grupo, proyecto }) => (
        <li key={grupo.id}>
          <Link to={`/projects/${encodeURIComponent(proyecto!.id)}/stakeholders/${encodeURIComponent(grupo.id)}`} className="text-sg-primary-text underline">
            {texto(proyecto, 'code')} · {texto(proyecto, 'name')}
          </Link>
        </li>
      ))}
    </ul>
  )
}
