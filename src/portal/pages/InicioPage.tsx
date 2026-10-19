import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'
import { useCatalogoDeIndicadores } from '../datos/indicadores'
import { INICIOS, inicioPara } from '../inicios'
import { useNombresDeRol } from '../proyectos/usuarios'
import { useCuenta, useOrganizacion } from '../queries'
import { estadoDe, NAV_TREE, useOferta } from '../shell/navTree'
import { RevisionEjecutivaPage } from '../tableros/RevisionEjecutivaPage'
import { SuTrabajo } from './SuTrabajo'

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

// la bienvenida (docs/ux/ux-architecture.md §6.2): quién es, de qué organización, con qué roles, y los accesos a las secciones
// que su cuenta puede abrir, sin indicadores (dashboards.md §11). los roles se dicen por su rótulo, que solo lee quien
// administra (/api/roles); su código técnico no se muestra. lo que no se pudo leer se dice; nunca se inventa
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { user, permissions, permissionsError } = useAuth()
  const cuenta = useCuenta()
  const organizacion = useOrganizacion()
  const oferta = useOferta()
  const estados = NAV_TREE.map((seccion) => ({ seccion, estado: estadoDe(seccion, oferta) }))
  const disponibles = estados.filter(({ estado }) => estado === 'disponible').length
  // mientras los permisos se leen, o si no se pudieron leer, can e isAdmin son falsos sin serlo: ningún estado sale de ellos
  const permisosNoListos = permissions ? null : permissionsError ? 'error' : 'cargando'
  const nombresDeRol = useNombresDeRol()
  // los roles por su rótulo si la cuenta lee el directorio de roles; si no, cuántos son, nunca su código técnico
  const rolesDe = (roles: string[]) => {
    const rotulos = roles.map((r) => nombresDeRol.data?.find((x) => x.name === r)?.label).filter(Boolean)
    return rotulos.length === roles.length ? rotulos.join(', ') : t('inicio.rolesAsignados', { count: roles.length })
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <div className="space-y-1">
        <h1 className="text-sg-h1 font-semibold text-sg-text">{t('inicio.titulo')}</h1>
        <p className="text-sg-body text-sg-text-secondary">{t('inicio.bienvenida', { nombre: user?.displayName ?? '' })}</p>
      </div>
      <SuTrabajo />
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
            {cuenta.isPending
              ? t('inicio.cargando')
              : cuenta.isError
                ? t('inicio.sinCuenta')
                : cuenta.data.roles.length
                  ? rolesDe(cuenta.data.roles)
                  : t('inicio.sinRoles')}
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
        {/* las secciones que la cuenta puede abrir, como accesos; las fases son del plan, no de quien usa el portal */}
        {permisosNoListos ? null : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {estados
              .filter(({ seccion, estado }) => estado === 'disponible' && seccion.clave !== 'dashboard')
              .map(({ seccion }) => {
                const Icono = seccion.icon
                return (
                  <li key={seccion.clave}>
                    <Link
                      to={seccion.to}
                      className="flex items-center gap-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 font-medium text-sg-text hover:bg-sg-surface-hover"
                    >
                      {Icono ? <Icono aria-hidden className="size-5 text-sg-primary-text" /> : null}
                      {t(`secciones.${seccion.clave}`)}
                    </Link>
                  </li>
                )
              })}
          </ul>
        )}
      </section>
    </div>
  )
}
