import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RegistrosSimples, type ColumnaSimple } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { hoyEnLima } from '../datos/fechas'
import { atributo, texto, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'

// las iniciativas, los hitos y los grupos beneficiarios de un programa (screens.md S43, spec F5 §3.6): listas con su formulario
// (RegistrosSimples) para su dueño (SOCIAL_INVESTMENT_MANAGER, elección 15) y en solo lectura para los demás. el grupo de una
// iniciativa de otro programa lo rechaza el servidor (409 PROGRAM_MISMATCH, con su texto); una iniciativa con grupos no se borra

// un hito: alcanzado si tiene fecha alcanzada; atrasado si su fecha prevista es anterior a hoy en Lima; si no, previsto. F5 no mide
// hitos (JOB-01 no los escala, spec §1): lo marca el portal
export function situacionDeHito(hito: Registro, hoy: string = hoyEnLima()): 'alcanzado' | 'atrasado' | 'previsto' | 'sinFecha' {
  if (texto(hito, 'reached_date')) return 'alcanzado'
  const prevista = texto(hito, 'planned_date')
  if (!prevista) return 'sinFecha'
  return prevista < hoy ? 'atrasado' : 'previsto'
}

const dia = (r: Registro, campo: string) => (texto(r, campo) ? diaPe(texto(r, campo)) : '—')

export function IniciativasEHitos({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const filtros = useMemo(() => ({ social_program: programa.id }), [programa.id])
  const proyecto = texto(programa, 'project')
  const iniciativas: ColumnaSimple[] = [
    { id: 'nombre', encabezado: t('fichaPrograma.iniciativas.columnas.nombre'), celda: (r) => texto(r, 'name') },
    {
      id: 'localidad',
      encabezado: t('fichaPrograma.iniciativas.columnas.localidad'),
      celda: (r) => (texto(r, 'locality') ? <RegistroVinculado objeto="locality" id={texto(r, 'locality')} /> : '—')
    },
    {
      id: 'contraparte',
      encabezado: t('fichaPrograma.iniciativas.columnas.contraparte'),
      celda: (r) => (texto(r, 'counterpart_organization') ? <RegistroVinculado objeto="organization" id={texto(r, 'counterpart_organization')} /> : '—')
    },
    { id: 'inicio', encabezado: t('fichaPrograma.iniciativas.columnas.inicio'), celda: (r) => dia(r, 'start_date') },
    { id: 'fin', encabezado: t('fichaPrograma.iniciativas.columnas.fin'), celda: (r) => dia(r, 'end_date') }
  ]
  const hitos: ColumnaSimple[] = [
    { id: 'nombre', encabezado: t('fichaPrograma.hitos.columnas.nombre'), celda: (r) => texto(r, 'name') },
    { id: 'prevista', encabezado: t('fichaPrograma.hitos.columnas.prevista'), celda: (r) => dia(r, 'planned_date') },
    { id: 'alcanzada', encabezado: t('fichaPrograma.hitos.columnas.alcanzada'), celda: (r) => dia(r, 'reached_date') },
    {
      id: 'situacion',
      encabezado: t('fichaPrograma.hitos.columnas.situacion'),
      celda: (r) => {
        const situacion = situacionDeHito(r)
        return <span className={situacion === 'atrasado' ? 'text-sg-warning' : undefined}>{t(`fichaPrograma.hitos.situaciones.${situacion}`)}</span>
      }
    }
  ]
  return (
    <div className="space-y-6 pt-3 text-sm">
      <RegistrosSimples
        objeto="social_initiative"
        titulo={t('fichaPrograma.iniciativas.titulo')}
        filtros={filtros}
        fijos={filtros}
        columnas={iniciativas}
        campos={['name', 'description', 'locality', 'community', 'counterpart_organization', 'start_date', 'end_date']}
        proyecto={proyecto}
        textoNuevo={t('fichaPrograma.iniciativas.nuevo')}
        textoVacio={t('fichaPrograma.iniciativas.vacio')}
      />
      <RegistrosSimples
        objeto="program_milestone"
        titulo={t('fichaPrograma.hitos.titulo')}
        filtros={filtros}
        fijos={filtros}
        columnas={hitos}
        campos={['name', 'planned_date', 'reached_date', 'notes']}
        proyecto={proyecto}
        textoNuevo={t('fichaPrograma.hitos.nuevo')}
        textoVacio={t('fichaPrograma.hitos.vacio')}
      />
    </div>
  )
}

// los grupos beneficiarios con su meta y sus alcanzados (KPI-INV-04 por programa); la suma es de enteros y sin un conteo que no vino
export function Beneficiarios({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const filtros = useMemo(() => ({ social_program: programa.id }), [programa.id])
  const grupos = useTodosConTope('beneficiary_group', filtros)
  const suma = (campo: string) =>
    (grupos.data ?? [])
      .map((g) => atributo<number>(g, campo))
      .filter((n): n is number => typeof n === 'number')
      .reduce((s, n) => s + n, 0)
  const conteo = (r: Registro, campo: string) => (typeof atributo(r, campo) === 'number' ? numeroPe(atributo<number>(r, campo) as number) : '—')
  const columnas: ColumnaSimple[] = [
    { id: 'nombre', encabezado: t('fichaPrograma.beneficiarios.columnas.nombre'), celda: (r) => texto(r, 'name') },
    {
      id: 'iniciativa',
      encabezado: t('fichaPrograma.beneficiarios.columnas.iniciativa'),
      celda: (r) => (texto(r, 'social_initiative') ? <RegistroVinculado objeto="social_initiative" id={texto(r, 'social_initiative')} /> : '—')
    },
    {
      id: 'localidad',
      encabezado: t('fichaPrograma.beneficiarios.columnas.localidad'),
      celda: (r) => (texto(r, 'locality') ? <RegistroVinculado objeto="locality" id={texto(r, 'locality')} /> : '—')
    },
    { id: 'meta', encabezado: t('fichaPrograma.beneficiarios.columnas.meta'), celda: (r) => conteo(r, 'target_count') },
    { id: 'alcanzados', encabezado: t('fichaPrograma.beneficiarios.columnas.alcanzados'), celda: (r) => conteo(r, 'reached_count') }
  ]
  return (
    <div className="space-y-3 pt-3 text-sm">
      <RegistrosSimples
        objeto="beneficiary_group"
        titulo={t('fichaPrograma.beneficiarios.titulo')}
        filtros={filtros}
        fijos={filtros}
        columnas={columnas}
        campos={['name', 'description', 'social_initiative', 'locality', 'target_count', 'reached_count']}
        proyecto={texto(programa, 'project')}
        textoNuevo={t('fichaPrograma.beneficiarios.nuevo')}
        textoVacio={t('fichaPrograma.beneficiarios.vacio')}
      />
      {grupos.data && grupos.data.length > 0 ? (
        <p className="font-medium">
          {t('fichaPrograma.beneficiarios.totales', { alcanzados: numeroPe(suma('reached_count')), meta: numeroPe(suma('target_count')) })}
        </p>
      ) : null}
    </div>
  )
}
