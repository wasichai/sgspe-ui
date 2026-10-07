import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './admin/AdminApp'
import './index.css'

// dos apps, un bundle: /admin es la administración de wasichai; lo demás, el portal
const admin = /^\/admin(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById('root')!).render(<StrictMode>{admin ? <AdminApp /> : <p>SGSPE</p>}</StrictMode>)
