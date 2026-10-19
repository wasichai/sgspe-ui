import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { RegistrosSimples } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { atributo, texto, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { opcion } from '../datos/opciones'

// S59 · señales de alerta (screens.md §9): lo que puede anticipar un conflicto, registrado a mano con su fuente, para que una
// persona lo lleve a una alerta (la vincula desde S41) o la regla CONTEO DE SEÑALES de JOB-04 lo cuente. una señal sin alerta lo
// dice; el texto no lleva nombres de personas (RQ-SEC-010). los vínculos son del mismo proyecto (409 PROJECT_MISMATCH)
const CAMPOS = ['source_type', 'received_at', 'description', 'reported_via', 'locality', 'community', 'media_mention', 'incident']
const LARGO = 80

const resumen = (valor: string) => (valor.length > LARGO ? `${valor.slice(0, LARGO)}…` : valor)

export function SenalesPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', signalId } = useParams()
  const navegar = useNavigate()
  const base = `/projects/${encodeURIComponent(projectId)}/risks/signals`
  const columnas = [
    { id: 'descripcion', encabezado: t('registrosDeAlerta.senales.columnas.descripcion'), celda: (r: Registro) => resumen(texto(r, 'description')) || '—' },
    {
      id: 'recibida',
      encabezado: t('registrosDeAlerta.senales.columnas.recibida'),
      celda: (r: Registro) => (texto(r, 'received_at') ? fechaYHoraPe(new Date(texto(r, 'received_at'))) : '—')
    },
    { id: 'fuente', encabezado: t('registrosDeAlerta.senales.columnas.fuente'), celda: (r: Registro) => opcion(r, 'source_type') || '—' },
    {
      id: 'alerta',
      encabezado: t('registrosDeAlerta.senales.columnas.alerta'),
      celda: (r: Registro) =>
        atributo<string>(r, 'early_warning') ? (
          <RegistroVinculado objeto="early_warning" id={atributo<string>(r, 'early_warning')} />
        ) : (
          <span className="text-sg-text-muted">{t('registrosDeAlerta.senales.sinAlerta')}</span>
        )
    }
  ]
  return (
    <section className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('registrosDeAlerta.senales.titulo')}</h1>
      <p className="text-sm text-sg-text-secondary">{t('registrosDeAlerta.senales.ayuda')}</p>
      <RegistrosSimples
        objeto="early_warning_signal"
        titulo={t('registrosDeAlerta.senales.lista')}
        filtros={{ project: projectId, sort: 'received_at', dir: 'desc' }}
        fijos={{ project: projectId }}
        columnas={columnas}
        campos={CAMPOS}
        proyecto={projectId}
        abierto={signalId ?? null}
        alAbrir={(id) => navegar(id ? `${base}/${encodeURIComponent(id)}` : base)}
        textoNuevo={t('registrosDeAlerta.senales.nueva')}
        textoVacio={t('registrosDeAlerta.senales.vacio')}
        ayuda={<p className="text-sg-caption text-sg-text-muted">{t('registrosDeAlerta.senales.sinNombres')}</p>}
      />
    </section>
  )
}
