import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
// ?worker&url empaqueta el worker de MapLibre con su parte compartida en un solo archivo, sin traer MapLibre a este chunk:
// el mapa baja con el primer mapa (el del portal o el de gis en /admin), como en srtm-ui
import trabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { fijarTrabajadorDelMapa } from './portal/mapa/trabajador'
import './index.css'

// dos apps, un bundle (ADR-0024): /admin es la administración de wasichai; lo demás, el portal. cada una baja en su
// propio chunk, así el portal no carga la consola ni la consola el portal (pendiente de F1, antes de MapLibre y ECharts)
const admin = /^\/admin(\/|$)/.test(window.location.pathname)
fijarTrabajadorDelMapa(trabajador)

const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))
const PortalApp = lazy(() => import('./portal/PortalApp').then((m) => ({ default: m.PortalApp })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{admin ? <AdminApp trabajadorDelMapa={trabajador} /> : <PortalApp />}</Suspense>
  </StrictMode>
)
