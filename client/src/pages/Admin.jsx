import { useState } from 'react'
import Icon from '../icons'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { cn } from '../utils'
import OverviewTab from './admin/OverviewTab'
import BeatsTab from './admin/BeatsTab'
import VideosTab from './admin/VideosTab'
import OrdersTab from './admin/OrdersTab'
import MessagesTab from './admin/MessagesTab'
import MailboxTab from './admin/MailboxTab'
import SettingsTab from './admin/SettingsTab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'zap' },
  { id: 'beats', label: 'Beats', icon: 'music' },
  { id: 'videos', label: 'Videos', icon: 'video' },
  { id: 'orders', label: 'Orders', icon: 'cart' },
  { id: 'messages', label: 'Messages', icon: 'message' },
  { id: 'mailbox', label: 'Mailbox', icon: 'mail' },
  { id: 'settings', label: 'Settings', icon: 'edit' },
]

export default function Admin() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [tab, setTab] = useState('overview')

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Icon name="shield" className="w-6 h-6 text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Producer dashboard</h1>
          <p className="text-sm text-slate-400">
            {settings.siteName} · logged in as {user?.name} (admin)
          </p>
        </div>
      </div>

      <div className="flex gap-2 my-6 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn('tab flex items-center gap-2 whitespace-nowrap', tab === t.id && 'tab-active')}
          >
            <Icon name={t.icon} className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'beats' && <BeatsTab />}
      {tab === 'videos' && <VideosTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'mailbox' && <MailboxTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
