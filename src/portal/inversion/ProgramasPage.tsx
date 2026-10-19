import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { Campo, CONTROL, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando, NoDisponible, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { montoPe } from '../componentes/Monto'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { rutaDeFicha } from '../datos/fichas'
import { desglose, useTablero, type Indicador } from '../datos/indicadores'
import { anioEnLima, APORTE_TERMINADO, MONEDA_POR_DEFECTO } from '../datos/inversion'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ConsultaDeTablero, indicadorDe, useTableroDisponible } from '../tableros/comunes'
import { BeneficiariosPorFuente, CampanasFrenteAlTope, cifraDe, presupuestoDelPrograma, PresupuestoPorMoneda } from './cifras'
import { opcion } from '../datos/opciones'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'

// S42 · programas e inversión (screens.md §10): ¿cuánto del tope de la campaña queda, cómo avanzan los programas y qué aportes están
// en curso? la misma página con alcance global (columna Proyecto, sin altas) o de un proyecto (ASM-076). las cifras salen del
// tablero investment en una llamada (KPI-INV-01, 02 y 04); las listas, de la API genérica con tope (useTodosConTope avisa del
// recorte), porque no filtra por estado. el alta de un aporte lleva motivo (requiresReason) y no lleva ítems: se cargan en S44
const CAMPOS_DEL_APORTE = [
  'code',
  'contribution_type',
  'topic',
  'occasion',
  'declared_purpose',
  'conditions',
  'currency',
  'payer_organization',
  'recipient_organization',
  'stakeholder',
  'locality',
  'festivity',
  'exploration_campaign',
  'beneficiaries_count',
  'has_institutional_synergy',
  'agreement',
  'commitment'
]
const CAMPOS_DEL_PROGRAMA = ['code', 'name', 'description', 'topic', 'partner_organization', 'agreement', 'start_date', 'end_date', 'currency']
const VISTAS = ['enCurso', 'terminados', 'todos'] as const

export function ProgramasPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const conTablero = useTableroDisponible('investment')
  const tablero = useTablero('investment', proyecto ? { project: [proyecto] } : {})
  // ?nuevo=social_contribution o social_program abre el alta: así llega BotonCrear desde lo global, ya con el proyecto elegido
  const [busqueda] = useSearchParams()
  const pedida = busqueda.get('nuevo')
  const [alta, setAlta] = useState<'social_contribution' | 'social_program' | null>(
    pedida === 'social_contribution' || pedida === 'social_program' ? pedida : null
  )
  const creaAporte = proyecto !== undefined && escribe && can('social_contribution', 'CREATE')
  const creaPrograma = proyecto !== undefined && escribe && can('social_program', 'CREATE')
  const indicadores = tablero.data?.indicators
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        vistas={<VistasDelModulo modulo="programs" actual="lista" conTablero={conTablero} />}
        titulo={t('inversion.titulo')}
        primaria={
          proyecto ? (
            creaAporte ? (
              <Button size="sm" onClick={() => setAlta('social_contribution')}>
                {t('inversion.nuevoAporte')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="social_contribution" etiqueta={t('inversion.nuevoAporte')} resto="programs?nuevo=social_contribution" />
          )
        }
        secundarias={
          <>
            {proyecto ? (
              creaPrograma ? (
                <Button size="sm" variant="secondary" onClick={() => setAlta('social_program')}>
                  {t('inversion.nuevoPrograma')}
                </Button>
              ) : null
            ) : (
              <BotonCrear objeto="social_program" etiqueta={t('inversion.nuevoPrograma')} resto="programs?nuevo=social_program" />
            )}
          </>
        }
      />
      {conTablero ? <ConsultaDeTablero consulta={tablero}>{(datos) => <Cifras indicadores={datos.indicators} />}</ConsultaDeTablero> : null}
      {can('social_program', 'READ') ? <Programas proyecto={proyecto} indicadores={indicadores} /> : null}
      {can('social_contribution', 'READ') ? <Aportes proyecto={proyecto} /> : null}
      {alta && proyecto ? <Alta objeto={alta} proyecto={proyecto} alCerrar={() => setAlta(null)} /> : null}
    </section>
  )
}

// las tres cifras de S42: una zona por KPI, «No disponible» si la cuenta no lo lee (RQ-DSH-032), nunca cero
function Cifras({ indicadores }: { indicadores: Indicador[] }) {
  const { t } = useTranslation(NS)
  const anio = anioEnLima()
  const zona = (titulo: string, code: string, contenido: (i: Indicador) => React.ReactNode) => {
    const indicador = indicadorDe(indicadores, code)
    return (
      <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
        {indicador?.available ? contenido(indicador) : <NoDisponible motivo={indicador?.unavailableReason} />}
      </section>
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {zona(t('inversion.cifras.campanas'), 'KPI-INV-01', (i) => (
        <CampanasFrenteAlTope indicador={i} />
      ))}
      {zona(t('inversion.cifras.presupuesto', { anio }), 'KPI-INV-02', (i) => (
        <PresupuestoPorMoneda indicador={i} anio={anio} />
      ))}
      {zona(t('inversion.cifras.beneficiarios'), 'KPI-INV-04', (i) => (
        <BeneficiariosPorFuente indicador={i} />
      ))}
    </div>
  )
}

function useNombreDelProyecto(): (id: string) => React.ReactNode {
  const proyectos = useProyectos()
  return (id) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === id)} />
}

