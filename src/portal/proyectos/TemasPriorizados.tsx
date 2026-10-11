import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Cargando, esIlegible } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { usePedir } from '../datos/http'
import { texto, useRelacionados } from '../datos/registros'
import { NS } from '../i18n'

// los temas priorizados del proyecto para sus aportes (RF-INV-002, spec F5 §3.1 y decisión 3): el vínculo MANY_TO_MANY
// project_priority_topic. un aporte cumple la prioridad si su tema es uno de estos o desciende de uno; sin temas, la prioridad no se
// evalúa (PRIORITIES_NOT_CONFIGURED). topic es un maestro del tenant: no hay regla «mismo proyecto». un tenant sin el modelo de F5 no
// tiene el vínculo (404): la sección no se dibuja
const RELACION = 'project_priority_topic'

export function TemasPriorizados({ proyecto, editable }: { proyecto: string; editable: boolean }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const releer = useReleer()
  const temas = useRelacionados('project', proyecto, RELACION)
  const ruta = `/objects/project/records/${encodeURIComponent(proyecto)}/related/${RELACION}`
  const alTerminar = () => void cliente.invalidateQueries({ queryKey: ['related', 'project', proyecto, RELACION] })
  const vincular = useMutation({ mutationFn: (tema: string) => pedir(ruta, { json: { otherId: tema } }), onSuccess: alTerminar })
  const quitar = useMutation({ mutationFn: (tema: string) => pedir(`${ruta}/${encodeURIComponent(tema)}`, { metodo: 'DELETE' }), onSuccess: alTerminar })
  if (temas.isError && !temas.data && esIlegible(temas.error)) return null
  const lista = temas.data?.content ?? []
  const error = vincular.error ?? quitar.error
  return (
    <section aria-label={t('p360.temas.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border p-4">
      <h3 className="font-medium">{t('p360.temas.titulo')}</h3>
      <p className="text-sg-caption text-sg-text-muted">{t('p360.temas.ayuda')}</p>
      {temas.isPending ? (
        <Cargando compacto />
      ) : temas.isError && !temas.data ? (
        <FalloDeLectura error={temas.error} alReintentar={() => void temas.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-sm text-sg-warning">{t('p360.temas.vacio')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {lista.map((tema) => (
            <li key={tema.id} className="flex items-center justify-between gap-2">
              <span>{texto(tema, 'name')}</span>
              {editable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('p360.temas.quitarDe', { tema: texto(tema, 'name') })}
                  disabled={quitar.isPending}
                  onClick={() => quitar.mutate(tema.id)}
                >
                  {t('comun.quitar')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <BuscadorDeRegistro
          objeto="topic"
          etiqueta={t('p360.temas.agregar')}
          rotulo={(r) => texto(r, 'name')}
          alElegir={(r) => {
            if (!lista.some((x) => x.id === r.id)) vincular.mutate(r.id)
          }}
        />
      ) : null}
      {error ? (
        <AvisoDeConflicto
          error={error}
          releer={() => releer(['related', 'project', proyecto, RELACION])}
          alRecargar={() => {
            vincular.reset()
            quitar.reset()
          }}
        />
      ) : null}
    </section>
  )
}
