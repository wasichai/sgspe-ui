import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Table, Td, Th } from '@wasichai/ui'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Persona } from '../componentes/Persona'
import { Seccion } from '../componentes/Seccion'
import { CAJA_DE_TABLA, CELDA, ENCABEZADO, FILA, NOTA_AL_PIE } from '../componentes/TablaPriorizada'
import { ROL_DE_JEFATURA } from '../config'
import { useMisAsignaciones, useProyectos, vigenciaDeAsignacion } from '../contexto/proyectos'
import { useSumasDeConteos, type PedidoDeConteo } from '../datos/conteos'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'

// «Mis proyectos» del inicio (S02, revisión de UX, etapa 2; P-01 del rediseño): una tabla compacta, una fila por proyecto con
// asignación vigente, con su jefatura (ASM-080), su estado si no está activo y lo que pide acción, que lleva a su lista: compromisos
// vencidos, QCS vencidas y riesgos altos o críticos, en danger. un cero es un cero apagado y sin enlace; una columna que la cuenta no
// lee no se dibuja (DD-38: no es un dato que falte) y una cifra que no llegó es «—», nunca cero, con su nota al pie. con más de seis, los seis con más pendientes y
// «Ver todos». sin subrayados (U-05). en el teléfono las columnas de cifras se angostan para que la tabla quepa en 390 px. los riesgos llevan a su lista ya filtrada por nivel (tercera pasada de UX, 3.11)
const MAXIMO = 6
const QCS = ['grievance', 'inquiry', 'stakeholder_request']
type Cifra = 'compromisos' | 'qcs' | 'riesgos'
const CIFRAS: { cifra: Cifra; objetos: string[]; filtros: Record<string, string | string[]>; resto: string }[] = [
  { cifra: 'compromisos', objetos: ['commitment'], filtros: { deadline_status: 'VENCIDO' }, resto: 'commitments?view=vencidos' },
  { cifra: 'qcs', objetos: QCS, filtros: { deadline_status: 'VENCIDO' }, resto: 'attention?view=atencion' },
  { cifra: 'riesgos', objetos: ['social_risk'], filtros: { risk_level: ['ALTO', 'CRITICO'] }, resto: 'risks/register?level=alto' }
]

export function MisProyectos() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const asignaciones = useMisAsignaciones()
  const proyectos = useProyectos()
  const jefaturas = useTodos('project_assignment', { role_name: ROL_DE_JEFATURA, active: true }, can('project_assignment', 'READ'))
  const vigentes = new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(atributo(a, 'project'))))
  const mios = (proyectos.data ?? []).filter((p) => vigentes.has(p.id))
  const pedidos: PedidoDeConteo[] = mios.flatMap((p) =>
    CIFRAS.flatMap(({ cifra, objetos, filtros }) =>
      objetos.filter((o) => can(o, 'READ')).map((objeto) => ({ clave: `${p.id}:${cifra}`, objeto, filtros: { project: p.id, ...filtros } }))
    )
  )
  const sumas = useSumasDeConteos(pedidos)
  const legibles = CIFRAS.filter(({ objetos }) => objetos.some((o) => can(o, 'READ')))
  if (mios.length === 0) return null
  const cifra = (p: Registro, c: Cifra) => sumas[`${p.id}:${c}`] ?? null
  const pendientes = (p: Registro) => CIFRAS.reduce((total, { cifra: c }) => total + (cifra(p, c) ?? 0), 0)
  const visibles = [...mios].sort((a, b) => pendientes(b) - pendientes(a)).slice(0, MAXIMO)
  const jefes = (p: Registro) => (jefaturas.data ?? []).filter((j) => atributo(j, 'project') === p.id).map((j) => texto(j, 'member_user_email'))
  const enlace = 'no-underline hover:underline focus-visible:underline'
  const sinDato = visibles.some((p) => legibles.some(({ cifra: c }) => cifra(p, c) === null))
  return (
    <Seccion
      titulo={t('miDia.proyectos.titulo')}
      acciones={
        mios.length > MAXIMO ? (
          <Link to="/projects" className={`text-sg-body-sm font-medium text-sg-primary-text ${enlace}`}>
            {t('miDia.proyectos.verTodos', { count: mios.length })}
          </Link>
        ) : undefined
      }
    >
      {/* la tabla compacta de S02: el proyecto con su código en la monoespaciada, su jefatura y, si no está activo, su estado; y una
          columna por cifra que la cuenta lee, a la derecha, en danger y enlazada cuando pide acción */}
      <div className={CAJA_DE_TABLA}>
        <div className="overflow-x-auto">
          <Table aria-label={t('miDia.proyectos.titulo')}>
            <thead>
              <tr>
                <Th scope="col" className={ENCABEZADO}>
                  {t('miDia.proyectos.proyecto')}
                </Th>
                {legibles.map(({ cifra: c }) => (
                  <Th key={c} scope="col" className={`${ENCABEZADO} text-right max-sm:px-2 max-sm:leading-tight max-sm:whitespace-normal`}>
                    <abbr title={t(`miDia.proyectos.nombres.${c}`)} aria-hidden className="no-underline">
                      {t(`miDia.proyectos.cortos.${c}`)}
                    </abbr>
                    <span className="sr-only">{t(`miDia.proyectos.nombres.${c}`)}</span>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const base = `/projects/${encodeURIComponent(p.id)}`
                const suyos = jefes(p)
                return (
                  <tr key={p.id} className={FILA}>
                    <Td className={`${CELDA} w-full whitespace-normal`}>
                      <Link to={`${base}/overview`} className={`text-sg-text ${enlace}`}>
                        <span className="font-sg-mono text-sg-body-sm text-sg-text-secondary">{texto(p, 'code')}</span>{' '}
                        <span className="font-semibold">{texto(p, 'name')}</span>
                      </Link>
                      {p.state && p.state !== 'active' ? (
                        <div className="mt-1">
                          <EstadoChip objeto="project" estado={p.state} />
                        </div>
                      ) : null}
                      <p className="text-sg-caption text-sg-text-secondary">
                        {t('miDia.proyectos.jefatura')}:{' '}
                        {suyos.length
                          ? suyos.map((correo, i) => (
                              <span key={correo}>
                                {i > 0 ? ', ' : null}
                                <Persona correo={correo} />
                              </span>
                            ))
                          : t('miDia.proyectos.sinJefatura')}
                      </p>
                    </Td>
                    {legibles.map(({ cifra: c, resto }) => {
                      const n = cifra(p, c)
                      return (
                        <Td key={c} className={`${CELDA} text-right tabular-nums max-sm:px-2`}>
                          {n === null ? (
                            <span className="text-sg-text-muted">—</span>
                          ) : n === 0 ? (
                            <span className="text-sg-text-muted">0</span>
                          ) : (
                            <Link to={`${base}/${resto}`} aria-label={t(`miDia.proyectos.${c}`, { count: n })} className={`font-bold text-sg-danger ${enlace}`}>
                              {numeroPe(n)}
                            </Link>
                          )}
                        </Td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
        {sinDato ? <p className={NOTA_AL_PIE}>{t('miDia.proyectos.notaAlPie')}</p> : null}
      </div>
    </Seccion>
  )
}
