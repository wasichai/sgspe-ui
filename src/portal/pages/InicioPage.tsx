import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'
import { INICIOS, inicioPara } from '../inicios'
import { estadoDe, NAV_TREE, useOferta } from '../shell/navTree'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { ahoraEnLima } from '../datos/fechas'
import { texto } from '../datos/registros'
import { useMisAsignaciones, vigenciaDeAsignacion } from '../contexto/proyectos'
import { Agenda } from './Agenda'
import { useSuTrabajo } from './aSuCargo'
import { Atajos, Consultas, SinAsignacion, useAtajos } from './Atajos'
import { EsperanSuDecision } from './EsperanSuDecision'
import { LoQueMeToca } from './LoQueMeToca'
import { MisProyectos } from './MisProyectos'
import { EnlaceARevisionEjecutiva, VisionEjecutiva } from './VisionEjecutiva'

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

// «Mi trabajo» (S02; P-01 y DD-01 del rediseño de UX): el inicio contesta por urgencia, no por módulo, y cada bloque se ofrece por
// lo que la cuenta lee, sin dibujarse si no tiene nada legible: lo que le toca hoy, con lo vencido primero y lo que puede tomar de
// sus proyectos (LoQueMeToca), lo que espera su decisión (EsperanSuDecision), su agenda de la semana (Agenda), cómo registra lo de
// siempre (Atajos), cómo van sus proyectos (MisProyectos) y, al final, la visión ejecutiva con las cifras que lee. la grilla de
// secciones, que repite la barra lateral, solo queda cuando no hay nada de eso: la bienvenida de F1, sin indicadores
// (dashboards.md §11). la cuenta vive en el menú del perfil (shell/Perfil.tsx). el monitoreo de la Tabla 9.5 y el catálogo de
// indicadores van al final, en «Consultar» (Consultas, tercera pasada de UX, 3.1), y sin asignación vigente se dice a quién pedirla
function Bienvenida() {
  const { t } = useTranslation(NS)
  const { permissions, permissionsError } = useAuth()
  const saludo = useSaludo()
  const oferta = useOferta()
  const trabajo = useSuTrabajo()
  const atajos = useAtajos()
  const asignaciones = useMisAsignaciones()
  const asignado = (asignaciones.data ?? []).some((a) => vigenciaDeAsignacion(a) === 'vigente')
  const conMiDia = trabajo.lee || atajos.ofrecidos.length > 0 || atajos.sinDonde || atajos.proyecto || asignado
  const estados = NAV_TREE.map((seccion) => ({ seccion, estado: estadoDe(seccion, oferta) }))
  const disponibles = estados.filter(({ estado }) => estado === 'disponible').length
  // mientras los permisos se leen, o si no se pudieron leer, can e isAdmin son falsos sin serlo: ningún estado sale de ellos
  const permisosNoListos = permissions ? null : permissionsError ? 'error' : 'cargando'
  return (
    <ContenedorDePagina>
      {/* S02: la sobrelínea «Mi trabajo», el saludo por la hora de Lima y lo vencido o por vencer a su cargo; a la derecha, la
          revisión ejecutiva a quien el catálogo se la ofrece. el documento sigue llamándose «Inicio» */}
      <EncabezadoDePagina
        antetitulo={t('miDia.antetitulo')}
        antetituloEnSans
        titulo={saludo}
        tituloDelDocumento={t('inicio.titulo')}
        descripcion={<ResumenDeHoy />}
        secundarias={<EnlaceARevisionEjecutiva />}
      />
      <SinAsignacion />
      {/* dos columnas desde xl (el resto y 440 px): lo que pide acción a la izquierda; la semana, los proyectos y los atajos a la
          derecha. en una columna, el mismo orden de urgencia */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0 space-y-5">
          <LoQueMeToca />
          <EsperanSuDecision />
          <VisionEjecutiva />
        </div>
        <div className="min-w-0 space-y-5">
          <Agenda />
          <MisProyectos />
          <Atajos />
          <Consultas />
        </div>
      </div>
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
    </ContenedorDePagina>
  )
}

// el saludo de S02 por la hora de Lima: de 5 a 11, buenos días; de 12 a 18, buenas tardes; si no, buenas noches
function useSaludo(): string {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const hora = Number(ahoraEnLima().slice(11, 13))
  const momento = hora >= 5 && hora < 12 ? 'manana' : hora >= 12 && hora < 19 ? 'tarde' : 'noche'
  const saludo = t(`miDia.saludo.${momento}`, { nombre: user?.displayName ?? '' })
  // sin nombre, sin la coma colgando
  return saludo.replace(/,\s*$/, '')
}

// lo vencido o por vencer a su cargo, en una línea bajo el saludo (S02); sin lectura de su trabajo, o mientras se lee, nada
function ResumenDeHoy() {
  const { t } = useTranslation(NS)
  const trabajo = useSuTrabajo()
  if (!trabajo.lee || trabajo.cargando) return null
  const urgentes = [...trabajo.abiertas, ...trabajo.aCargo, ...trabajo.qcs.map((q) => q.registro)].filter((r) =>
    URGENTES.includes(texto(r, 'deadline_status'))
  ).length
  return <>{urgentes === 0 ? t('miDia.resumenNada') : t('miDia.resumen', { count: urgentes })}</>
}
const URGENTES = ['VENCIDO', 'POR VENCER']
