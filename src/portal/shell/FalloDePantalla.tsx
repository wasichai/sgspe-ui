import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useRouteError } from 'react-router'
import { correlacionDe } from '../componentes/errores'
import { NS } from '../i18n'

// el errorElement de las rutas (D1 de la revisión de UX, design-system.md §6.5): un error de render dice en lenguaje del
// dominio que la pantalla no se pudo mostrar, con el código para soporte si vino de la API y «Volver al inicio». nunca la
// pila ni el mensaje técnico. dentro del shell, la barra lateral y la superior siguen; en la raíz (el shell mismo falló),
// queda solo el aviso
export function FalloDePantalla() {
  const { t } = useTranslation(NS)
  const correlacion = correlacionDe(useRouteError())
  return (
    <div className="mx-auto max-w-xl p-4">
      <Alert tone="danger" title={t('paginas.fallo.titulo')}>
        <p>{t('paginas.fallo.texto')}</p>
        {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
        <p className="mt-2 flex flex-wrap gap-4">
          <Link to="/" className="text-sg-primary-text underline">
            {t('paginas.fallo.volver')}
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="text-sg-primary-text underline">
            {t('paginas.fallo.recargar')}
          </button>
        </p>
      </Alert>
    </div>
  )
}
