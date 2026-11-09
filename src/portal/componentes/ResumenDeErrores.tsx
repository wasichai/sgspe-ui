import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el resumen de errores de design-system.md §5.3 y §3.8: arriba del formulario al enviar con más de un error, con un borde de
// 3 px danger, su título («Hay 3 problemas por corregir») y un enlace a cada campo con su error; pulsarlo lleva el foco al campo.
// recibe el foco al aparecer (y cada vez que cambia la lista de errores), y es un alert: el lector de pantalla lo dice. con un
// solo error no se dibuja: basta el error junto a su campo. un error sin control a la vista (una relación fija) va sin enlace
export interface ErrorDelResumen {
  // el id del control al que lleva el enlace
  id?: string
  // el texto, ya con el rótulo de su campo («Nueva fecha: Debe ser posterior a hoy»)
  texto: string
}

export function ResumenDeErrores({ errores }: { errores: readonly ErrorDelResumen[] }) {
  const { t } = useTranslation(NS)
  const tituloId = useId()
  const caja = useRef<HTMLDivElement>(null)
  const varios = errores.length > 1
  // la lista como texto: el foco vuelve al resumen solo si los errores cambiaron, no en cada dibujo
  const firma = errores.map((e) => `${e.id ?? ''}\u0000${e.texto}`).join('\u0001')
  useEffect(() => {
    if (varios) caja.current?.focus()
  }, [varios, firma])
  if (!varios) return null
  return (
    <div
      ref={caja}
      role="alert"
      aria-labelledby={tituloId}
      tabIndex={-1}
      className="flex flex-col gap-2 rounded-sg-md border-3 border-sg-danger bg-sg-surface px-5 py-4 text-sg-body text-sg-text"
    >
      <h2 id={tituloId} className="text-sg-h3 font-bold">
        {t('comun.resumenDeErrores.titulo', { count: errores.length })}
      </h2>
      <ul className="list-disc space-y-1 pl-5 marker:text-sg-danger">
        {errores.map((e, i) => (
          <li key={`${e.id ?? ''}-${i}`}>
            {e.id ? (
              <a
                href={`#${e.id}`}
                className="font-bold text-sg-danger underline underline-offset-2"
                onClick={(evento) => {
                  // el enlace no cambia el hash de la ruta: lleva el foco al control, que el navegador desplaza a la vista
                  const control = document.getElementById(e.id!)
                  if (!control) return
                  evento.preventDefault()
                  control.focus()
                }}
              >
                {e.texto}
              </a>
            ) : (
              <span className="font-bold text-sg-danger">{e.texto}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
