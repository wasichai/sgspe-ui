import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Vacio } from '../componentes/Estados'
import { NS } from '../i18n'
import { NAV_TREE } from './navTree'
import { seccionDeRuta } from './seccionActual'

// la ruta que no existe (rediseño de UX, 2026-10-20): dentro de una sección, una ruta que sus <Routes> no declaran dejaba la
// página en blanco. dice que no existe, por qué puede pasar y cómo seguir: la lista de su sección, si la ruta es de una, y el
// inicio. la sección se ofrece aunque la cuenta no la tenga: su guarda lo dice al llegar
export function NoEncontrada() {
  const { t } = useTranslation(NS)
  const clave = seccionDeRuta(useLocation().pathname)
  const seccion = clave && clave !== 'dashboard' ? NAV_TREE.find((s) => s.clave === clave && !s.external) : undefined
  return (
    <Vacio titulo={t('noEncontrada')}>
      <p>{t('noEncontradaAyuda')}</p>
      <p className="mt-3 flex flex-wrap justify-center gap-4">
        {seccion ? (
          <Link to={seccion.to} className="font-medium text-sg-primary-text underline">
            {t('irA', { seccion: t(`secciones.${seccion.clave}`) })}
          </Link>
        ) : null}
        <Link to="/" className="font-medium text-sg-primary-text underline">
          {t('irAlInicio')}
        </Link>
      </p>
    </Vacio>
  )
}