function Programas({ proyecto, indicadores }: { proyecto?: string; indicadores?: Indicador[] }) {
  const { t } = useTranslation(NS)
  const programas = useTodosConTope('social_program', { project: proyecto, sort: 'code', dir: 'asc' })
  const nombreDelProyecto = useNombreDelProyecto()
  const anio = anioEnLima()
  const presupuesto = indicadorDe(indicadores, 'KPI-INV-02')
  const textosDeMonto = { ilegible: t('inversion.cifras.ilegible'), porAprobar: t('inversion.cifras.porAprobar') }
  const beneficiarios = indicadorDe(indicadores, 'KPI-INV-04')
  const alcanzados = (programa: string) => {
    const fila = beneficiarios?.available ? desglose(beneficiarios, 'program').find((f) => f.key === programa) : undefined
    const meta = cifraDe(fila?.target)
    const alcanzado = cifraDe(fila?.reached)
    return fila && meta !== null && alcanzado !== null ? t('inversion.programas.alcanzados', { alcanzados: numeroPe(alcanzado), meta: numeroPe(meta) }) : '—'
  }
  return (
    <section aria-label={t('inversion.programas.titulo')} className="space-y-2">
      <h2 className="text-sg-h2 font-semibold">{t('inversion.programas.titulo')}</h2>
      {programas.truncado ? <Alert tone="warning">{t('inversion.programas.truncado', { n: numeroPe(programas.data?.length ?? 0) })}</Alert> : null}
      {programas.isPending ? (
        <Cargando />
      ) : programas.isError && !programas.data ? (
        <FalloDeLectura error={programas.error} alReintentar={() => void programas.refetch()} />
      ) : (programas.data ?? []).length === 0 ? (
        <Vacio titulo={t('inversion.programas.vacio')}>{t('inversion.programas.vacioAyuda')}</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('inversion.programas.tabla')}>
            <thead>
              <tr>
                <Th scope="col">{t('inversion.programas.columnas.programa')}</Th>
                {proyecto ? null : <Th scope="col">{t('inversion.programas.columnas.proyecto')}</Th>}
                <Th scope="col">{t('inversion.programas.columnas.socio')}</Th>
                <Th scope="col">{t('inversion.programas.columnas.estado')}</Th>
                <Th scope="col">{t('inversion.programas.columnas.presupuesto', { anio })}</Th>
                <Th scope="col">{t('inversion.programas.columnas.ejecutado', { anio })}</Th>
                <Th scope="col">{t('inversion.programas.columnas.beneficiarios')}</Th>
              </tr>
            </thead>
            <tbody>
              {(programas.data ?? []).map((p) => (
                <tr key={p.id}>
                  <Td className="text-sm">
                    <EnlaceDeRegistro
                      codigo={texto(p, 'code')}
                      titulo={texto(p, 'name')}
                      ruta={rutaDeFicha('social_program', p)}
                      desde={t('inversion.titulo')}
                    />
                  </Td>
                  {proyecto ? null : <Td className="text-sm">{nombreDelProyecto(texto(p, 'project'))}</Td>}
                  <Td className="text-sm">
                    {texto(p, 'partner_organization') ? (
                      <RegistroVinculado objeto="organization" id={texto(p, 'partner_organization')} />
                    ) : (
                      t('inversion.programas.sinSocio')
                    )}
                  </Td>
                  <Td>
                    <EstadoChip objeto="social_program" estado={p.state} />
                  </Td>
                  <Td className="text-sm tabular-nums">{presupuestoDelPrograma(presupuesto, p.id, anio, 'allocated', textosDeMonto)}</Td>
                  <Td className="text-sm tabular-nums">{presupuestoDelPrograma(presupuesto, p.id, anio, 'executed', textosDeMonto)}</Td>
                  <Td className="text-sm tabular-nums">{alcanzados(p.id)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  )
}

const enVista = (vista: string, aporte: Registro): boolean => {
  const terminado = APORTE_TERMINADO.includes(aporte.state ?? '')
  return vista === 'todos' ? true : vista === 'terminados' ? terminado : !terminado
}

function Aportes({ proyecto }: { proyecto?: string }) {
  const { t } = useTranslation(NS)
  const lista = useParametrosDeLista('enCurso')
  const aportes = useTodosConTope('social_contribution', { project: proyecto, sort: 'code', dir: 'desc' })
  const etiquetas = useEtiquetasDeEstado('social_contribution')
  const nombreDelProyecto = useNombreDelProyecto()
  const estado = lista.filtro('state')
  const filtrados = (aportes.data ?? []).filter((a) => enVista(lista.vista, a) && (!estado || a.state === estado))
  return (
    <section aria-label={t('inversion.aportes.titulo')} className="space-y-2">
      <h2 className="text-sg-h2 font-semibold">{t('inversion.aportes.titulo')}</h2>
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({
          id: v,
          etiqueta: t(`inversion.aportes.vistas.${v}`),
          conteo: aportes.data ? aportes.data.filter((a) => enVista(v, a) && (!estado || a.state === estado)).length : null
        }))}
        actual={lista.vista}
        alCambiar={(vista) => lista.cambiar({ view: vista })}
      />
      <label className="block max-w-xs space-y-1 text-sm">
        <span className="block">{t('inversion.aportes.estado')}</span>
        <SelectNativo
          className={CONTROL}
          textoVacio={t('comun.todos')}
          value={estado}
          onChange={(e) => lista.cambiar({ state: e.target.value })}
          opciones={Object.entries(etiquetas).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
        />
      </label>
      {aportes.truncado ? <Alert tone="warning">{t('inversion.aportes.truncado', { n: numeroPe(aportes.data?.length ?? 0) })}</Alert> : null}
      {aportes.isPending ? (
        <Cargando />
      ) : aportes.isError && !aportes.data ? (
        <FalloDeLectura error={aportes.error} alReintentar={() => void aportes.refetch()} />
      ) : filtrados.length === 0 ? (
        <Vacio titulo={t('inversion.aportes.vacio')}>{t('inversion.aportes.vacioAyuda')}</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('inversion.aportes.tabla')}>
            <thead>
              <tr>
                <Th scope="col">{t('inversion.aportes.columnas.codigo')}</Th>
                {proyecto ? null : <Th scope="col">{t('inversion.aportes.columnas.proyecto')}</Th>}
                <Th scope="col">{t('inversion.aportes.columnas.tipo')}</Th>
                <Th scope="col">{t('inversion.aportes.columnas.recibe')}</Th>
                <Th scope="col">{t('inversion.aportes.columnas.estado')}</Th>
                <Th scope="col">{t('inversion.aportes.columnas.monto')}</Th>
                <Th scope="col">{t('inversion.aportes.columnas.campana')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id}>
                  <Td className="font-sg-mono text-sm">
                    <EnlaceDeRegistro titulo={texto(a, 'code')} ruta={rutaDeFicha('social_contribution', a)} desde={t('inversion.titulo')} />
                  </Td>
                  {proyecto ? null : <Td className="text-sm">{nombreDelProyecto(texto(a, 'project'))}</Td>}
                  <Td className="text-sm">{opcion(a, 'contribution_type') || '—'}</Td>
                  <Td className="text-sm">
                    {texto(a, 'recipient_organization') ? (
                      <RegistroVinculado objeto="organization" id={texto(a, 'recipient_organization')} />
                    ) : texto(a, 'stakeholder') ? (
                      <RegistroVinculado objeto="stakeholder" id={texto(a, 'stakeholder')} />
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <EstadoChip objeto="social_contribution" estado={a.state} />
                  </Td>
                  <Td className="text-sm tabular-nums">{montoPe(atributo(a, 'total_amount'), atributo(a, 'currency'))}</Td>
                  <Td className="text-sm">
                    {texto(a, 'exploration_campaign') ? <RegistroVinculado objeto="exploration_campaign" id={texto(a, 'exploration_campaign')} /> : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  )
}

// el alta de un aporte (con motivo: requiresReason) o de un programa en el proyecto del contexto, con la moneda PEN propuesta; al
// guardar se abre su ficha (S44 o S43)
function Alta({ objeto, proyecto, alCerrar }: { objeto: 'social_contribution' | 'social_program'; proyecto: string; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const [motivo, setMotivo] = useState('')
  const fijos = useMemo(() => ({ project: proyecto }), [proyecto])
  const iniciales = useMemo(() => ({ currency: MONEDA_POR_DEFECTO }), [])
  const esAporte = objeto === 'social_contribution'
  return (
    <Drawer
      titulo={t(esAporte ? 'inversion.nuevoAporte' : 'inversion.nuevoPrograma')}
      descripcion={t(esAporte ? 'inversion.altaAporteAyuda' : 'inversion.altaProgramaAyuda')}
      abierto
      alCerrar={alCerrar}
    >
      {esAporte ? (
        <Campo etiqueta={t('inversion.motivo')} ayuda={t('inversion.motivoAyuda')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
      ) : null}
      <FormularioDeRegistro
        objeto={objeto}
        fijos={fijos}
        iniciales={iniciales}
        campos={esAporte ? CAMPOS_DEL_APORTE : CAMPOS_DEL_PROGRAMA}
        motivo={esAporte ? motivo.trim() || undefined : undefined}
        alGuardar={(r) => navegar(rutaDeFicha(objeto, r) ?? `/projects/${encodeURIComponent(proyecto)}/programs`)}
        alCancelar={alCerrar}
      />
    </Drawer>
  )
}
