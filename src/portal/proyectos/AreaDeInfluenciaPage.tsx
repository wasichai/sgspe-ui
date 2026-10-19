import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { BotonRecargar, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { esConflictoDeVersion, useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando, Consulta, NoDisponible, ThConExplicacion, NoEsDeSusProyectos } from '../componentes/Estados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { codigoDelError, usePedir } from '../datos/http'
import {
  atributo,
  atributosDeEscritura,
  definicionDe,
  leerTodos,
  texto,
  useCrear,
  useDefinicion,
  useRegistro,
  useTodos,
  type Registro
} from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { Mapa } from '../mapa/Mapa'
import { ResumenDelArea } from './ResumenDelArea'
import { SugerenciasDelArea } from './SugerenciasDelArea'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// S10 · área de influencia (screens.md §3, WF-O): versiones, criterios, miembros con su comparación frente a la vigente,
// alta de miembros en borrador y aprobación por POST /api/sgspe/areas-of-influence/{id}/approve (If-Match y motivo, que
// siempre se pide). una versión aprobada o reemplazada no cambia sus miembros (TerritoryWriteGuard: FROZEN_MEMBERS): se
// crea una versión nueva. dos aprobaciones a la vez se serializan en el servidor: la segunda recibe 412 o STATE_MISMATCH.
// desde F6, el resumen del área y las sugerencias del cálculo, que solo se aceptan una por una en borrador
type TipoDeMiembro = 'locality' | 'community' | 'administrative_unit'
const TIPOS: TipoDeMiembro[] = ['locality', 'community', 'administrative_unit']

const tipoDe = (m: Registro): TipoDeMiembro => TIPOS.find((t) => atributo(m, t)) ?? 'locality'
const claveDe = (m: Registro) => `${tipoDe(m)}:${String(atributo(m, tipoDe(m)))}`

export function AreaDeInfluenciaPage() {
  const { areaId = '' } = useParams()
  const area = useRegistro('area_of_influence', areaId)
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={area} noExiste={<NoEsDeSusProyectos />}>
      {(a) => <Area area={a} refrescando={area.isFetching} />}
    </Consulta>
  )
}

