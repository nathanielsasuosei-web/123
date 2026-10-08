import { useEffect, useState } from 'react'
import Icon from '../icons'
import Modal from './Modal'
import Spinner from './Spinner'
import { api, downloadProtected } from '../api'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { formatMoney, LICENSE_LABELS, cn } from '../utils'

const PROVIDERS = ['MTN Mobile Money', 'Vodafone Cash', 'AirtelTigo Money']

export default function CheckoutModal({ beat, license, onClose }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [step, setStep] = useState('form') // form | pending | paid
  const [method, setMethod] = useState('mobile_money')
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [phone, setPhone] = useState(user?.phone || '')
  const [bankRef, setBankRef] = useState('')
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)

  const amount = beat.prices[license]

  // Poll the order while the (simulated) payment is being approved
  useEffect(() => {
    if (step !== 'pending' || !order) return undefined
    const t = setInterval(async () => {
      try {
        const { order: o } = await api(`/api/orders/${order.id}`)
        setOrder(o)
        if (o.status === 'paid') setStep('paid')
        if (o.status === 'cancelled' || o.status === 'failed') {
          setError('This order was cancelled.')
          setStep('form')
        }
      } catch {
        /* keep polling */
      }
    }, 2500)
    return () => clearInterval(t)
  }, [step, order?.id])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { order: o } = await api('/api/orders', {
        method: 'POST',
        body: {
          beatId: beat.id,
          licenseType: license,
          paymentMethod: method,
          payerPhone: method === 'mobile_money' ? phone : undefined,
          bankReference: method === 'bank_transfer' ? bankRef : undefined,
        },
      })
      setOrder(o)
      setStep('pending')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (order) {
      try {
        await api(`/api/orders/${order.id}/cancel`, { method: 'POST' })
      } catch {
        /* ignore */
      }
    }
    onClose()
  }

  const download = async () => {
    try {
      await downloadProtected(
        `/api/orders/${order.id}/download`,
        `${beat.title.replace(/\s+/g, '_')}_${license.toUpperCase()}_prod_${beat.producer}.mp3`
      )
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Checkout — ${beat.title}`} maxWidth="max-w-md">
      {/* order summary */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 mb-5">
        {beat.coverUrl ? (
          <img src={beat.coverUrl} alt={beat.title} className="w-14 h-14 rounded-lg object-cover" />
        ) : (
          <span className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
            <Icon name="music" className="w-7 h-7 text-white" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">{beat.title}</p>
          <p className="text-xs text-slate-400">
            {LICENSE_LABELS[license]} · Prod. {beat.producer}
          </p>
        </div>
        <span className="font-bold gradient-text">{formatMoney(amount, settings)}</span>
      </div>

      {step === 'form' && (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <span className="label">Payment method</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('mobile_money')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition',
                  method === 'mobile_money'
                    ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                )}
              >
                <Icon name="phone" className="w-4 h-4" /> Mobile Money
              </button>
              <button
                type="button"
                onClick={() => setMethod('bank_transfer')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition',
                  method === 'bank_transfer'
                    ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                )}
              >
                <Icon name="bank" className="w-4 h-4" /> Bank transfer
              </button>
            </div>
          </div>

          {method === 'mobile_money' && (
            <>
              <div>
                <label className="label">Mobile money provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input">
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p} className="bg-panel">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Mobile money number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="input"
                  required
                />
              </div>
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm text-slate-300">
                <p className="flex items-start gap-2">
                  <Icon name="info" className="w-4 h-4 mt-0.5 shrink-0 text-violet-300" />
                  You will receive a prompt on this number to approve{' '}
                  <b className="text-white">{formatMoney(amount, settings)}</b> to {settings.producerName} (
                  {settings.momoNumber || 'MoMo number in settings'}).
                </p>
              </div>
            </>
          )}

          {method === 'bank_transfer' && (
            <>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm space-y-1.5">
                <p className="font-semibold text-white">Transfer to:</p>
                <p className="text-slate-300">
                  {settings.bankName} · <b className="text-white">{settings.bankAccountName}</b>
                </p>
                <p className="text-slate-300">
                  Account: <b className="text-white tracking-wider">{settings.bankAccountNumber}</b>
                </p>
                <p className="text-slate-300">
                  Amount: <b className="text-white">{formatMoney(amount, settings)}</b>
                </p>
              </div>
              <div>
                <label className="label">Transfer reference / transaction ID</label>
                <input
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="e.g. TRF-998877"
                  className="input"
                  required
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5" /> : <Icon name="lock" className="w-4 h-4" />}
            Pay {formatMoney(amount, settings)} securely
          </button>
          <p className="text-xs text-slate-500 text-center">
            After payment is confirmed your beat is emailed to <b>{user?.email}</b> and unlocked in
            your dashboard.
          </p>
        </form>
      )}

      {step === 'pending' && (
        <div className="text-center py-6 space-y-5">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center animate-floaty">
            <Icon name="phone" className="w-10 h-10 text-fuchsia-300" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Confirming your payment…</h4>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              {method === 'mobile_money' ? (
                <>
                  Check <b className="text-white">{phone}</b> for the {provider} prompt and enter your PIN
                  to approve <b className="text-white">{formatMoney(amount, settings)}</b>.
                </>
              ) : (
                <>
                  We are waiting for your bank transfer of{' '}
                  <b className="text-white">{formatMoney(amount, settings)}</b> (reference{' '}
                  <b className="text-white">{bankRef}</b>). The producer can also confirm it manually.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-fuchsia-300">
            <Spinner className="w-5 h-5" />
            <span className="text-sm">Waiting for confirmation</span>
          </div>
          <p className="text-xs text-slate-500">Demo mode: the payment auto-confirms in a few seconds.</p>
          <button onClick={cancel} className="btn-ghost !px-4 !py-2 text-sm">
            Cancel order
          </button>
        </div>
      )}

      {step === 'paid' && (
        <div className="text-center py-6 space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
            <Icon name="check" className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Payment confirmed! 🎉</h4>
            <p className="text-sm text-slate-400 mt-2">
              <b className="text-white">{beat.title}</b> ({LICENSE_LABELS[license]}) is yours. A download
              link was also sent to <b className="text-white">{user?.email}</b>.
            </p>
          </div>
          <div className="space-y-2">
            <button onClick={download} className="btn-primary w-full">
              <Icon name="download" className="w-4 h-4" /> Download your beat
            </button>
            <a
              href={`/api/orders/${order?.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="hidden"
            />
            <button
              onClick={() => downloadProtected(`/api/orders/${order.id}/license`, `${beat.title.replace(/\s+/g, '_')}_license.txt`)}
              className="btn-ghost w-full !px-4 !py-2.5 text-sm"
            >
              <Icon name="file" className="w-4 h-4" /> Download license agreement
            </button>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button onClick={onClose} className="btn-ghost !px-4 !py-2 text-sm">
            Close
          </button>
        </div>
      )}
    </Modal>
  )
}
