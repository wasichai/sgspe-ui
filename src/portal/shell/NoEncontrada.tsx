import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { useTituloDeDocumento } from '../componentes/Pagina'
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
  useTituloDeDocumento(t('noEncontrada'))
  return (
    <div className="rounded-sg-lg border border-dashed border-sg-border p-8 text-center">
      <h1 className="text-sg-h3 font-semibold text-sg-text">{t('noEncontrada')}</h1>
      <p className="mt-2 text-sm text-sg-text-secondary">{t('noEncontradaAyuda')}</p>
      <p className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
        {seccion ? (
          <Link to={seccion.to} className="font-medium text-sg-primary-text underline">
            {t('irA', { seccion: t(`secciones.${seccion.clave}`) })}
          </Link>
        ) : null}
        <Link to="/" className="font-medium text-sg-primary-text underline">
          {t('irAlInicio')}
        </Link>
      </p>
    </div>
  )
}
