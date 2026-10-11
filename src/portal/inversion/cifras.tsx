import { Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { montoPe } from '../componentes/Monto'
import { aDiezmilesimos, deDiezmilesimos } from '../datos/decimales'
import { desglose, type Indicador } from '../datos/indicadores'
import { porcentaje } from '../datos/inversion'
import { NS, numeroPe } from '../i18n'

// las cifras de la inversión que comparten S42 y el tablero de inversión (dashboards.md §4.7 y §5.10, spec F5 §3.9). la forma de
// cada KPI-INV es la de InvestmentKpis (plan 5.2b; «Dependencias de otros planes» del plan 5.3): los montos llegan como texto o
// número y se dicen en su moneda; nunca se suman entre monedas (ASM-063) ni en coma flotante. un monto que no vino es «—», nunca 0

// un conteo (beneficiarios, montos en otra moneda) que llega como número o texto; null si no es un número
export const cifraDe = (valor: unknown): number | null => {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN
  return Number.isFinite(n) ? n : null
}
const moneda = (valor: unknown): string | null => (typeof valor === 'string' && valor ? valor : null)

// KPI-INV-01: por campaña, el tope, lo comprometido (compromisos y aportes, elección 6) y lo ejecutado, que son cifras distintas
// (ASM-063). la barra dibuja lo ejecutado frente al tope y su texto lo dice; una campaña sin moneda o con montos en otra moneda lo
// advierte
export function CampanasFrenteAlTope({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const filas = desglose(indicador, 'campaign')
  if (filas.length === 0) return <p className="text-sm text-sg-text-muted">{t('inversion.cifras.sinCampanas')}</p>
  return (
    <div className="space-y-2">
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map((f) => {
          const enMoneda = moneda(f.currency)
          const nombre = f.label ?? f.key
          // los porcentajes y los conteos los da el servidor (InvestmentKpis.campaigns, plan 5.2b): no se recalculan aquí
          const avance = cifraDe(f.executedPercent)
          const comprometido = cifraDe(f.committedPercent)
          const otras = (cifraDe(f.committedOtherCurrencyCount) ?? 0) + (cifraDe(f.otherCurrencyCount) ?? 0)
          return (
            <li key={f.key} className="space-y-1 rounded-sg-md border border-sg-border p-3 text-sm">
              <p className="font-medium">{nombre}</p>
              <div
                role="progressbar"
                aria-label={t('inversion.cifras.ejecutadoDe', { campana: nombre })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={avance ?? undefined}
                aria-valuetext={avance === null ? '—' : t('inversion.cifras.avanceDicho', { avance: numeroPe(avance) })}
                className="h-2 rounded-full bg-sg-surface-sunken"
              >
                <div className="h-2 rounded-full bg-sg-primary" style={{ width: `${Math.min(100, avance ?? 0)}%` }} />
              </div>
              <p>{t('inversion.cifras.tope', { monto: montoPe(f.cap, enMoneda) })}</p>
              <p>
                {t('inversion.cifras.comprometido', { monto: montoPe(f.committed, enMoneda) })}
                {comprometido === null ? '' : ` (${numeroPe(comprometido)} %)`}
              </p>
              <p>{t('inversion.cifras.ejecutado', { monto: montoPe(f.executed, enMoneda) })}</p>
              {enMoneda ? null : <p className="text-sg-caption text-sg-warning">{t('inversion.cifras.sinMoneda')}</p>}
              {otras > 0 ? <p className="text-sg-caption text-sg-warning">{t('inversion.cifras.otraMoneda', { n: numeroPe(otras) })}</p> : null}
            </li>
          )
        })}
      </ul>
      <p className="text-sg-caption text-sg-text-muted">{t('inversion.cifras.distintas')}</p>
    </div>
  )
}

// KPI-INV-02 de un año, sumado por moneda (S42): lo asignado y lo ejecutado registrado a mano (decisión 4). una moneda sin ningún
// ejecutado registrado dice «—», no cero
export function PresupuestoPorMoneda({ indicador, anio }: { indicador: Indicador; anio: number }) {
  const { t } = useTranslation(NS)
  const porMoneda = new Map<string, { asignado: bigint; ejecutado: bigint | null }>()
  for (const f of desglose(indicador, 'program').filter((x) => cifraDe(x.year) === anio)) {
    const clave = moneda(f.currency) ?? '—'
    const actual = porMoneda.get(clave) ?? { asignado: 0n, ejecutado: null }
    const asignado = aDiezmilesimos(f.allocated)
    const ejecutado = aDiezmilesimos(f.executed)
    porMoneda.set(clave, {
      asignado: actual.asignado + (asignado ?? 0n),
      ejecutado: ejecutado === null ? actual.ejecutado : (actual.ejecutado ?? 0n) + ejecutado
    })
  }
  if (porMoneda.size === 0) return <p className="text-sm text-sg-text-muted">{t('inversion.cifras.sinPresupuesto', { anio })}</p>
  return (
    <Table aria-label={t('inversion.cifras.presupuesto', { anio })}>
      <thead>
        <tr>
          <Th scope="col">{t('inversion.cifras.moneda')}</Th>
          <Th scope="col">{t('inversion.cifras.asignado')}</Th>
          <Th scope="col">{t('inversion.cifras.ejecutadoColumna')}</Th>
          <Th scope="col">{t('inversion.cifras.avance')}</Th>
        </tr>
      </thead>
      <tbody>
        {[...porMoneda].map(([m, { asignado, ejecutado }]) => {
          const avance = ejecutado === null ? null : porcentaje(deDiezmilesimos(ejecutado), deDiezmilesimos(asignado))
          return (
            <tr key={m}>
              <Th scope="row">{m}</Th>
              <Td className="tabular-nums">{montoPe(deDiezmilesimos(asignado), m)}</Td>
              <Td className="tabular-nums">{ejecutado === null ? '—' : montoPe(deDiezmilesimos(ejecutado), m)}</Td>
              <Td className="tabular-nums">{avance === null ? '—' : `${numeroPe(avance)} %`}</Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

// el presupuesto (allocated) o el ejecutado (executed) de un programa en un año, una cifra por moneda: «S/ 80,000.00 · US$ 5,000.00»
export function presupuestoDelPrograma(indicador: Indicador | undefined, programa: string, anio: number, campo: 'allocated' | 'executed'): string {
  if (!indicador?.available) return '—'
  const cifras = desglose(indicador, 'program')
    .filter((f) => f.program === programa && cifraDe(f.year) === anio && aDiezmilesimos(f[campo]) !== null)
    .map((f) => montoPe(f[campo], moneda(f.currency)))
  return cifras.length > 0 ? cifras.join(' · ') : '—'
}

// KPI-INV-04: tres bloques sin sumar (spec F5 §3.9): los grupos de los programas (meta y alcanzados), los aportes ejecutados y los
// compromisos cumplidos. una misma persona puede estar en varias fuentes. el desglose `source` del servidor (InvestmentKpis,
// plan 5.2b) trae una fila por fuente con su clave: PROGRAMAS (value y target), APORTES y COMPROMISOS (value)
export function BeneficiariosPorFuente({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const fila = (clave: 'PROGRAMAS' | 'APORTES' | 'COMPROMISOS') => desglose(indicador, 'source').find((f) => f.key === clave)
  const dicho = (valor: unknown) => {
    const n = cifraDe(valor)
    return n === null ? '—' : numeroPe(n)
  }
  return (
    <div className="space-y-1 text-sm">
      <p>{t('inversion.cifras.deProgramas', { alcanzados: dicho(fila('PROGRAMAS')?.value), meta: dicho(fila('PROGRAMAS')?.target) })}</p>
      <p>{t('inversion.cifras.deAportes', { n: dicho(fila('APORTES')?.value) })}</p>
      <p>{t('inversion.cifras.deCompromisos', { n: dicho(fila('COMPROMISOS')?.value) })}</p>
      <p className="text-sg-caption text-sg-text-muted">{t('inversion.cifras.noSeSuman')}</p>
    </div>
  )
}
