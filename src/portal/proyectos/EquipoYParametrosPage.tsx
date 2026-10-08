import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Table, Tabs, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { Consulta } from '../componentes/Estados'
import { useMensajeDeError } from '../componentes/errores'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { atributo, puedeEscribir, texto, useActualizar, useDefinicion, usePuedeEditar, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { CampanaDelProyecto, PartesDelProyecto } from './EquipoYPartes'
import { FormularioDeAsignacion } from './FormularioDeAsignacion'
import { PARAMETROS_F2, vigente } from './parametros'

// S11 · equipo y parámetros del proyecto (screens.md §3): asignaciones con su vigencia (una vencida no da escritura,
// RQ-SEC-006), campañas con su tope y lo ejecutado por moneda (ASM-063), partes y concesiones, y los parámetros de F2 con
// la marca "por defecto" o "cambiado" (ASM-019). quien no puede escribir ve todo en solo lectura
const hoy = () => new Date().toISOString().slice(0, 10)

export function EquipoYParametrosPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { can } = useAuth()
  const asignado = useAsignadoAlProyecto(projectId)
  const escribe = (objeto: string, accion = 'CREATE') => asignado && can(objeto, accion)
  // los parámetros se editan con UPDATE y algún campo escribible: un rol con "u" sobre project los ve en solo lectura
  const puedeEditar = usePuedeEditar('project')
  const editaProyecto = asignado && puedeEditar
  return (
    <section className="space-y-4">
      <h1 className="text-sg-h2 font-semibold">{t('p360.equipo.titulo')}</h1>
      <Tabs
        label={t('p360.equipo.titulo')}
        tabs={[
          {
            id: 'equipo',
            label: t('p360.equipo.pestanas.equipo'),
            render: () => <Equipo proyecto={projectId} editable={escribe('project_assignment')} cambia={escribe('project_assignment', 'UPDATE')} />
          },
          {
            id: 'campanas',
            label: t('p360.equipo.pestanas.campanas'),
            render: () => <Campanas proyecto={projectId} editable={escribe('exploration_campaign')} />
          },
          {
            id: 'partes',
            label: t('p360.equipo.pestanas.partes'),
            render: () => <PartesYConcesiones proyecto={projectId} editable={escribe('project_party')} />
          },
          {
            id: 'parametros',
            label: t('p360.equipo.pestanas.parametros'),
            render: () => <Parametros proyecto={projectId} editable={editaProyecto} />
          }
        ]}
      />
    </section>
  )
}

