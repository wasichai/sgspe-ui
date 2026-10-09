import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { atributo, texto, useCrear, useDefinicion, useRegistro, useTodos } from '../datos/registros'
import { NS } from '../i18n'
import { FormularioDeAsignacion } from './FormularioDeAsignacion'

// un error de campo se ve junto a su control; el aviso al pie queda para lo que no cae en un campo que se dibuja
const avisoAlPie = (hayError: boolean, porCampo: Record<string, string>, visibles: readonly string[]) => {
  const campos = Object.keys(porCampo)
  return hayError && (campos.length === 0 || campos.some((c) => !visibles.includes(c)))
}

// las partes, la campaña y el equipo de un proyecto: los pasos 3 a 5 de S07 y las pestañas de S11 (screens.md §3). cada
// alta es un registro propio por la API genérica, con el proyecto como relación. editable: false los muestra en solo lectura

export function PartesDelProyecto({ proyecto, editable = true }: { proyecto: string; editable?: boolean }) {
  const { t } = useTranslation(NS)
  const partes = useTodos('project_party', { project: proyecto })
  const definicion = useDefinicion('project_party')
  const crear = useCrear('project_party')
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const { can } = useAuth()
  const [rol, setRol] = useState('')
  const [faltaRol, setFaltaRol] = useState(false)
  const puedeAgregar = editable && can('project_party', 'CREATE')
  const roles = definicion.data?.fields.find((f) => f.name === 'party_role')?.enumOptions ?? []
  const porCampo = erroresDeCampo(crear.error)
  return (
    <section className="space-y-3" aria-label={t('proyectos.asistente.partes')}>
      <ul className="space-y-1 text-sm">
        {(partes.data ?? []).map((p) => {
          const organizacion = atributo(p, 'organization')
          return (
            <li key={p.id}>
              {texto(p, 'party_role')} · {organizacion ? <OrganizacionNombre id={String(organizacion)} /> : '—'}
            </li>
          )
        })}
      </ul>
      {puedeAgregar ? (
        <>
          <Campo etiqueta={t('proyectos.asistente.rol')} error={porCampo.party_role}>
            {(p) => (
              <SelectNativo
                {...p}
                opciones={roles}
                value={rol}
                onChange={(e) => {
                  setRol(e.target.value)
                  setFaltaRol(false)
                }}
              />
            )}
          </Campo>
          <BuscadorDeRegistro
            objeto="organization"
            etiqueta={t('proyectos.asistente.parte')}
            rotulo={(o) => texto(o, 'name')}
            alElegir={(o) => {
              if (!rol) {
                setFaltaRol(true)
                return
              }
              crear.mutate({ atributos: { project: proyecto, organization: o.id, party_role: rol } })
            }}
          />
          {faltaRol ? <Alert tone="warning">{t('p360.asistente.eligeElRol')}</Alert> : null}
        </>
      ) : null}
      {avisoAlPie(crear.isError, porCampo, ['party_role']) ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
    </section>
  )
}

// el nombre de la organización; mientras se lee, «…», y si no se puede leer, «No disponible». nunca su id
export function OrganizacionNombre({ id }: { id: string }) {
  const { t } = useTranslation(NS)
  const organizacion = useRegistro('organization', id)
  return <>{texto(organizacion.data, 'name') || (organizacion.isPending ? '…' : t('comun.noDisponible'))}</>
}

const CAMPOS_DE_CAMPANA = ['name', 'activity_type', 'social_support_cap', 'currency']

export function CampanaDelProyecto({ proyecto, editable = true }: { proyecto: string; editable?: boolean }) {
  const { t } = useTranslation(NS)
  const campanas = useTodos('exploration_campaign', { project: proyecto })
  const definicion = useDefinicion('exploration_campaign')
  const crear = useCrear('exploration_campaign')
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const { can } = useAuth()
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', activity_type: '', social_support_cap: '', currency: 'PEN', planned_start_date: '', planned_end_date: '' }
  })
  const opciones = (c: string) => definicion.data?.fields.find((f) => f.name === c)?.enumOptions ?? []
  const porCampo = erroresDeCampo(crear.error)
  const guardar = handleSubmit((v) =>
    crear.mutate(
      { atributos: { ...v, project: proyecto, social_support_cap: v.social_support_cap === '' ? null : Number(v.social_support_cap) } },
      { onSuccess: () => reset() }
    )
  )
  return (
    <section className="space-y-3" aria-label={t('proyectos.asistente.campana')}>
      <ul className="space-y-1 text-sm">
        {(campanas.data ?? []).map((c) => (
          <li key={c.id}>
            {texto(c, 'name')} · {texto(c, 'social_support_cap')} {texto(c, 'currency')}
          </li>
        ))}
      </ul>
      {editable && can('exploration_campaign', 'CREATE') ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta={t('proyectos.asistente.nombreCampana')} error={porCampo.name}>
              {(p) => <Input {...p} {...register('name')} />}
            </Campo>
            <Campo etiqueta={definicion.data?.fields.find((f) => f.name === 'activity_type')?.label ?? 'activity_type'} error={porCampo.activity_type}>
              {(p) => <SelectNativo {...p} opciones={opciones('activity_type')} {...register('activity_type')} />}
            </Campo>
            <Campo etiqueta={t('proyectos.asistente.tope')} error={porCampo.social_support_cap}>
              {(p) => <Input {...p} type="number" min="0" {...register('social_support_cap')} />}
            </Campo>
            <Campo etiqueta={t('proyectos.asistente.moneda')} error={porCampo.currency}>
              {(p) => <SelectNativo {...p} vacio={false} opciones={opciones('currency').length ? opciones('currency') : ['PEN']} {...register('currency')} />}
            </Campo>
          </div>
          <Button type="button" variant="secondary" onClick={() => void guardar()}>
            {t('comun.agregar')}
          </Button>
        </>
      ) : null}
      {avisoAlPie(crear.isError, porCampo, CAMPOS_DE_CAMPANA) ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
    </section>
  )
}

export function EquipoDelProyecto({ proyecto, editable = true }: { proyecto: string; editable?: boolean }) {
  const { t } = useTranslation(NS)
  const asignaciones = useTodos('project_assignment', { project: proyecto })
  const { can } = useAuth()
  return (
    <section className="space-y-3" aria-label={t('proyectos.asistente.equipo')}>
      <Table aria-label={t('proyectos.asistente.equipo')}>
        <thead>
          <tr>
            <Th scope="col">{t('p360.asignacion.correo')}</Th>
            <Th scope="col">{t('p360.asignacion.rol')}</Th>
          </tr>
        </thead>
        <tbody>
          {(asignaciones.data ?? []).map((a) => (
            <tr key={a.id}>
              <Td>{texto(a, 'member_user_email')}</Td>
              <Td className="font-sg-mono text-sg-caption">{texto(a, 'role_name')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editable && can('project_assignment', 'CREATE') ? <FormularioDeAsignacion proyecto={proyecto} /> : null}
    </section>
  )
}
