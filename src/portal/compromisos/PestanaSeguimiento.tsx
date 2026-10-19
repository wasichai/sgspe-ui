import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useMensajeDeError } from '../componentes/errores'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { hoyEnLima } from '../datos/fechas'
import { atributo, texto, useActualizar, useCrear, useRegistro, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { Dia } from '../componentes/Dia'
import { Persona } from '../componentes/Persona'

// las pestañas «Acciones e hitos» y «Dependencias» de S29 (screens.md §7; RF-COM-004, RF-COM-006): las acciones internas y
// los plazos parciales no cambian el estado del compromiso; una dependencia bloqueante abierta impide registrar el
// cumplimiento (D10) y se avisa aquí. escribe es la guarda de UI del proyecto del compromiso (useEscribeEnProyecto); cada
// alta pide además el permiso de su objeto. los ciclos los rechaza CommitmentWriteGuard (DEPENDENCY_CYCLE)
const CERRADOS = ['closed', 'cancelled']

export function PestanaSeguimiento({ compromiso, escribe }: { compromiso: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const acciones = useTodos('commitment_action', { commitment: compromiso.id, sort: 'action_date', dir: 'asc' })
  const hitos = useTodos('commitment_milestone', { commitment: compromiso.id, sort: 'due_date', dir: 'asc' })
  const actualizarAccion = useActualizar('commitment_action')
  const actualizarHito = useActualizar('commitment_milestone')
  const releer = useReleer()
  const [nueva, setNueva] = useState<'accion' | 'hito' | null>(null)
  const fijos = { commitment: compromiso.id }
  const cambiaAcciones = escribe && can('commitment_action', 'UPDATE')
  const cambiaHitos = escribe && can('commitment_milestone', 'UPDATE')
  return (
    <div className="space-y-6 pt-3">
      <section aria-label={t('seguimiento.acciones.titulo')} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sg-h3 font-semibold">{t('seguimiento.acciones.titulo')}</h2>
          {escribe && can('commitment_action', 'CREATE') ? (
            <Button size="sm" onClick={() => setNueva('accion')}>
              {t('seguimiento.acciones.nueva')}
            </Button>
          ) : null}
        </div>
        {actualizarAccion.isError ? (
          <AvisoDeConflicto
            error={actualizarAccion.error}
            releer={() => releer(['records', 'commitment_action'])}
            alRecargar={() => actualizarAccion.reset()}
          />
        ) : null}
        {acciones.isPending ? (
          <Cargando compacto />
        ) : acciones.isError && !acciones.data ? (
          <FalloDeLectura error={acciones.error} alReintentar={() => void acciones.refetch()} />
        ) : acciones.data.length === 0 ? (
          <Vacio titulo={t('seguimiento.acciones.vacia')} />
        ) : (
          <Table aria-label={t('seguimiento.acciones.titulo')}>
            <thead>
              <tr>
                {(['descripcion', 'fecha', 'responsable', 'hecha'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`seguimiento.acciones.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acciones.data.map((a) => {
                const hecha = atributo(a, 'completed') === true
                return (
                  <tr key={a.id}>
                    <Td className="text-sm">{texto(a, 'description')}</Td>
                    <Td className="text-sm">
                      <Dia valor={texto(a, 'action_date')} />
                    </Td>
                    <Td className="text-sm">
                      <Persona correo={texto(a, 'owner_user_email')} />
                    </Td>
                    <Td className="text-sm">
                      <input
                        type="checkbox"
                        checked={hecha}
                        disabled={!cambiaAcciones || actualizarAccion.isPending}
                        aria-label={t(hecha ? 'seguimiento.acciones.desmarcar' : 'seguimiento.acciones.marcar', { accion: texto(a, 'description') })}
                        onChange={() => actualizarAccion.mutate({ registro: a, cambios: { completed: !hecha } })}
                      />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </section>
      <section aria-label={t('seguimiento.hitos.titulo')} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sg-h3 font-semibold">{t('seguimiento.hitos.titulo')}</h2>
          {escribe && can('commitment_milestone', 'CREATE') ? (
            <Button size="sm" onClick={() => setNueva('hito')}>
              {t('seguimiento.hitos.nuevo')}
            </Button>
          ) : null}
        </div>
        {actualizarHito.isError ? (
          <AvisoDeConflicto error={actualizarHito.error} releer={() => releer(['records', 'commitment_milestone'])} alRecargar={() => actualizarHito.reset()} />
        ) : null}
        {hitos.isPending ? (
          <Cargando compacto />
        ) : hitos.isError && !hitos.data ? (
          <FalloDeLectura error={hitos.error} alReintentar={() => void hitos.refetch()} />
        ) : hitos.data.length === 0 ? (
          <Vacio titulo={t('seguimiento.hitos.vacio')} />
        ) : (
          <Table aria-label={t('seguimiento.hitos.titulo')}>
            <thead>
              <tr>
                {(['descripcion', 'vence', 'alcanzado'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`seguimiento.hitos.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hitos.data.map((h) => (
                <tr key={h.id}>
                  <Td className="text-sm">{texto(h, 'description')}</Td>
                  <Td className="text-sm">
                    <Dia valor={texto(h, 'due_date')} />
                  </Td>
                  <Td className="text-sm">
                    {texto(h, 'reached_date') ? (
                      diaPe(texto(h, 'reached_date'))
                    ) : cambiaHitos ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={t('seguimiento.hitos.alcanzarDe', { hito: texto(h, 'description') })}
                        disabled={actualizarHito.isPending}
                        onClick={() => actualizarHito.mutate({ registro: h, cambios: { reached_date: hoyEnLima() } })}
                      >
                        {t('seguimiento.hitos.alcanzar')}
                      </Button>
                    ) : (
                      t('seguimiento.hitos.pendiente')
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
      <Drawer titulo={t('seguimiento.acciones.nuevaTitulo')} abierto={nueva === 'accion'} alCerrar={() => setNueva(null)}>
        <FormularioDeRegistro
          objeto="commitment_action"
          fijos={fijos}
          campos={['description', 'action_date', 'owner_user_email', 'owner_user_id', 'completed']}
          alGuardar={() => setNueva(null)}
          alCancelar={() => setNueva(null)}
        />
      </Drawer>
      <Drawer titulo={t('seguimiento.hitos.nuevoTitulo')} abierto={nueva === 'hito'} alCerrar={() => setNueva(null)}>
        <FormularioDeRegistro
          objeto="commitment_milestone"
          fijos={fijos}
          campos={['description', 'due_date', 'reached_date']}
          alGuardar={() => setNueva(null)}
          alCancelar={() => setNueva(null)}
        />
      </Drawer>
    </div>
  )
}

export function PestanaDependencias({ compromiso, escribe }: { compromiso: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const dependencias = useTodos('commitment_dependency', { commitment: compromiso.id })
  const proyecto = texto(compromiso, 'project')
  return (
    <section aria-label={t('seguimiento.dependencias')} className="space-y-3 pt-3">
      <h2 className="text-sg-h3 font-semibold">{t('seguimiento.dependencias')}</h2>
      {dependencias.isPending ? (
        <Cargando compacto />
      ) : dependencias.isError && !dependencias.data ? (
        <FalloDeLectura error={dependencias.error} alReintentar={() => void dependencias.refetch()} />
      ) : dependencias.data.length === 0 ? (
        <Vacio titulo={t('seguimiento.deps.vacia')} />
      ) : (
        <Table aria-label={t('seguimiento.dependencias')}>
          <thead>
            <tr>
              {(['compromiso', 'estado', 'bloquea', 'notas'] as const).map((c) => (
                <Th key={c} scope="col">
                  {t(`seguimiento.deps.columnas.${c}`)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dependencias.data.map((d) => (
              <FilaDeDependencia key={d.id} dependencia={d} proyecto={proyecto} />
            ))}
          </tbody>
        </Table>
      )}
      {/* key: otro compromiso en la misma pantalla empieza el alta de cero, con su propia clave (P63) */}
      {escribe && can('commitment_dependency', 'CREATE') ? <NuevaDependencia key={compromiso.id} compromiso={compromiso} /> : null}
    </section>
  )
}

function FilaDeDependencia({ dependencia, proyecto }: { dependencia: Registro; proyecto: string }) {
  const { t } = useTranslation(NS)
  const otro = useRegistro('commitment', atributo<string>(dependencia, 'depends_on'))
  const bloquea = atributo(dependencia, 'blocking') === true
  const abierta =
    bloquea && otro.data !== undefined && !CERRADOS.includes(otro.data.state ?? '') && otro.data.state !== 'fulfilled' && otro.data.state !== 'verified'
  return (
    <tr>
      <Td className="text-sm">
        {otro.isPending ? (
          <Cargando compacto />
        ) : otro.data ? (
          <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(otro.data.id)}`} className="text-sg-primary-text underline">
            {texto(otro.data, 'code')} · {texto(otro.data, 'title')}
          </Link>
        ) : (
          <FalloDeLectura error={otro.error} alReintentar={() => void otro.refetch()} />
        )}
        {abierta ? (
          <p role="note" className="text-sg-caption text-sg-warning">
            {t('seguimiento.deps.abierta')}
          </p>
        ) : null}
      </Td>
      <Td>{otro.data ? <EstadoChip objeto="commitment" estado={otro.data.state} /> : null}</Td>
      <Td className="text-sm">{bloquea ? t('seguimiento.deps.bloquea') : t('seguimiento.deps.noBloquea')}</Td>
      <Td className="text-sm">{texto(dependencia, 'notes') || '—'}</Td>
    </tr>
  )
}

function NuevaDependencia({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const crear = useCrear('commitment_dependency')
  const mensaje = useMensajeDeError()
  const [elegido, setElegido] = useState<Registro | null>(null)
  const [bloquea, setBloquea] = useState(true)
  const [notas, setNotas] = useState('')
  const [intentado, setIntentado] = useState(false)
  const agregar = () => {
    setIntentado(true)
    if (!elegido) return
    crear.mutate(
      { atributos: { commitment: compromiso.id, depends_on: elegido.id, blocking: bloquea, notes: notas.trim() || undefined } },
      {
        onSuccess: () => {
          setElegido(null)
          setNotas('')
          setIntentado(false)
        }
      }
    )
  }
  return (
    <details className="rounded-sg-md border border-sg-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-sg-primary-text">{t('seguimiento.deps.nueva')}</summary>
      <div className="mt-2 space-y-2">
        {elegido ? (
          <p className="text-sm">
            {texto(elegido, 'code')} · {texto(elegido, 'title')}{' '}
            <button
              type="button"
              className="text-sg-caption text-sg-primary-text underline"
              onClick={() => {
                setElegido(null)
                crear.nuevaAccion()
              }}
            >
              {t('comun.quitar')}
            </button>
          </p>
        ) : (
          <BuscadorDeRegistro
            objeto="commitment"
            etiqueta={t('seguimiento.deps.buscar')}
            filtros={{ project: texto(compromiso, 'project') }}
            rotulo={(r) => `${texto(r, 'code')} · ${texto(r, 'title')}`}
            alElegir={(r) => {
              // P63: otra dependencia no es un reintento de la anterior; lleva otra clave y no arrastra su error
              setElegido(r)
              crear.nuevaAccion()
            }}
          />
        )}
        {intentado && !elegido ? <p className="text-sg-caption text-sg-danger">{t('seguimiento.deps.elegir')}</p> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bloquea} onChange={(e) => setBloquea(e.target.checked)} />
          {t('seguimiento.deps.bloqueante')}
        </label>
        <Campo etiqueta={t('seguimiento.deps.notas')}>
          {(p) => <Textarea {...p} value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} />}
        </Campo>
        {crear.isError ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
        {crear.isSuccess ? (
          <p role="status" className="text-sm text-sg-success">
            {t('seguimiento.deps.agregada')}
          </p>
        ) : null}
        <Button size="sm" onClick={agregar} disabled={crear.isPending} aria-busy={crear.isPending}>
          {t('seguimiento.deps.agregar')}
        </Button>
      </div>
    </details>
  )
}