function Equipo({ proyecto, editable, cambia }: { proyecto: string; editable: boolean; cambia: boolean }) {
  const { t } = useTranslation(NS)
  const asignaciones = useTodos('project_assignment', { project: proyecto })
  const actualizar = useActualizar('project_assignment')
  const mensaje = useMensajeDeError()
  const [abierto, setAbierto] = useState(false)
  const vencida = (a: Registro) => atributo(a, 'active') !== true || (Boolean(atributo(a, 'end_date')) && texto(a, 'end_date') < hoy())
  return (
    <div className="space-y-3 pt-3">
      {editable ? <Button onClick={() => setAbierto(true)}>{t('p360.asignacion.titulo')}</Button> : null}
      <Consulta consulta={asignaciones}>
        {(lista) => (
          <Table aria-label={t('p360.equipo.pestanas.equipo')}>
            <thead>
              <tr>
                {(['correo', 'rol', 'periodo', 'estado'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`p360.equipo.columnas.${c}`)}
                  </Th>
                ))}
                {cambia ? <Th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <Td>{texto(a, 'member_user_email')}</Td>
                  <Td className="font-sg-mono text-sg-caption">{texto(a, 'role_name')}</Td>
                  <Td className="text-sm">
                    {texto(a, 'start_date') || '…'} – {texto(a, 'end_date') || '…'}
                  </Td>
                  <Td className="text-sm">{vencida(a) ? <span className="text-sg-warning">{t('p360.asignacion.vencida')}</span> : t('p360.equipo.activa')}</Td>
                  {cambia ? (
                    <Td>
                      {!vencida(a) ? (
                        <Button variant="ghost" size="sm" onClick={() => actualizar.mutate({ registro: a, cambios: { active: false, end_date: hoy() } })}>
                          {t('p360.asignacion.terminar')}
                        </Button>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Consulta>
      {actualizar.isError ? <Alert tone="danger">{mensaje(actualizar.error)}</Alert> : null}
      <Drawer titulo={t('p360.asignacion.titulo')} abierto={abierto} alCerrar={() => setAbierto(false)}>
        <FormularioDeAsignacion proyecto={proyecto} alGuardar={() => setAbierto(false)} />
      </Drawer>
    </div>
  )
}

function Campanas({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const campanas = useTodos('exploration_campaign', { project: proyecto })
  return (
    <div className="space-y-3 pt-3">
      <ul className="grid gap-3 md:grid-cols-2">
        {(campanas.data ?? []).map((c) => {
          const tope = atributo<number>(c, 'social_support_cap')
          const ejecutado = atributo<number>(c, 'executed_social_amount') ?? 0
          const otras = atributo<number>(c, 'other_currency_items_count') ?? 0
          return (
            <li key={c.id} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
              <p className="font-medium">{texto(c, 'name')}</p>
              <p className="text-sg-caption text-sg-text-muted">
                {texto(c, 'campaign_status')} · {texto(c, 'activity_type')}
              </p>
              {tope ? (
                <div
                  role="progressbar"
                  aria-label={texto(c, 'name')}
                  aria-valuemin={0}
                  aria-valuemax={tope}
                  aria-valuenow={ejecutado}
                  aria-valuetext={t('p360.equipo.ejecutado', { ejecutado: numeroPe(ejecutado), tope: numeroPe(tope), moneda: texto(c, 'currency') })}
                  className="h-2 rounded-full bg-sg-surface-sunken"
                >
                  <div className="h-2 rounded-full bg-sg-primary" style={{ width: `${Math.min(100, (ejecutado / tope) * 100)}%` }} />
                </div>
              ) : null}
              <p className="text-sm">
                {tope
                  ? t('p360.equipo.ejecutado', { ejecutado: numeroPe(ejecutado), tope: numeroPe(tope), moneda: texto(c, 'currency') })
                  : t('p360.equipo.sinTope')}
              </p>
              {otras > 0 ? <p className="text-sg-caption text-sg-warning">{t('p360.equipo.otraMoneda', { n: otras })}</p> : null}
            </li>
          )
        })}
      </ul>
      {editable ? <CampanaDelProyecto proyecto={proyecto} /> : null}
    </div>
  )
}

function PartesYConcesiones({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const concesiones = useRelacionados('project', proyecto, 'project_concession')
  return (
    <div className="space-y-4 pt-3">
      <PartesDelProyecto proyecto={proyecto} editable={editable} />
      <section aria-label={t('p360.equipo.concesiones')} className="space-y-2">
        <h3 className="font-medium">{t('p360.equipo.concesiones')}</h3>
        <ul className="text-sm">
          {(concesiones.data?.content ?? []).map((c) => (
            <li key={c.id}>
              <span className="font-sg-mono text-sg-caption">{texto(c, 'code')}</span> {texto(c, 'name')}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Parametros({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const consulta = useProyecto(proyecto)
  return <Consulta consulta={consulta}>{(p) => <FormularioDeParametros key={p.updatedAt} proyecto={p} editable={editable} />}</Consulta>
}

function FormularioDeParametros({ proyecto, editable }: { proyecto: Registro; editable: boolean }) {
  const { t } = useTranslation(NS)
  const actualizar = useActualizar('project')
  const definicion = useDefinicion('project')
  const mensaje = useMensajeDeError()
  const [valores, setValores] = useState(() => Object.fromEntries(PARAMETROS_F2.map((p) => [p.campo, vigente(proyecto.attributes, p)])))
  const grupos = [...new Set(PARAMETROS_F2.map((p) => p.grupo))]
  return (
    <form
      className="space-y-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        actualizar.mutate({ registro: proyecto, cambios: valores })
      }}
    >
      {grupos.map((grupo) => (
        <fieldset key={grupo} className="space-y-2 rounded-sg-lg border border-sg-border p-4">
          <legend className="px-1 font-medium">{t(`p360.parametros.grupos.${grupo}`)}</legend>
          {PARAMETROS_F2.filter((p) => p.grupo === grupo).map((p) => {
            const valor = valores[p.campo]
            const marca = valor === p.porDefecto ? t('proyectos.asistente.porDefecto') : t('proyectos.asistente.cambiado')
            const id = `param-${p.campo}`
            const bloqueado = !editable || !puedeEscribir(definicion.data, p.campo)
            return (
              <div key={p.campo} className="flex items-center justify-between gap-4">
                <label htmlFor={id} className="text-sm">
                  {t(`p360.parametros.${p.campo}`)} <span className="text-sg-caption text-sg-text-muted">({marca})</span>
                </label>
                {p.tipo === 'politica' ? (
                  <input
                    id={id}
                    type="checkbox"
                    disabled={bloqueado}
                    checked={Boolean(valor)}
                    onChange={(e) => setValores({ ...valores, [p.campo]: e.target.checked })}
                  />
                ) : (
                  <Input
                    id={id}
                    type="number"
                    className="w-24"
                    disabled={bloqueado}
                    value={String(valor)}
                    onChange={(e) => setValores({ ...valores, [p.campo]: Number(e.target.value) })}
                  />
                )}
              </div>
            )
          })}
        </fieldset>
      ))}
      {actualizar.isError ? <Alert tone="danger">{mensaje(actualizar.error)}</Alert> : null}
      {actualizar.isSuccess ? (
        <p role="status" className="text-sm text-sg-success">
          {t('p360.equipo.guardados')}
        </p>
      ) : null}
      {editable ? (
        <Button type="submit" disabled={actualizar.isPending}>
          {actualizar.isPending ? t('comun.guardando') : t('p360.equipo.guardarParametros')}
        </Button>
      ) : null}
    </form>
  )
}
