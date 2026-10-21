import { Button } from '@wasichai/ui'
import { Lock } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NS } from '../i18n'

export interface PropsDeEstadoSinAcceso {
  // el nombre de la sección o de la pantalla, como lo dice la navegación
  que: string
  // a quién pedir el acceso, si se conoce (la jefatura del proyecto); sin él, la administración de la organización
  aQuien: string | null
  // la salida: a dónde vuelve y con qué texto
  volver: { etiqueta: string; a: string }
}

// quien llega por la URL a lo que su cuenta no puede abrir (hallazgo U-09, DD-12): un bloque en lugar de una línea de
// advertencia, con qué no puede abrir, por qué en lenguaje llano (el acceso se da por permisos; nunca se nombra un rol ni un
// permiso técnico), a quién pedirlo y la salida. ocupa el lugar de la pantalla, así que su título es el h1. la salida es lo
// único enfocable del bloque, de modo que es lo primero que alcanza el teclado
export function EstadoSinAcceso({ que, aQuien, volver }: PropsDeEstadoSinAcceso) {
  const { t } = useTranslation(NS)
  const titulo = useId()
  return (
    <section aria-labelledby={titulo} className="mx-auto max-w-xl rounded-sg-lg border border-sg-border bg-sg-surface p-6 shadow-sg-sm">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sg-md bg-sg-surface-sunken text-sg-text-muted">
          <Lock aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 space-y-2">
          <h1 id={titulo} className="text-sg-h2 font-semibold text-sg-text">
            {t('comun.sinAcceso.titulo', { que })}
          </h1>
          <p className="text-sm text-sg-text-secondary">{t('comun.sinAcceso.explicacion')}</p>
          <p className="text-sm text-sg-text-secondary">{t('comun.sinAcceso.aQuien', { aQuien: aQuien ?? t('comun.sinAcceso.administracion') })}</p>
          <div className="pt-2">
            <Button asChild variant="secondary">
              <Link to={volver.a}>{volver.etiqueta}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
