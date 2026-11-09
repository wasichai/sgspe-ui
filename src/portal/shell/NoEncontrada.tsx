import { Button } from '@wasichai/ui'
import { FileQuestion } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { ContenedorDePagina, useTituloDeDocumento } from '../componentes/Pagina'
import { NS } from '../i18n'
import { NAV_TREE } from './navTree'
import { seccionDeRuta } from './seccionActual'

// la ruta que no existe (rediseño de UX, 2026-10-20): dentro de una sección, una ruta que sus <Routes> no declaran dejaba la
// página en blanco. dice que no existe, por qué puede pasar y cómo seguir: la lista de su sección, si la ruta es de una, y el
// inicio. la sección se ofrece aunque la cuenta no la tenga: su guarda lo dice al llegar. es una página: su título es el h1
export function NoEncontrada() {
  const { t } = useTranslation(NS)
  const clave = seccionDeRuta(useLocation().pathname)
  const seccion = clave && clave !== 'dashboard' ? NAV_TREE.find((s) => s.clave === clave && !s.external) : undefined
  const titulo = useId()
  useTituloDeDocumento(t('noEncontrada'))
  // el bloque de estado de toda página que no se abre (como EstadoSinAcceso, design-system.md §6.5): borde de 2 px, el ícono, el
  // título como h1 de la página, por qué puede pasar y las salidas como botones, en el ancho y los márgenes de toda página
  return (
    <ContenedorDePagina>
      <section aria-labelledby={titulo} className="mx-auto max-w-xl rounded-sg-md border-2 border-sg-border-strong bg-sg-surface p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-sg-md bg-sg-surface-sunken text-sg-text-secondary">
            <FileQuestion aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 id={titulo} className="text-sg-h2 text-sg-text">
              {t('noEncontrada')}
            </h1>
            <p className="text-sg-body text-sg-text-secondary">{t('noEncontradaAyuda')}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {seccion ? (
                <Button asChild variant="secondary">
                  <Link to={seccion.to}>{t('irA', { seccion: t(`secciones.${seccion.clave}`) })}</Link>
                </Button>
              ) : null}
              <Button asChild variant={seccion ? 'ghost' : 'secondary'}>
                <Link to="/">{t('irAlInicio')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </ContenedorDePagina>
  )
}
