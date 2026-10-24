import { useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { Ejecutado } from './PestanaEntregas'
import { Seccion } from '../componentes/Seccion'

// el panel del verificador de S32 (?drawer=verify, flujo 11): lo entregado frente a lo comprometido, cuántas entregas tienen
// conformidad y las dos salidas, «Verificar» (D11: VERIFY y no ser el responsable, comprobado antes con transition-checks) y
// «Devolver a ejecución». quien es responsable lo lee con el aviso de segregación; el servidor lo aplica igual (D11)
export function Verificacion({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const entregas = useTodos('delivery', { commitment: compromiso.id })
  const responsable = atributo(compromiso, 'owner_user_id') === user?.id
  const conConformidad = (entregas.data ?? []).filter((e) => atributo(e, 'conformity_given') === true).length
  return (
    <Seccion titulo={t('entregas.verificacion.titulo')} className="space-y-3 text-sm">
      <p className="text-sg-text-secondary">{t('entregas.verificacion.ayuda')}</p>
      <h3 className="font-medium">{t('entregas.verificacion.ejecutado')}</h3>
      <Ejecutado compromiso={compromiso} />
      {entregas.isPending ? (
        <Cargando compacto />
      ) : entregas.isError && !entregas.data ? (
        <FalloDeLectura error={entregas.error} alReintentar={() => void entregas.refetch()} />
      ) : (
        <p>{t('entregas.verificacion.conConformidad', { n: conConformidad, total: entregas.data.length })}</p>
      )}
      <p className="text-sg-caption text-sg-text-muted">{t('entregas.verificacion.revisar')}</p>
      {responsable ? <Alert tone="notice">{t('entregas.verificacion.segregacion')}</Alert> : null}
      <BotonesDeTransicion
        objeto="commitment"
        registro={compromiso}
        proyecto={texto(compromiso, 'project')}
        solo={['verify', 'reopen_execution']}
        comprobarAntes={['verify']}
      />
    </Seccion>
  )
}
