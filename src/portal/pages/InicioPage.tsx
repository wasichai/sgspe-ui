import { useAuth } from '@wasichai/core'
import { Badge, Table, Td, Th } from '@wasichai/ui'
import { CircleCheck, Clock, Lock, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { useCatalogoDeIndicadores } from '../datos/indicadores'
import { INICIOS, inicioPara } from '../inicios'
import { useCuenta, useOrganizacion } from '../queries'
import { estadoDe, NAV_TREE, useOferta, type Estado } from '../shell/navTree'
import { RevisionEjecutivaPage } from '../tableros/RevisionEjecutivaPage'

// cada estado con su tono e ícono de design-system.md §4: nunca solo color
const TONO: Record<Estado, { clase: string; Icono: LucideIcon }> = {
  disponible: { clase: 'bg-sg-success-soft text-sg-success', Icono: CircleCheck },
  'por-llegar': { clase: 'bg-sg-neutral-soft text-sg-neutral', Icono: Clock },
  'solo-admin': { clase: 'bg-sg-neutral-soft text-sg-neutral', Icono: Lock },
  'sin-acceso': { clase: 'bg-sg-warning-soft text-sg-warning', Icono: Lock }
}

// el inicio del portal (S02, ASM-078): la variante del rol si la cuenta tiene una (inicios.ts); si no, desde F8 la revisión
// ejecutiva S51 para quien el catálogo le ofrece el tablero executive (decisión 7 del plan 8.3); si no, la bienvenida de F1.
// mientras el catálogo se lee, o si no se puede leer (un backend sin F8 responde sin KPI-EXE), la bienvenida
export function InicioPage() {
  const oferta = useOferta()
  const variante = inicioPara(INICIOS, oferta)
  const catalogo = useCatalogoDeIndicadores()
  if (variante) return <variante.Pantalla />
  const ejecutivo = (catalogo.data ?? []).some((i) => i.dashboard === 'executive' && i.available)
  return ejecutivo ? <RevisionEjecutivaPage /> : <Bienvenida />
}

// la bienvenida de F1 (docs/ux/ux-architecture.md §6.2; roadmap, B7): quién es, de qué organización, con qué roles, y el
// mapa de módulos por fase, sin indicadores (dashboards.md §11). los roles son los nombres técnicos que contesta wasichai:
// sus etiquetas en español solo las lee quien administra (/api/roles). lo que no se pudo leer se dice; nunca se inventa
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { user, permissions, permissionsError } = useAuth()
  const cuenta = useCuenta()
  const organizacion = useOrganizacion()
  const oferta = useOferta()
  const estados = NAV_TREE.map((seccion) => ({ seccion, estado: estadoDe(seccion, oferta) }))
  const disponibles = estados.filter(({ estado }) => estado === 'disponible').length
  const rotulo = (estado: Estado, fase: string) => (estado === 'por-llegar' ? t('inicio.llegaEn', { fase }) : t(`inicio.estados.${estado}`))
  // mientras los permisos se leen, o si no se pudieron leer, can e isAdmin son falsos sin serlo: ningún estado sale de ellos
  const permisosNoListos = permissions ? null : permissionsError ? 'error' : 'cargando'

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <div className="space-y-1">
        <h1 className="text-sg-h1 font-semibold text-sg-text">{t('inicio.titulo')}</h1>
        <p className="text-sg-body text-sg-text-secondary">{t('inicio.bienvenida', { nombre: user?.displayName ?? '' })}</p>
        <p className="text-sg-body-sm text-sg-text-muted">{t('inicio.porRol')}</p>
      </div>
      <section aria-labelledby="inicio-cuenta" className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-5">
        <h2 id="inicio-cuenta" className="text-sg-h3 font-semibold text-sg-text">
          {t('inicio.cuenta')}
        </h2>
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-sg-body">
          <dt className="text-sg-text-muted">{t('inicio.usuario')}</dt>
          <dd>{user ? `${user.displayName} (${user.email})` : ''}</dd>
          <dt className="text-sg-text-muted">{t('inicio.organizacion')}</dt>
          <dd>{organizacion.isPending ? t('inicio.cargando') : organizacion.isError ? t('inicio.sinOrganizacion') : organizacion.data.name}</dd>
          <dt className="text-sg-text-muted">{t('inicio.roles')}</dt>
          <dd>
            {cuenta.isPending ? (
              t('inicio.cargando')
            ) : cuenta.isError ? (
              t('inicio.sinCuenta')
            ) : cuenta.data.roles.length ? (
              <span className="font-sg-mono text-sg-body-sm">{cuenta.data.roles.join(', ')}</span>
            ) : (
              t('inicio.sinRoles')
            )}
          </dd>
        </dl>
      </section>
      <section aria-labelledby="inicio-modulos" className="space-y-3">
        <div className="space-y-1">
          <h2 id="inicio-modulos" className="text-sg-h2 font-semibold text-sg-text">
            {t('inicio.modulos')}
          </h2>
          <p className="text-sg-body-sm text-sg-text-muted">
            {permisosNoListos === 'error'
              ? t('inicio.sinPermisos')
              : permisosNoListos
                ? t('inicio.cargando')
                : t('inicio.resumen', { disponibles, total: NAV_TREE.length })}
          </p>
        </div>
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table>
            <thead>
              <tr>
                <Th>{t('inicio.seccion')}</Th>
                <Th>{t('inicio.fases')}</Th>
                <Th>{t('inicio.estado')}</Th>
              </tr>
            </thead>
            <tbody>
              {estados.map(({ seccion, estado }) => {
                const { clase, Icono } = TONO[estado]
                return (
                  <tr key={seccion.clave}>
                    <Td>{t(`secciones.${seccion.clave}`)}</Td>
                    <Td className="font-sg-mono tabular-nums">{t(`inicio.notasDeFases.${seccion.clave}`, { defaultValue: seccion.fases.join(', ') })}</Td>
                    <Td>
                      {permisosNoListos ? (
                        <Badge className="gap-1 bg-sg-neutral-soft text-sg-neutral">
                          {permisosNoListos === 'error' ? <TriangleAlert aria-hidden className="size-3" /> : <Clock aria-hidden className="size-3" />}
                          {permisosNoListos === 'error' ? t('inicio.sinPermisos') : t('inicio.cargando')}
                        </Badge>
                      ) : (
                        <Badge className={`gap-1 ${clase}`}>
                          <Icono aria-hidden className="size-3" />
                          {rotulo(estado, seccion.fases[0])}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </section>
    </div>
  )
}
