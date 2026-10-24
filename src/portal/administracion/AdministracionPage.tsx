import { Alert, Button } from '@wasichai/ui'
import { ExternalLink, FileText, FolderKanban, ShieldAlert, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { Seccion } from '../componentes/Seccion'
import { NS } from '../i18n'
import { estadoDe, guardaDe, useOferta, type ClaveDeSeccion, type Oferta } from '../shell/navTree'

// S53 · Administración (screens.md; hallazgos U-08 y U-37 del rediseño de UX, DD-14): el puente entre lo que se administra en
// el portal, con motivo y reglas, y lo que vive en la consola de la plataforma (/admin, WasichaiApp, otra aplicación). sin
// datos propios. la consola deja editar el modelo, los workflows, los roles y los tipos de documento, que no son la fuente de
// verdad (viven en el repositorio del producto y se aplican al aprovisionar): «Cuidados» lo dice antes del botón que la abre.
// la guarda es la de la sección (solo quien administra); cada destino del portal se ofrece solo si la cuenta lo abre

interface Destino {
  clave: 'proyectos' | 'reglas' | 'plantillas'
  a: string
  icono: LucideIcon
  // la sección cuya guarda tiene la ruta, y lo que la pantalla pide además
  seccion: ClaveDeSeccion
  pide?: (oferta: Oferta) => boolean
}

const DESTINOS: Destino[] = [
  // el equipo y los parámetros son de cada proyecto (/projects/:projectId/settings): se llega por la lista de proyectos
  { clave: 'proyectos', a: '/projects', icono: FolderKanban, seccion: 'projects' },
  // S60 sin proyecto: las reglas de la organización
  { clave: 'reglas', a: '/risks/rules', icono: ShieldAlert, seccion: 'risks', pide: ({ can }) => can('early_warning_rule', 'READ') },
  // S64: solo para quien administra los metadatos de los entregables, como PlantillasPage
  {
    clave: 'plantillas',
    a: '/reports/templates',
    icono: FileText,
    seccion: 'reports',
    pide: ({ isAdmin, can }) => isAdmin || can('deliverable', 'MANAGE_METADATA')
  }
]

const CONSOLA = ['usuarios', 'roles', 'organizacion', 'capas'] as const

export function AdministracionPage() {
  const { t } = useTranslation(NS)
  const oferta = useOferta()
  const destinos = DESTINOS.filter((d) => estadoDe(guardaDe(d.seccion), oferta) === 'disponible' && (d.pide?.(oferta) ?? true))
  return (
    <ContenedorDePagina>
      <EncabezadoDePagina titulo={t('administracion.titulo')} descripcion={t('administracion.descripcion')} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Seccion titulo={t('administracion.portal.titulo')} descripcion={t('administracion.portal.descripcion')}>
          {destinos.length > 0 ? (
            <ul className="space-y-1">
              {destinos.map(({ clave, a, icono: Icono }) => (
                <li key={clave}>
                  <div className="flex items-start gap-3 rounded-sg-md p-2">
                    <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-sg-text-muted" />
                    <div className="min-w-0">
                      <Link to={a} className="text-sm font-medium text-sg-primary-text underline">
                        {t(`administracion.portal.${clave}.enlace`)}
                      </Link>
                      <p className="text-sg-body-sm text-sg-text-secondary">{t(`administracion.portal.${clave}.ayuda`)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-sg-text-secondary">{t('administracion.portal.sinEnlaces')}</p>
          )}
        </Seccion>
        <Seccion titulo={t('administracion.consola.titulo')} descripcion={t('administracion.consola.descripcion')}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-sg-text-secondary">
            {CONSOLA.map((clave) => (
              <li key={clave}>{t(`administracion.consola.items.${clave}`)}</li>
            ))}
          </ul>
          {/* los cuidados van antes del botón: se leen antes de abrir la consola (U-37) */}
          <Seccion titulo={t('administracion.cuidados.titulo')} className="pt-2">
            <Alert tone="warning" title={t('administracion.cuidados.aviso')}>
              <p>{t('administracion.cuidados.texto')}</p>
              <p className="mt-1">{t('administracion.cuidados.motivo')}</p>
            </Alert>
          </Seccion>
          <div className="pt-2">
            <Button asChild variant="secondary">
              {/* la consola es otra aplicación (/admin, fuera del router del portal): un enlace del navegador, en otra pestaña */}
              <a href="/admin" target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden className="size-4" />
                {t('administracion.consola.abrir')}
                <span className="sr-only"> {t('administracion.consola.otraPestana')}</span>
              </a>
            </Button>
          </div>
        </Seccion>
      </div>
    </ContenedorDePagina>
  )
}