function Area({ area, refrescando }: { area: Registro; refrescando: boolean }) {
  const { t } = useTranslation(NS)
  // la explicación única de los lugares ilegibles, en el encabezado de la columna
  const idDelLugar = useId()
  const { can } = useAuth()
  const proyecto = String(atributo(area, 'project'))
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const etiquetas = useEtiquetasDeEstado('area_of_influence')
  const versiones = useTodos('area_of_influence', { project: proyecto, area_type: texto(area, 'area_type'), sort: 'version_number', dir: 'desc' })
  const vigente = (versiones.data ?? []).find((v) => v.state === 'approved' && v.id !== area.id)
  const miembros = useTodos('area_of_influence_member', { area_of_influence: area.id })
  const deLaVigente = useTodos('area_of_influence_member', { area_of_influence: vigente?.id }, Boolean(vigente))
  const [aprobando, setAprobando] = useState(false)
  const borrador = area.state === 'draft'
  const version = texto(area, 'version_number')
  const sinMiembros = miembros.isSuccess && miembros.data.length === 0
  // la misma colección mientras no cambien las versiones: el mapa vuelve a dibujar cuando cambia su identidad
  const capasDelMapa = useMemo(
    () =>
      [area, ...(vigente ? [vigente] : [])]
        .filter((v) => v.geometries?.boundary)
        .map((v, i) => ({
          id: `v${texto(v, 'version_number')}`,
          color: i === 0 ? '--sg-primary' : '--sg-text-muted',
          seleccionable: false,
          datos: {
            type: 'FeatureCollection' as const,
            features: [{ type: 'Feature' as const, geometry: v.geometries!.boundary!, properties: { __id: v.id } }]
          }
        })),
    [area, vigente]
  )

  // la comparación solo se dice con las dos listas leídas: mientras la de la vigente carga, "Comparando…"; si falla, "—" y el
  // error con su reintento (nunca "Nuevo" en todas las filas)
  const comparable = miembros.isSuccess && (!vigente || deLaVigente.isSuccess)
  const actuales = new Set((miembros.data ?? []).map(claveDe))
  const anteriores = new Set((deLaVigente.isSuccess ? deLaVigente.data : []).map(claveDe))
  const salen = vigente && comparable ? (deLaVigente.data ?? []).filter((m) => !actuales.has(claveDe(m))) : []
  const comparacion = (m: Registro): ComparacionDeMiembro =>
    !vigente ? null : deLaVigente.isError ? 'sinDato' : !deLaVigente.isSuccess ? 'cargando' : anteriores.has(claveDe(m)) ? 'igual' : 'nuevo'

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sg-h2 font-semibold">{t('areas.titulo', { tipo: opcion(area, 'area_type'), version })}</h1>
          <EstadoChip objeto="area_of_influence" estado={area.state} />
        </div>
        <div className="flex gap-2">
          {borrador && escribeEnElProyecto && can('area_of_influence', 'APPROVE') ? (
            <Button
              onClick={() => setAprobando(true)}
              disabled={!miembros.isSuccess || sinMiembros}
              title={sinMiembros ? t('areas.sinMiembros') : miembros.isError ? t('areas.miembrosNoCargaron') : undefined}
            >
              {t('areas.aprobar', { version })}
            </Button>
          ) : null}
          {!borrador && escribeEnElProyecto && can('area_of_influence', 'CREATE') && can('area_of_influence_member', 'CREATE') ? (
            <NuevaVersion area={area} miembros={miembros.data ?? []} versionesListas={versiones.isSuccess} />
          ) : null}
        </div>
      </header>
      <nav aria-label={t('areas.versiones')}>
        <ol className="flex flex-wrap gap-2 text-sm">
          {(versiones.data ?? []).map((v) => (
            <li key={v.id}>
              <Link
                to={`/projects/${encodeURIComponent(proyecto)}/areas/${encodeURIComponent(v.id)}`}
                aria-current={v.id === area.id ? 'page' : undefined}
                className="rounded-sg-sm border border-sg-border px-2 py-0.5"
              >
                v{texto(v, 'version_number')} · {etiquetas[v.state ?? ''] ?? v.state}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <section aria-label={t('areas.criterios')} className="grid gap-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm md:grid-cols-3">
        <p className="md:col-span-3">{texto(area, 'criteria') || '—'}</p>
        <p>
          {t('areas.definida')}: <Dia valor={texto(area, 'defined_date')} />
        </p>
        <p>
          {t('areas.areaCalculada')}:{' '}
          {atributo(area, 'calculated_area_ha') === null || atributo(area, 'calculated_area_ha') === undefined
            ? '—'
            : `${numeroPe(Number(atributo(area, 'calculated_area_ha')))} ha`}
        </p>
      </section>
      <ResumenDelArea area={area.id} />
      {!borrador ? <Alert tone="notice">{t('areas.congelada', { estado: (etiquetas[area.state ?? ''] ?? area.state ?? '').toLowerCase() })}</Alert> : null}
      {versiones.isError && !versiones.data ? <FalloDeLectura error={versiones.error} alReintentar={() => void versiones.refetch()} /> : null}
      {miembros.isError && !miembros.data ? <FalloDeLectura error={miembros.error} alReintentar={() => void miembros.refetch()} /> : null}
      {deLaVigente.isError && !deLaVigente.data ? <FalloDeLectura error={deLaVigente.error} alReintentar={() => void deLaVigente.refetch()} /> : null}
      <Table aria-label={t('areas.miembros')}>
        <thead>
          <tr>
            {(['lugar', 'tipo', 'condicion', 'criterio', 'justificacion', 'estudiado'] as const).map((c) =>
              c === 'lugar' ? (
                <ThConExplicacion key={c} explicacion={idDelLugar} tipo="noDisponible" soloLectores>
                  {t(`areas.columnas.${c}`)}
                </ThConExplicacion>
              ) : (
                <Th key={c} scope="col">
                  {t(`areas.columnas.${c}`)}
                </Th>
              )
            )}
            {vigente ? <Th scope="col">{t('areas.columnas.comparacion')}</Th> : null}
          </tr>
        </thead>
        <tbody>
          {(miembros.data ?? []).map((m) => (
            <FilaDeMiembro key={m.id} miembro={m} comparacion={comparacion(m)} idDelLugar={idDelLugar} />
          ))}
          {salen.map((m) => (
            <FilaDeMiembro key={`sale-${m.id}`} miembro={m} comparacion="sale" idDelLugar={idDelLugar} />
          ))}
        </tbody>
      </Table>
      {miembros.isPending ? <Cargando /> : null}
      {borrador && escribeEnElProyecto && can('area_of_influence_member', 'CREATE') ? <AgregarMiembro area={area.id} /> : null}
      <SugerenciasDelArea area={area.id} editable={borrador && escribeEnElProyecto && can('area_of_influence_member', 'CREATE')} />
      <Mapa etiqueta={t('areas.mapa')} className="relative h-72 w-full overflow-hidden rounded-sg-lg border border-sg-border" capas={capasDelMapa} />
      {aprobando && borrador ? (
        <DialogoDeAprobacion
          area={area}
          refrescando={refrescando}
          puedeAgregarMiembros={escribeEnElProyecto && can('area_of_influence_member', 'CREATE')}
          alCerrar={() => setAprobando(false)}
        />
      ) : null}
    </section>
  )
}

type ComparacionDeMiembro = 'igual' | 'nuevo' | 'sale' | 'cargando' | 'sinDato' | null

function FilaDeMiembro({ miembro, comparacion, idDelLugar }: { miembro: Registro; comparacion: ComparacionDeMiembro; idDelLugar: string }) {
  const { t } = useTranslation(NS)
  const tipo = tipoDe(miembro)
  const lugar = useRegistro(tipo, String(atributo(miembro, tipo)))
  return (
    <tr className={comparacion === 'sale' ? 'text-sg-text-muted line-through' : undefined}>
      <Td>{lugar.isError ? <NoDisponible describedPor={idDelLugar} /> : lugar.isPending ? '…' : texto(lugar.data, 'name') || '—'}</Td>
      <Td className="text-sm">{t(`areas.tiposDeMiembro.${tipo}`)}</Td>
      <Td className="text-sm">{opcion(miembro, 'member_condition')}</Td>
      <Td className="text-sm">{texto(miembro, 'applied_criteria')}</Td>
      <Td className="text-sm">{texto(miembro, 'rationale')}</Td>
      <Td className="text-sm">{atributo(miembro, 'studied_in_diagnosis') ? t('comun.si') : t('comun.no')}</Td>
      {comparacion ? <Td className="text-sm">{comparacion === 'sinDato' ? '—' : t(`areas.comparacion.${comparacion}`)}</Td> : null}
    </tr>
  )
}

function AgregarMiembro({ area }: { area: string }) {
  const { t } = useTranslation(NS)
  const cliente = useQueryClient()
  const definicion = useDefinicion('area_of_influence_member')
  const crear = useCrear('area_of_influence_member')
  const mensaje = useMensajeDeError()
  const [tipo, setTipo] = useState<TipoDeMiembro>('locality')
  const [condicion, setCondicion] = useState('INCLUIDO')
  const [justificacion, setJustificacion] = useState('')
  const condiciones = definicion.data?.fields.find((f) => f.name === 'member_condition')?.enumOptions ?? ['INCLUIDO', 'PROVISIONAL']
  return (
    <section id="agregar-miembro" tabIndex={-1} aria-label={t('areas.agregarMiembro')} className="space-y-3 rounded-sg-lg border border-sg-border p-4">
      <h2 className="font-medium">{t('areas.agregarMiembro')}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Campo etiqueta={t('areas.tipoDeMiembro')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoDeMiembro)}
              opciones={TIPOS.map((x) => ({ valor: x, etiqueta: t(`areas.tiposDeMiembro.${x}`) }))}
            />
          )}
        </Campo>
        <Campo etiqueta={t('areas.columnas.condicion')}>
          {(p) => <SelectNativo {...p} vacio={false} value={condicion} onChange={(e) => setCondicion(e.target.value)} opciones={condiciones} />}
        </Campo>
        <Campo etiqueta={t('areas.justificacion')}>{(p) => <Textarea {...p} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />}</Campo>
      </div>
      <BuscadorDeRegistro
        objeto={tipo}
        etiqueta={t('areas.buscarLugar')}
        rotulo={(r) => texto(r, 'name')}
        alElegir={(r) =>
          crear.mutate(
            { atributos: { area_of_influence: area, [tipo]: r.id, member_condition: condicion, rationale: justificacion } },
            {
              onSuccess: () => setJustificacion(''),
              // el área se aprobó mientras se editaba: se relee para que la pantalla deje de ofrecer agregar
              onError: (error) => {
                if (codigoDelError(error) === 'FROZEN_MEMBERS') {
                  void cliente.invalidateQueries({ queryKey: ['record', 'area_of_influence', area] })
                  void cliente.invalidateQueries({ queryKey: ['records', 'area_of_influence'] })
                }
              }
            }
          )
        }
      />
      {crear.isError ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
    </section>
  )
}

