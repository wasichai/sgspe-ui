import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'
import { useCatalogoDeIndicadores } from '../datos/indicadores'
import { INICIOS, inicioPara } from '../inicios'
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

// la bienvenida (docs/ux/ux-architecture.md §6.2): su trabajo y los accesos a las secciones que su cuenta puede abrir, sin
// indicadores (dashboards.md §11). la cuenta (usuario, organización y roles) vive en el menú del perfil (shell/Perfil.tsx)
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { user, permissions, permissionsError } = useAuth()
  const oferta = useOferta()
  const estados = NAV_TREE.map((seccion) => ({ seccion, estado: estadoDe(seccion, oferta) }))
  const disponibles = estados.filter(({ estado }) => estado === 'disponible').length
  // mientras los permisos se leen, o si no se pudieron leer, can e isAdmin son falsos sin serlo: ningún estado sale de ellos
  const permisosNoListos = permissions ? null : permissionsError ? 'error' : 'cargando'
  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <div className="space-y-1">
        <h1 className="text-sg-h1 font-semibold text-sg-text">{t('inicio.titulo')}</h1>
        <p className="text-sg-body text-sg-text-secondary">{t('inicio.bienvenida', { nombre: user?.displayName ?? '' })}</p>
      </div>
      <SuTrabajo />
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
