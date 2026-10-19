import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Persona } from '../componentes/Persona'
import { ROL_DE_JEFATURA } from '../config'
import { nombreDeProyecto, useMisAsignaciones, useProyectos, vigenciaDeAsignacion } from '../contexto/proyectos'
import { useSumasDeConteos, type PedidoDeConteo } from '../datos/conteos'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// «Mis proyectos» del inicio (S02, revisión de UX, etapa 2): una tarjeta por proyecto con asignación vigente, con su estado, su
// jefatura (ASM-080) y tres cifras que llevan a su lista: compromisos vencidos, QCS vencidas y riesgos altos o críticos. con más
// de seis, los seis con más pendientes y «Ver todos». una cifra que la cuenta no lee, o que no llegó, es «—», nunca cero
const MAXIMO = 6
const QCS = ['grievance', 'inquiry', 'stakeholder_request']
type Cifra = 'compromisos' | 'qcs' | 'riesgos'
const CIFRAS: { cifra: Cifra; objetos: string[]; filtros: Record<string, string | string[]>; resto: string }[] = [
  { cifra: 'compromisos', objetos: ['commitment'], filtros: { deadline_status: 'VENCIDO' }, resto: 'commitments?view=vencidos' },
  { cifra: 'qcs', objetos: QCS, filtros: { deadline_status: 'VENCIDO' }, resto: 'attention?view=atencion' },
  { cifra: 'riesgos', objetos: ['social_risk'], filtros: { risk_level: ['ALTO', 'CRITICO'] }, resto: 'risks/register' }
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
  if (mios.length === 0) return null
  const cifra = (p: Registro, c: Cifra) => sumas[`${p.id}:${c}`] ?? null
  const pendientes = (p: Registro) => CIFRAS.reduce((total, { cifra: c }) => total + (cifra(p, c) ?? 0), 0)
  const visibles = [...mios].sort((a, b) => pendientes(b) - pendientes(a)).slice(0, MAXIMO)
  const jefes = (p: Registro) => (jefaturas.data ?? []).filter((j) => atributo(j, 'project') === p.id).map((j) => texto(j, 'member_user_email'))
  return (
    <section aria-labelledby="mis-proyectos" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="mis-proyectos" className="text-sg-h3 font-semibold">
          {t('miDia.proyectos.titulo')}
        </h2>
        {mios.length > MAXIMO ? (
          <Link to="/projects" className="text-sm text-sg-primary-text underline">
            {t('miDia.proyectos.verTodos', { count: mios.length })}
          </Link>
        ) : null}
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((p) => {
          const base = `/projects/${encodeURIComponent(p.id)}`
          const suyos = jefes(p)
          return (
            <li key={p.id} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`${base}/overview`} className="font-medium text-sg-primary-text underline">
                  {nombreDeProyecto(p)}
                </Link>
                <EstadoChip objeto="project" estado={p.state} />
              </div>
              <p className="text-sg-text-secondary">
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
              <ul className="space-y-0.5">
                {CIFRAS.map(({ cifra: c, resto }) => {
                  const n = cifra(p, c)
                  return (
                    <li key={c}>
                      {n === null ? (
                        <span className="text-sg-text-muted">{t('miDia.proyectos.sinDato', { cifra: t(`miDia.proyectos.nombres.${c}`) })}</span>
                      ) : (
                        <Link to={`${base}/${resto}`} className={n > 0 ? 'font-medium text-sg-danger underline' : 'text-sg-text-secondary underline'}>
                          {t(`miDia.proyectos.${c}`, { count: n })}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
