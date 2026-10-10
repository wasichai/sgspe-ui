import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { CLASE_DE_TONO, type Tono } from '../componentes/apariencias'
import { RegistrosSimples } from '../componentes/RegistrosSimples'
import { texto, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'

// S58 · menciones en medios (screens.md §9): lo que dicen los medios del proyecto, registrado a mano con su tono, para KPI-ENG-07 y
// 08 y la regla MENCIONES NEGATIVAS de JOB-04. el enlace se muestra como texto con su dominio y se abre en otra pestaña: ni el
// portal ni el servidor lo descargan (ASM-050). la mención abierta vive en la ruta (/risks/mentions/:mentionId)
const CAMPOS = ['outlet_name', 'outlet', 'published_date', 'headline', 'summary', 'url', 'topic', 'tone', 'reports_fulfilled_commitment', 'commitment']

const TONO: Record<string, Tono> = { POSITIVO: 'success', NEGATIVO: 'danger', NEUTRO: 'neutral' }

export function TonoDeMencion({ valor }: { valor: unknown }) {
  const { t } = useTranslation(NS)
  if (typeof valor !== 'string' || !valor) return <>—</>
  return (
    <span
      aria-label={`${t('registrosDeAlerta.menciones.tono')}: ${valor}`}
      className={cn('rounded-sg-sm px-2 py-0.5 text-sg-caption font-medium', CLASE_DE_TONO[TONO[valor] ?? 'neutral'])}
    >
      {valor}
    </span>
  )
}

// el enlace de una mención: solo http o https, con su dominio a la vista; lo demás se dice como texto, sin enlace
export function EnlaceDeMencion({ url }: { url: unknown }) {
  const { t } = useTranslation(NS)
  if (typeof url !== 'string' || !url) return <>—</>
  let dominio: string | null = null
  try {
    const u = new URL(url)
    dominio = u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null
  } catch {
    dominio = null
  }
  if (!dominio) return <span className="break-all text-sg-text-muted">{url}</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-sg-primary-text underline">
      {dominio}
      <span className="sr-only"> {t('registrosDeAlerta.menciones.otraPestana')}</span>
    </a>
  )
}

export function MencionesPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', mentionId } = useParams()
  const navegar = useNavigate()
  const base = `/projects/${encodeURIComponent(projectId)}/risks/mentions`
  const columnas = [
    { id: 'titular', encabezado: t('registrosDeAlerta.menciones.columnas.titular'), celda: (r: Registro) => texto(r, 'headline') },
    {
      id: 'fecha',
      encabezado: t('registrosDeAlerta.menciones.columnas.fecha'),
      celda: (r: Registro) => (texto(r, 'published_date') ? diaPe(texto(r, 'published_date')) : '—')
    },
    { id: 'medio', encabezado: t('registrosDeAlerta.menciones.columnas.medio'), celda: (r: Registro) => texto(r, 'outlet_name') || '—' },
    { id: 'tono', encabezado: t('registrosDeAlerta.menciones.columnas.tono'), celda: (r: Registro) => <TonoDeMencion valor={r.attributes.tone} /> },
    { id: 'enlace', encabezado: t('registrosDeAlerta.menciones.columnas.enlace'), celda: (r: Registro) => <EnlaceDeMencion url={r.attributes.url} /> }
  ]
  return (
    <section className="mx-auto max-w-[1200px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('registrosDeAlerta.menciones.titulo')}</h1>
      <p className="text-sm text-sg-text-secondary">{t('registrosDeAlerta.menciones.ayuda')}</p>
      <RegistrosSimples
        objeto="media_mention"
        titulo={t('registrosDeAlerta.menciones.lista')}
        filtros={{ project: projectId, sort: 'published_date', dir: 'desc' }}
        fijos={{ project: projectId }}
        columnas={columnas}
        campos={CAMPOS}
        proyecto={projectId}
        abierto={mentionId ?? null}
        alAbrir={(id) => navegar(id ? `${base}/${encodeURIComponent(id)}` : base)}
        textoNuevo={t('registrosDeAlerta.menciones.nueva')}
        textoVacio={t('registrosDeAlerta.menciones.vacio')}
        ayuda={<p className="text-sg-caption text-sg-text-muted">{t('registrosDeAlerta.menciones.enlaceAyuda')}</p>}
      />
    </section>
  )
}
