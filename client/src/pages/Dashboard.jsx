import { useCallback, useEffect, useState } from 'react'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import ChatBox from '../components/ChatBox'
import { api, downloadProtected } from '../api'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { formatMoney, formatDate, LICENSE_LABELS, STATUS_STYLES, cn } from '../utils'

function OrdersTab() {
  const { settings } = useSettings()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { orders } = await api('/api/orders/my')
      setOrders(orders)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  const download = async (order) => {
    try {
      await downloadProtected(
        `/api/orders/${order.id}/download`,
        `${order.beat.title.replace(/\s+/g, '_')}_${order.licenseType.toUpperCase()}.mp3`
      )
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
  if (error) return <p className="text-red-300 text-sm">{error}</p>
  if (orders.length === 0) {
    return <EmptyState icon="cart" title="No orders yet" message="Browse the marketplace and buy your first beat — it will show up here and in your email." />
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="card flex flex-wrap items-center gap-4 !p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">{o.beat.title}</span>
              <span className={cn('badge', STATUS_STYLES[o.status])}>{o.status}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Order #{o.id} · {LICENSE_LABELS[o.licenseType]} · {formatMoney(o.amount, settings)} {o.currency} ·{' '}
              {o.paymentMethod === 'mobile_money' ? `Mobile Money (${o.payerPhone})` : `Bank transfer (${o.bankReference})`} ·{' '}
              {formatDate(o.createdAt)}
            </p>
          </div>
          {o.status === 'paid' && (
            <button onClick={() => download(o)} className="btn-primary !px-4 !py-2 text-sm">
              <Icon name="download" className="w-4 h-4" /> Download
            </button>
          )}
          {o.status === 'pending' && (
            <span className="text-xs text-amber-300 flex items-center gap-1.5">
              <Icon name="clock" className="w-4 h-4" /> Awaiting payment confirmation
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function DownloadsTab() {
  const { settings } = useSettings()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/orders/my')
      .then((d) => setOrders(d.orders.filter((o) => o.status === 'paid')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
  if (orders.length === 0) {
    return <EmptyState icon="download" title="No downloads yet" message="Your purchased beats will be available here, forever." />
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="card flex flex-wrap items-center gap-4 !p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
            <Icon name="music" className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">{o.beat.title}</p>
            <p className="text-xs text-slate-400">
              {LICENSE_LABELS[o.licenseType]} · paid {formatMoney(o.amount, settings)} · {formatDate(o.paidAt || o.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                downloadProtected(
                  `/api/orders/${o.id}/license`,
                  `${o.beat.title.replace(/\s+/g, '_')}_license.txt`
                )
              }
              className="btn-ghost !px-3 !py-2 text-xs"
            >
              <Icon name="file" className="w-4 h-4" /> License
            </button>
            <button
              onClick={() =>
                downloadProtected(
                  `/api/orders/${o.id}/download`,
                  `${o.beat.title.replace(/\s+/g, '_')}_${o.licenseType.toUpperCase()}.mp3`
                )
              }
              className="btn-primary !px-3 !py-2 text-xs"
            >
              <Icon name="download" className="w-4 h-4" /> Beat
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function MessagesTab() {
  const { settings } = useSettings()
  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">
        Chat with <b className="text-white">{settings.producerName}</b> — every message is also delivered by email.
      </p>
      <ChatBox height="520px" />
    </div>
  )
}

const TABS = [
  { id: 'orders', label: 'My orders', icon: 'cart' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'messages', label: 'Messages', icon: 'message' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('orders')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl font-bold">
          {user?.name?.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">My dashboard</h1>
          <p className="text-sm text-slate-400">
            {user?.name} · {user?.email}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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

      {tab === 'orders' && <OrdersTab />}
      {tab === 'downloads' && <DownloadsTab />}
      {tab === 'messages' && <MessagesTab />}
    </div>
  )
}
