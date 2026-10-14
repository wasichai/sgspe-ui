import { Alert, Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { NS } from '../i18n'
import type { MotivoSinIa } from './contrato'

// la IA no disponible (design-system.md §6.5): por organización, por proveedor (con «Reintentar»), por rol (y, en los
// documentos, por no leer los nombres de las personas) o por un servidor sin F7
export function AvisoDeIa({ motivo, documentos = false, alReintentar }: { motivo: MotivoSinIa; documentos?: boolean; alReintentar?: () => void }) {
  const { t } = useTranslation(NS)
  if (motivo === 'cargando') return <Cargando compacto />
  const texto = motivo === 'rol' && documentos ? `${t('ia.sinIa.rol')} ${t('ia.sinIa.rolDocumentos')}` : t(`ia.sinIa.${motivo}`)
  return (
    <Alert tone={motivo === 'proveedor' ? 'warning' : 'notice'}>
      <p>{texto}</p>
      {motivo === 'proveedor' && alReintentar ? (
        <Button size="sm" variant="secondary" className="mt-2" onClick={alReintentar}>
          {t('ia.sinIa.reintentar')}
        </Button>
      ) : null}
    </Alert>
  )
}
