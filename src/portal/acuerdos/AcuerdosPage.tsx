import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { atributo, texto, useTodosConTope } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

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
  const telefono = useEsTelefono()
  const lista = acuerdos.data ?? []
  // ?nuevo=1 abre el alta: así llega BotonCrear desde lo global, ya con el proyecto elegido
  const [busqueda] = useSearchParams()
  const [creando, setCreando] = useState(busqueda.get('nuevo') === '1')
  const [motivo, setMotivo] = useState('')
  const fijos = proyecto ? { project: proyecto } : undefined
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('acuerdos.titulo')}
        conteo={acuerdos.data ? t('acuerdos.conteo', { count: lista.length }) : undefined}
        primaria={
          proyecto ? (
            escribe && can('agreement', 'CREATE') ? (
              <Button size="sm" onClick={() => setCreando(true)}>
                {t('acuerdos.nuevo')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="agreement" etiqueta={t('acuerdos.nuevo')} resto="agreements?nuevo=1" />
          )
        }
      />
      {acuerdos.truncado ? <Alert tone="warning">{t('acuerdos.truncado', { n: numeroPe(acuerdos.data?.length ?? 0) })}</Alert> : null}
      {acuerdos.isPending ? (
        <Cargando />
      ) : acuerdos.isError && !acuerdos.data ? (
        <FalloDeLectura error={acuerdos.error} alReintentar={() => void acuerdos.refetch()} />
      ) : lista.length === 0 ? (
        <Vacio titulo={t('acuerdos.vacio')}>{t('acuerdos.vacioAyuda')}</Vacio>
      ) : telefono ? (
        // en el teléfono, tarjetas con el título, el estado, la vigencia y el proyecto (revisión de UX, etapa 8)
        <ListaEnTarjetas
          etiqueta={t('acuerdos.tabla')}
          tarjetas={lista.map((a) => ({
            id: a.id,
            titulo: (
              <EnlaceDeRegistro
                codigo={texto(a, 'code')}
                titulo={texto(a, 'title')}
                ruta={`/projects/${encodeURIComponent(texto(a, 'project'))}/agreements/${encodeURIComponent(a.id)}`}
                desde={t('acuerdos.titulo')}
              />
            ),
            estado: <EstadoChip objeto="agreement" estado={a.state} />,
            plazo: (
              <>
                <SituacionDePlazo valor={atributo(a, 'validity_status')} vigencia />
                <Dia valor={texto(a, 'expiry_date')} />
              </>
            ),
            proyecto: proyecto ? undefined : <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === texto(a, 'project'))} />,
            detalle: opcion(a, 'agreement_type') || undefined
          }))}
        />
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('acuerdos.tabla')}>
            <thead>
              <tr>
                <Th scope="col">{t('acuerdos.columnas.acuerdo')}</Th>
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
                    <Td className="min-w-64 text-sm">
                      <EnlaceDeRegistro
                        codigo={texto(a, 'code')}
                        titulo={texto(a, 'title')}
                        ruta={`/projects/${encodeURIComponent(texto(a, 'project'))}/agreements/${encodeURIComponent(a.id)}`}
                        desde={t('acuerdos.titulo')}
                      />
                    </Td>
                    {proyecto ? null : (
                      <Td className="text-sm">
                        <ProyectoEnLista proyecto={p} />
                      </Td>
                    )}
                    <Td className="text-sm">{opcion(a, 'agreement_type')}</Td>
                    <Td>
                      <EstadoChip objeto="agreement" estado={a.state} />
                    </Td>
                    <Td>
                      <SituacionDePlazo valor={atributo(a, 'validity_status')} vigencia />
                    </Td>
                    <Td className="text-sm">
                      <Dia valor={texto(a, 'expiry_date')} />
                    </Td>
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
              navegar(`/projects/${encodeURIComponent(proyecto)}/agreements/${encodeURIComponent(a.id)}`)
            }}
            alCancelar={() => setCreando(false)}
          />
        </Drawer>
      ) : null}
    </section>
  )
}
