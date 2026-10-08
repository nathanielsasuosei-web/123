import { useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import { api } from '../../api'
import { useSettings } from '../../context/SettingsContext'
import { formatMoney, formatDate, LICENSE_LABELS, STATUS_STYLES, cn } from '../../utils'

export default function OverviewTab() {
  const { settings } = useSettings()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/admin/stats')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
  if (!data) return <p className="text-red-300">Failed to load stats.</p>

  const { stats, recentOrders, topBeats } = data
  const cards = [
    { icon: 'wallet', label: 'Revenue (paid)', value: formatMoney(stats.revenue, settings), sub: stats.currency },
    { icon: 'cart', label: 'Orders', value: stats.orders, sub: `${stats.pendingOrders} pending` },
    { icon: 'users', label: 'Artists', value: stats.artists, sub: 'registered' },
    { icon: 'music', label: 'Beats', value: stats.beats, sub: `${stats.totalPlays.toLocaleString()} plays` },
    { icon: 'video', label: 'Videos', value: stats.videos, sub: `${stats.totalViews.toLocaleString()} views` },
  ]

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card !p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">{c.label}</span>
              <span className="w-9 h-9 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
                <Icon name={c.icon} className="w-4 h-4 text-fuchsia-300" />
              </span>
            </div>
            <p className="text-2xl font-black text-white mt-3">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-white mb-4">Recent orders</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-white truncate flex-1">
                    #{o.id} {o.beat.title}
                  </span>
                  <span className="text-slate-400">{o.user?.name}</span>
                  <span className={cn('badge', STATUS_STYLES[o.status])}>{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="font-bold text-white mb-4">Top beats</h3>
          {topBeats.length === 0 ? (
            <p className="text-sm text-slate-500">No beats yet.</p>
          ) : (
            <div className="space-y-3">
              {topBeats.map((b) => (
                <div key={b.id} className="flex items-center gap-3 text-sm">
                  {b.coverUrl ? (
                    <img src={b.coverUrl} alt={b.title} className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <span className="w-9 h-9 rounded-lg bg-white/10" />
                  )}
                  <span className="font-medium text-white truncate flex-1">{b.title}</span>
                  <span className="text-slate-400">{b.plays.toLocaleString()} plays</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
