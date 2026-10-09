import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { esConflictoDeVersion, useMensajeDeError, type MensajesPropios } from './errores'

// la salida de un 412 (screens.md §2, Review Focus 1): «Recargar» relee el registro y conserva lo escrito. el aviso se quita
// solo cuando la relectura llegó (alRecargar, que suele ser el reset de la mutación): antes, un segundo clic mandaría la
// versión vieja y volvería el 412. si la relectura falla, lo dice junto al botón y lo escrito sigue donde estaba

// relee las consultas de esas claves y espera a que lleguen; si una falla, lanza (la consulta conserva sus datos, así que
// Consulta no desmonta lo que hay debajo)
export function useReleer(): (...claves: QueryKey[]) => Promise<void> {
  const cliente = useQueryClient()
  return async (...claves) => {
    await Promise.all(claves.map((queryKey) => cliente.invalidateQueries({ queryKey }, { throwOnError: true })))
  }
}

export function BotonRecargar({ releer, alRecargar, className = 'ml-2' }: { releer: () => Promise<unknown>; alRecargar: () => void; className?: string }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const [recargando, setRecargando] = useState(false)
  const [fallo, setFallo] = useState<unknown>(null)
  const recargar = async () => {
    setRecargando(true)
    setFallo(null)
    try {
      await releer()
      alRecargar()
    } catch (error) {
      setFallo(error)
    } finally {
      setRecargando(false)
    }
  }
  return (
    <>
      <Button type="button" variant="secondary" size="sm" className={className} disabled={recargando} aria-busy={recargando} onClick={() => void recargar()}>
        {t('comun.recargar')}
      </Button>
      {fallo ? (
        <span className="mt-1 block">
          {t('comun.recargaFallida')} {mensaje(fallo)}
        </span>
      ) : null}
    </>
  )
}

// el aviso de una escritura fallida: su texto (con los propios de la pantalla) y, si fue un 412, «Recargar». children va al
// final, para la acción que la pantalla ofrece ante otro error
export function AvisoDeConflicto({
  error,
  propios,
  texto,
  prefijo,
  releer,
  alRecargar,
  children
}: {
  error: unknown
  propios?: MensajesPropios
  // el texto ya armado, si la pantalla lo arma (los errores de campo con su etiqueta); sin él, el de useMensajeDeError
  texto?: string
  // lo que va antes del texto, por ejemplo a qué registro se refiere
  prefijo?: ReactNode
  releer: () => Promise<unknown>
  alRecargar: () => void
  children?: ReactNode
}) {
  const mensaje = useMensajeDeError()
  return (
    <Alert tone="danger">
      {prefijo}
      {texto ?? mensaje(error, propios)}
      {esConflictoDeVersion(error) ? <BotonRecargar releer={releer} alRecargar={alRecargar} /> : null}
      {children}
    </Alert>
  )
}
