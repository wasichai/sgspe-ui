import { WasichaiApp } from '@wasichai/core'
import { formsModule } from '@wasichai/forms'
import { pagesModule } from '@wasichai/pages'
import { viewsModule } from '@wasichai/views'
import { idiomaHtmlModule } from '../idiomaHtml'

// /admin: core más los módulos de los starters que corre sgspe en F1 (views, forms y pages); nunca un módulo sin su
// starter ni agentModule() (ADR-0024). storagePrefix 'sgspe' es el del portal: un solo login, el mismo tema y el mismo
// idioma, y <html lang> sigue al idioma (idiomaHtmlModule: core no lo hace). el administrador sembrado se propone solo en
// desarrollo
export function AdminApp() {
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
      modules={[viewsModule(), formsModule(), pagesModule(), idiomaHtmlModule()]}
    />
  )
}
