import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './admin/AdminApp'
import { PortalApp } from './portal/PortalApp'
import './index.css'

// dos apps, un bundle: /admin es la administración de wasichai; lo demás, el portal (ADR-0024)
const admin = /^\/admin(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminApp /> : <PortalApp />}</StrictMode>)
