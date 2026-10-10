import { automationModule } from '@wasichai/automation'
import { WasichaiApp, type WasichaiConfig } from '@wasichai/core'
import { documentsModule } from '@wasichai/documents'
import { formsModule } from '@wasichai/forms'
import { gisModule } from '@wasichai/gis'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { workflowModule } from '@wasichai/workflow'
import { idiomaHtmlModule } from '../idiomaHtml'
import { ZONA_DE_LIMA } from '../portal/datos/fechas'

// la configuración de /admin. storagePrefix 'sgspe' es el del portal: un solo login, el mismo tema y el mismo idioma, y
// <html lang> sigue al idioma (idiomaHtmlModule: core lo escribe como `es`). timeZone: los DATETIME de los formularios de
// registro (DynamicForm) se leen y se escriben en la hora de Lima, sea cual sea el huso del navegador (core 0.6.0). el
// administrador sembrado se propone solo en desarrollo
export const configDeAdministracion: WasichaiConfig = {
  apiBaseUrl: '/api',
  appName: 'SGSPE',
  appTagline: 'Administración',
  storagePrefix: 'sgspe',
  basename: '/admin',
  languages: ['es', 'en'],
  timeZone: ZONA_DE_LIMA,
  defaultLoginEmail: import.meta.env.DEV ? 'admin@wasichai.local' : ''
}

// /admin: core más los módulos de los starters que corre sgspe (views, forms y pages desde F1; gis y workflow desde
// F2; documents y automation desde F3, con la página imprimible de un documento emitido en /admin/documents/:id/print);
// nunca un módulo sin su starter ni agentModule() (ADR-0024). gis recibe el worker de MapLibre que fija main.tsx
export function AdminApp({ trabajadorDelMapa }: { trabajadorDelMapa?: string } = {}) {
  return (
    <WasichaiApp
      config={configDeAdministracion}
      modules={[
        viewsModule(),
        formsModule(),
        pagesModule(),
        workflowModule(),
        gisModule({ workerUrl: trabajadorDelMapa }),
        documentsModule(),
        automationModule(),
        idiomaHtmlModule()
      ]}
    />
  )
}