function DialogoDeAprobacion({
  area,
  refrescando,
  puedeAgregarMiembros,
  alCerrar
}: {
  area: Registro
  refrescando: boolean
  puedeAgregarMiembros: boolean
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const releer = useReleer()
  const mensaje = useMensajeDeError()
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const version = texto(area, 'version_number')
  const aprobar = useMutation({
    mutationFn: () =>
      pedir<{ approved: Registro; superseded: Registro | null }>(`/sgspe/areas-of-influence/${area.id}/approve`, {
        metodo: 'POST',
        version: area.updatedAt,
        motivo
      }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['records', 'area_of_influence'] })
      void cliente.invalidateQueries({ queryKey: ['record', 'area_of_influence'] })
      void cliente.invalidateQueries({ queryKey: ['layer'] })
      alCerrar()
    }
  })
  const codigo = codigoDelError(aprobar.error)
  // relee el área (y sus versiones): un 412 o un 428 conserva el motivo para volver a aprobar; STATE_MISMATCH cierra, porque
  // la versión ya no está en borrador
  // (BotonRecargar quita el aviso, o cierra, solo cuando la relectura llegó)
  const releerArea = () => releer(['record', 'area_of_influence', area.id], ['records', 'area_of_influence'], ['records', 'area_of_influence_member'])
  const trasRecargar = (cerrar: boolean) => {
    aprobar.reset()
    if (cerrar) alCerrar()
  }
  // sin miembros en el servidor: se releen y el foco va a "Agregar miembro"
  const agregarMiembros = () => {
    void cliente.invalidateQueries({ queryKey: ['records', 'area_of_influence_member'] })
    alCerrar()
    setTimeout(() => document.getElementById('agregar-miembro')?.focus(), 0)
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('areas.aprobarTitulo', { version })}</DialogTitle>
        <DialogDescription className="text-sm">{t('areas.reglas')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <Alert tone="notice">{t('areas.quePasara', { version })}</Alert>
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {aprobar.isError ? (
            <Alert tone="danger">
              {mensaje(aprobar.error, { MEMBERS_REQUIRED: t('areas.errores.MEMBERS_REQUIRED'), STATE_MISMATCH: t('areas.errores.STATE_MISMATCH') })}
              {codigo === 'MEMBERS_REQUIRED' ? (
                puedeAgregarMiembros ? (
                  <Button variant="secondary" size="sm" className="mt-2 block" onClick={agregarMiembros}>
                    {t('areas.agregarMiembros')}
                  </Button>
                ) : (
                  <p className="mt-2">{t('areas.sinPermisoParaMiembros')}</p>
                )
              ) : esConflictoDeVersion(aprobar.error) || codigo === 'STATE_MISMATCH' || (aprobar.error instanceof ApiError && aprobar.error.status === 428) ? (
                <BotonRecargar className="mt-2 block" releer={releerArea} alRecargar={() => trasRecargar(codigo === 'STATE_MISMATCH')} />
              ) : null}
            </Alert>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button
            disabled={aprobar.isPending || refrescando}
            onClick={() => {
              setIntentado(true)
              if (motivo.trim()) aprobar.mutate()
            }}
          >
            {aprobar.isPending ? t('areas.aprobando') : t('areas.aprobar', { version })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// una versión nueva desde una aprobada: el siguiente número, los mismos criterios y una copia de sus miembros en borrador.
// son escrituras sucesivas (la API genérica no es transaccional, decisión 17): si una falla, la versión ya creada queda a
// medias y el aviso enlaza a ella para completarla; reintentar relee las versiones para tomar el número siguiente de verdad
function NuevaVersion({ area, miembros, versionesListas }: { area: Registro; miembros: Registro[]; versionesListas: boolean }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const navegar = useNavigate()
  const mensaje = useMensajeDeError()
  const proyecto = String(atributo(area, 'project'))
  const [creada, setCreada] = useState<Registro | null>(null)
  const crear = useMutation({
    mutationFn: async () => {
      setCreada(null)
      const existentes = await leerTodos(pedir, 'area_of_influence', {
        project: proyecto,
        area_type: texto(area, 'area_type'),
        sort: 'version_number',
        dir: 'desc'
      })
      const siguiente = Math.max(Number(atributo(area, 'version_number') ?? 0), ...existentes.map((v) => Number(atributo(v, 'version_number') ?? 0))) + 1
      // la copia se arma con la definición de quien llama (atributosDeEscritura): un campo que no puede escribir no viaja
      const [defArea, defMiembro] = await Promise.all([
        definicionDe(cliente, pedir, 'area_of_influence'),
        definicionDe(cliente, pedir, 'area_of_influence_member')
      ])
      const nueva = await pedir<Registro>('/objects/area_of_influence/records', {
        json: {
          attributes: atributosDeEscritura('area_of_influence', defArea, {
            project: atributo(area, 'project'),
            area_type: atributo(area, 'area_type'),
            version_number: siguiente,
            criteria: atributo(area, 'criteria') ?? null,
            study: atributo(area, 'study') ?? null
          })
        }
      })
      setCreada(nueva)
      const todos = miembros.length ? miembros : await leerTodos(pedir, 'area_of_influence_member', { area_of_influence: area.id })
      for (const m of todos) {
        const tipo = tipoDe(m)
        await pedir('/objects/area_of_influence_member/records', {
          json: {
            attributes: atributosDeEscritura('area_of_influence_member', defMiembro, {
              area_of_influence: nueva.id,
              [tipo]: atributo(m, tipo),
              member_condition: atributo(m, 'member_condition'),
              applied_criteria: atributo(m, 'applied_criteria') ?? null,
              rationale: atributo(m, 'rationale') ?? null,
              studied_in_diagnosis: atributo(m, 'studied_in_diagnosis') ?? null
            })
          }
        })
      }
      return nueva
    },
    // con éxito o a medias, las listas de versiones y de miembros se releen
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: ['records', 'area_of_influence'] })
      void cliente.invalidateQueries({ queryKey: ['records', 'area_of_influence_member'] })
    },
    onSuccess: (nueva) => navegar(`/projects/${encodeURIComponent(proyecto)}/areas/${encodeURIComponent(nueva.id)}`)
  })
  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="secondary" onClick={() => crear.mutate()} disabled={crear.isPending || !versionesListas}>
        {crear.isPending ? t('areas.creandoVersion') : t('areas.nuevaVersion')}
      </Button>
      {crear.isError ? (
        <Alert tone="danger">
          <p>{mensaje(crear.error)}</p>
          {creada ? (
            <p className="mt-1">
              {t('areas.versionCreada', { version: texto(creada, 'version_number') })}{' '}
              <Link
                to={`/projects/${encodeURIComponent(proyecto)}/areas/${encodeURIComponent(creada.id)}`}
                className="font-medium text-sg-primary-text underline"
              >
                {t('areas.continuarEnLaCreada')}
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}
    </div>
  )
}
