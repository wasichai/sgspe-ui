import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'
import { INICIOS, inicioPara } from '../inicios'
import { estadoDe, NAV_TREE, useOferta } from '../shell/navTree'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { useMisAsignaciones, vigenciaDeAsignacion } from '../contexto/proyectos'
import { Atajos, useAtajos } from './Atajos'
import { AtencionRequerida } from './AtencionRequerida'
import { MisProyectos } from './MisProyectos'
import { SuTrabajo, useSuTrabajo } from './SuTrabajo'
import { VisionEjecutiva } from './VisionEjecutiva'

// el inicio del portal (S02, ASM-078): la variante del rol si la cuenta tiene una (inicios.ts); si no, «Mi día». desde el
// rediseño de UX (DD-01, hallazgo U-01) la revisión ejecutiva S51 ya no es el inicio de quien el catálogo se la ofrece, que
// llevaba a un tablero de «No disponible» a quien no lee sus cifras: vive en /dashboards/executive, y «Mi día» la resume en
// la visión ejecutiva con las cifras que la cuenta lee
export function InicioPage() {
  const oferta = useOferta()
  const variante = inicioPara(INICIOS, oferta)
  if (variante) return <variante.Pantalla />
  return <Bienvenida />
}

// «Mi día» (S02, revisión de UX, etapa 2): lo primero que se ve contesta, en este orden, qué está vencido o por vencer a su cargo
// y qué espera su decisión (AtencionRequerida), cómo crea lo de siempre (Atajos), cómo van sus proyectos (MisProyectos) y todo lo
// que tiene abierto (SuTrabajo). la grilla de secciones, que repite la barra lateral, solo queda cuando no hay nada de eso: la
// bienvenida de F1, sin indicadores (dashboards.md §11). la cuenta vive en el menú del perfil (shell/Perfil.tsx). el monitoreo de
// la Tabla 9.5 y el catálogo de indicadores se ofrecen aquí también a quien no tiene la revisión ejecutiva, que los enlaza: a quien
// lee indicator o indicator_measurement, el monitoreo; a quien lee indicator, el catálogo
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { user, permissions, permissionsError, can } = useAuth()
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
  const conCatalogo = can('indicator', 'READ')
  const conMonitoreo = conCatalogo || can('indicator_measurement', 'READ')
  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <EncabezadoDePagina
        titulo={t('inicio.titulo')}
        descripcion={t('inicio.bienvenida', { nombre: user?.displayName ?? '' })}
        secundarias={
          conMonitoreo ? (
            <>
              <Button asChild size="sm" variant="secondary">
                <Link to="/dashboards/monitoring">{t('tablerosF8.monitoreo.titulo')}</Link>
              </Button>
              {conCatalogo ? (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/dashboards/indicators">{t('tablerosF8.catalogo.titulo')}</Link>
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      <AtencionRequerida />
      <Atajos />
      <MisProyectos />
      <SuTrabajo />
      <VisionEjecutiva />
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
