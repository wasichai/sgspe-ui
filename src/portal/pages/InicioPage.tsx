import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'
import { useCatalogoDeIndicadores } from '../datos/indicadores'
import { INICIOS, inicioPara } from '../inicios'
import { estadoDe, NAV_TREE, useOferta } from '../shell/navTree'
import { RevisionEjecutivaPage } from '../tableros/RevisionEjecutivaPage'
import { Cargando } from '../componentes/Estados'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { useMisAsignaciones, vigenciaDeAsignacion } from '../contexto/proyectos'
import { Atajos, useAtajos } from './Atajos'
import { AtencionRequerida } from './AtencionRequerida'
import { MisProyectos } from './MisProyectos'
import { SuTrabajo, useSuTrabajo } from './SuTrabajo'

// el inicio del portal (S02, ASM-078): la variante del rol si la cuenta tiene una (inicios.ts); si no, desde F8 la revisión
// ejecutiva S51 para quien el catálogo le ofrece el tablero executive (decisión 7 del plan 8.3); si no, «Mi día». mientras el
// catálogo se lee, la carga: un inicio que se dibuja y después cambia por otro desorienta (revisión de UX, etapa 2). si no se
// puede leer (un backend sin F8 responde sin KPI-EXE), «Mi día»
export function InicioPage() {
  const oferta = useOferta()
  const variante = inicioPara(INICIOS, oferta)
  const catalogo = useCatalogoDeIndicadores()
  if (variante) return <variante.Pantalla />
  if (catalogo.isPending) return <Cargando />
  const ejecutivo = (catalogo.data ?? []).some((i) => i.dashboard === 'executive' && i.available)
  return ejecutivo ? <RevisionEjecutivaPage /> : <Bienvenida />
}

// «Mi día» (S02, revisión de UX, etapa 2): lo primero que se ve contesta, en este orden, qué está vencido o por vencer a su cargo
// y qué espera su decisión (AtencionRequerida), cómo crea lo de siempre (Atajos), cómo van sus proyectos (MisProyectos) y todo lo
// que tiene abierto (SuTrabajo). la grilla de secciones, que repite la barra lateral, solo queda cuando no hay nada de eso: la
// bienvenida de F1, sin indicadores (dashboards.md §11). la cuenta vive en el menú del perfil (shell/Perfil.tsx)
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { user, permissions, permissionsError } = useAuth()
  const oferta = useOferta()
  const trabajo = useSuTrabajo()
  const atajos = useAtajos()
  const asignaciones = useMisAsignaciones()
  const asignado = (asignaciones.data ?? []).some((a) => vigenciaDeAsignacion(a) === 'vigente')
  const conMiDia = trabajo.lee || atajos.ofrecidos.length > 0 || atajos.proyecto || asignado
  const estados = NAV_TREE.map((seccion) => ({ seccion, estado: estadoDe(seccion, oferta) }))
  const disponibles = estados.filter(({ estado }) => estado === 'disponible').length
  // mientras los permisos se leen, o si no se pudieron leer, can e isAdmin son falsos sin serlo: ningún estado sale de ellos
  const permisosNoListos = permissions ? null : permissionsError ? 'error' : 'cargando'
  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <EncabezadoDePagina titulo={t('inicio.titulo')} descripcion={t('inicio.bienvenida', { nombre: user?.displayName ?? '' })} />
      <AtencionRequerida />
      <Atajos />
      <MisProyectos />
      <SuTrabajo />
      {conMiDia ? null : (
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
      )}
    </div>
  )
}
