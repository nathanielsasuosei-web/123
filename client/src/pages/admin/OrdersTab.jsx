import { useCallback, useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import { api } from '../../api'
import { useSettings } from '../../context/SettingsContext'
import { formatMoney, formatDate, LICENSE_LABELS, STATUS_STYLES, cn } from '../../utils'

const FILTERS = ['all', 'pending', 'paid', 'refunded', 'cancelled']

export default function OrdersTab() {
  const { settings } = useSettings()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`
      const { orders } = await api(`/api/orders${q}`)
      setOrders(orders)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const act = async (id, action) => {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/orders/${id}/${action}`, { method: 'POST' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('tab capitalize', filter === f && 'tab-active')}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon="cart" title="No orders" message="Orders from artists will appear here." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card !p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-500 font-mono text-sm">#{o.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{o.beat.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {o.user?.name} ({o.user?.email}) · {LICENSE_LABELS[o.licenseType]} ·{' '}
                    {formatMoney(o.amount, settings)} {o.currency} ·{' '}
                    {o.paymentMethod === 'mobile_money'
                      ? `MoMo ${o.payerPhone}`
                      : `Bank ref: ${o.bankReference}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(o.createdAt)} {o.paidAt ? `· paid ${formatDate(o.paidAt)}` : ''}
                  </p>
                </div>
                <span className={cn('badge', STATUS_STYLES[o.status])}>{o.status}</span>
                <div className="flex gap-2">
                  {o.status === 'pending' && (
                    <button
                      onClick={() => act(o.id, 'confirm')}
                      disabled={busyId === o.id}
                      className="btn-primary !px-3 !py-1.5 text-xs"
                    >
                      {busyId === o.id ? <Spinner className="w-3.5 h-3.5" /> : <Icon name="check" className="w-3.5 h-3.5" />}
                      Mark paid
                    </button>
                  )}
                  {o.status === 'paid' && (
                    <button
                      onClick={() => act(o.id, 'refund')}
                      disabled={busyId === o.id}
                      className="btn-ghost !px-3 !py-1.5 text-xs text-amber-300"
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
