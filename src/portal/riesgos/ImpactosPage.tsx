import { useMemo } from 'react'
import { PaginasDeRiesgos } from './PaginasDeRiesgos'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { atributo, texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// S61 · impactos potenciales (screens.md §9): qué actividad puede causar qué impacto, de qué tipo, naturaleza y signo, y a qué
// riesgo alimenta. la lista del proyecto (/risks/impacts) y el panel «Impactos» de la ficha de riesgo (S40), que fija el riesgo.
// un impacto sin riesgo lo dice; el riesgo es del mismo proyecto (409 PROJECT_MISMATCH)
const CAMPOS = ['activity_type', 'description', 'impact_type', 'impact_nature', 'impact_sign', 'social_risk']

export function Impactos({ proyecto, riesgo }: { proyecto: string; riesgo?: string }) {
  const { t } = useTranslation(NS)
  const fijos = useMemo(() => (riesgo ? { project: proyecto, social_risk: riesgo } : { project: proyecto }), [proyecto, riesgo])
  const valor = (campo: string) => (r: Registro) => texto(r, campo) || '—'
  const columnas: ColumnaSimple[] = [
    { id: 'descripcion', encabezado: t('registrosDeAlerta.impactos.columnas.descripcion'), celda: valor('description') },
    { id: 'actividad', encabezado: t('registrosDeAlerta.impactos.columnas.actividad'), celda: valor('activity_type') },
    { id: 'tipo', encabezado: t('registrosDeAlerta.impactos.columnas.tipo'), celda: valor('impact_type') },
    { id: 'naturaleza', encabezado: t('registrosDeAlerta.impactos.columnas.naturaleza'), celda: valor('impact_nature') },
    { id: 'signo', encabezado: t('registrosDeAlerta.impactos.columnas.signo'), celda: valor('impact_sign') },
    ...(riesgo
      ? []
      : [
          {
            id: 'riesgo',
            encabezado: t('registrosDeAlerta.impactos.columnas.riesgo'),
            celda: (r: Registro) =>
              atributo<string>(r, 'social_risk') ? (
                <RegistroVinculado objeto="social_risk" id={atributo<string>(r, 'social_risk')} />
              ) : (
                <span className="text-sg-text-muted">{t('registrosDeAlerta.impactos.sinRiesgo')}</span>
              )
          }
        ])
  ]
  return (
    <RegistrosSimples
      objeto="potential_impact"
      titulo={t('registrosDeAlerta.impactos.lista')}
      filtros={riesgo ? { project: proyecto, social_risk: riesgo } : { project: proyecto }}
      fijos={fijos}
      columnas={columnas}
      campos={riesgo ? CAMPOS.filter((c) => c !== 'social_risk') : CAMPOS}
      proyecto={proyecto}
      textoNuevo={t('registrosDeAlerta.impactos.nuevo')}
      textoVacio={t('registrosDeAlerta.impactos.vacio')}
      // la búsqueda es de la página de impactos; en la ficha de un riesgo la lista es corta
      busqueda={
        riesgo ? undefined : { etiqueta: t('registrosDeAlerta.impactos.buscar'), texto: (r) => `${texto(r, 'description')} ${texto(r, 'activity_type')}` }
      }
    />
  )
}

export function ImpactosPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  return (
    <section className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('registrosDeAlerta.impactos.titulo')}</h1>
        <PaginasDeRiesgos actual="impacts" />
      </div>
      <p className="text-sm text-sg-text-secondary">{t('registrosDeAlerta.impactos.ayuda')}</p>
      <Impactos proyecto={projectId} />
    </section>
  )
}
