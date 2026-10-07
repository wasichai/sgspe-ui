import { useAuth, useWasichaiConfig } from '@wasichai/core'
import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { NS } from '../i18n'
import { ThemeMenu } from './ThemeMenu'

// el marco del portal: cabecera con la marca, la cuenta y la salida; debajo, el contenido
export function AppShell() {
  const { t } = useTranslation(NS)
  const { appName } = useWasichaiConfig()
  const { user, signOut } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
        <span className="text-sm font-bold text-brand">{appName}</span>
        <div className="flex-1" />
        <ThemeMenu />
        <span className="text-sm text-ink">{user?.displayName}</span>
        <button type="button" onClick={signOut} aria-label={t('shell.salir')} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink">
          <LogOut className="size-4" />
        </button>
      </header>
      <main id="content" className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <Outlet />
      </main>
    </div>
  )
}
