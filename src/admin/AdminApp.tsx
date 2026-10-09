import { WasichaiApp } from '@wasichai/core'
import { formsModule } from '@wasichai/forms'
import { gisModule } from '@wasichai/gis'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { workflowModule } from '@wasichai/workflow'
import { idiomaHtmlModule } from '../idiomaHtml'

// /admin: core más los módulos de los starters que corre sgspe (views, forms y pages desde F1; gis y workflow desde
// F2); nunca un módulo sin su starter ni agentModule() (ADR-0024). gis recibe el worker de MapLibre que fija main.tsx.
// storagePrefix 'sgspe' es el del portal: un solo login, el mismo tema y el mismo idioma, y <html lang> sigue al idioma
// (idiomaHtmlModule: core 0.5.1 lo escribe como `es`). el administrador sembrado se propone solo en desarrollo
export function AdminApp({ trabajadorDelMapa }: { trabajadorDelMapa?: string } = {}) {
  return (
    <WasichaiApp
      config={{
        apiBaseUrl: '/api',
        appName: 'SGSPE',
        appTagline: 'Administración',
        storagePrefix: 'sgspe',
        basename: '/admin',
        languages: ['es', 'en'],
        defaultLoginEmail: import.meta.env.DEV ? 'admin@wasichai.local' : ''
      }}
      modules={[viewsModule(), formsModule(), pagesModule(), workflowModule(), gisModule({ workerUrl: trabajadorDelMapa }), idiomaHtmlModule()]}
    />
  )
}
