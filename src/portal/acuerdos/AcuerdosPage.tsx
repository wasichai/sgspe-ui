import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { nombreDeProyecto, useProyectos } from '../contexto/proyectos'
import { atributo, texto, useTodosConTope } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { useContextFilters } from '../shell/context'

// S33, la lista: los acuerdos del alcance (global con la columna Proyecto, o de un proyecto) con su tipo, su estado de WF-I y su
// vigencia (validity_status, de JOB-01: vencer no concluye el acuerdo). el alta va en un drawer con los campos de la ficha y
// el motivo, porque agreement es requiresReason (un alta sin motivo es 400)
export const CAMPOS_DEL_ACUERDO = [
  'code',
  'title',
  'agreement_type',
  'summary',
  'signed_date',
  'effective_date',
  'expiry_date',
  'amount',
  'currency',
  'community',
  'assembly_engagement'
] as const

export function AcuerdosPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const acuerdos = useTodosConTope('agreement', { project: proyecto, sort: 'code', dir: 'asc' })
  const proyectos = useProyectos()
  const lista = acuerdos.data ?? []
  const [creando, setCreando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const fijos = proyecto ? { project: proyecto } : undefined
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('acuerdos.titulo')}</h1>
        {proyecto && escribe && can('agreement', 'CREATE') ? <Button onClick={() => setCreando(true)}>{t('acuerdos.nuevo')}</Button> : null}
      </div>
      {!proyecto && can('agreement', 'CREATE') ? <p className="text-sm text-sg-text-muted">{t('acuerdos.eligeProyecto')}</p> : null}
      {acuerdos.truncado ? <Alert tone="warning">{t('acuerdos.truncado')}</Alert> : null}
      {acuerdos.isPending ? (
        <Cargando />
      ) : acuerdos.isError && !acuerdos.data ? (
        <FalloDeLectura error={acuerdos.error} alReintentar={() => void acuerdos.refetch()} />
      ) : lista.length === 0 ? (
        <Vacio titulo={t('acuerdos.vacio')} />
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('acuerdos.tabla')}>
            <thead>
              <tr>
                <Th scope="col">{t('acuerdos.columnas.codigo')}</Th>
                <Th scope="col">{t('acuerdos.columnas.titulo')}</Th>
                {proyecto ? null : <Th scope="col">{t('acuerdos.columnas.proyecto')}</Th>}
                <Th scope="col">{t('acuerdos.columnas.tipo')}</Th>
                <Th scope="col">{t('acuerdos.columnas.estado')}</Th>
                <Th scope="col">{t('acuerdos.columnas.vigencia')}</Th>
                <Th scope="col">{t('acuerdos.columnas.vence')}</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const p = proyectos.data?.find((x) => x.id === texto(a, 'project'))
                return (
                  <tr key={a.id}>
                    <Td className="font-sg-mono text-sm">{texto(a, 'code')}</Td>
                    <Td className="text-sm">
                      <Link to={`/projects/${encodeURIComponent(texto(a, 'project'))}/agreements/${a.id}`} className="text-sg-primary-text underline">
                        {texto(a, 'title')}
                      </Link>
                    </Td>
                    {proyecto ? null : <Td className="text-sm">{p ? nombreDeProyecto(p) : '…'}</Td>}
                    <Td className="text-sm">{texto(a, 'agreement_type')}</Td>
                    <Td>
                      <EstadoChip objeto="agreement" estado={a.state} />
                    </Td>
                    <Td>
                      <SituacionDePlazo valor={atributo(a, 'validity_status')} vigencia />
                    </Td>
                    <Td className="text-sm">{texto(a, 'expiry_date') ? diaPe(texto(a, 'expiry_date')) : '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
      {proyecto && fijos ? (
        <Drawer titulo={t('acuerdos.nuevoTitulo')} abierto={creando} alCerrar={() => setCreando(false)}>
          <Campo etiqueta={t('acuerdos.motivo')} ayuda={t('acuerdos.motivoAyuda')}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          <FormularioDeRegistro
            objeto="agreement"
            fijos={fijos}
            campos={CAMPOS_DEL_ACUERDO}
            motivo={motivo.trim() || undefined}
            alGuardar={(a) => {
              setCreando(false)
              setMotivo('')
              navegar(`/projects/${encodeURIComponent(proyecto)}/agreements/${a.id}`)
            }}
            alCancelar={() => setCreando(false)}
          />
        </Drawer>
      ) : null}
    </section>
  )
}
