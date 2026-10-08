import { useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import { api } from '../../api'
import { useSettings } from '../../context/SettingsContext'

export default function SettingsTab() {
  const { settings, refresh } = useSettings()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.siteName,
        producer_name: settings.producerName,
        currency_code: settings.currencyCode,
        currency_symbol: settings.currencySymbol,
        momo_provider: settings.momoProvider,
        momo_number: settings.momoNumber,
        bank_name: settings.bankName,
        bank_account_name: settings.bankAccountName,
        bank_account_number: settings.bankAccountNumber,
        contact_email: settings.contactEmail,
        payment_auto_confirm: settings.paymentAutoConfirm ?? '1',
        license_terms: settings.licenseTerms,
      })
    }
  }, [settings])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      await api('/api/admin/settings', { method: 'PUT', body: form })
      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!form) return <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>

  return (
    <form onSubmit={submit} className="card max-w-3xl space-y-5">
      <h2 className="text-xl font-bold text-white">Site & payment settings</h2>
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}
      {saved && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">Settings saved.</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Site name</label>
          <input value={form.site_name} onChange={set('site_name')} className="input" />
        </div>
        <div>
          <label className="label">Producer name</label>
          <input value={form.producer_name} onChange={set('producer_name')} className="input" />
        </div>
        <div>
          <label className="label">Currency code</label>
          <input value={form.currency_code} onChange={set('currency_code')} className="input" placeholder="GHS" />
        </div>
        <div>
          <label className="label">Currency symbol</label>
          <input value={form.currency_symbol} onChange={set('currency_symbol')} className="input" placeholder="₵" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Mobile money provider</label>
          <input value={form.momo_provider} onChange={set('momo_provider')} className="input" placeholder="MTN Mobile Money" />
        </div>
        <div>
          <label className="label">Mobile money number</label>
          <input value={form.momo_number} onChange={set('momo_number')} className="input" placeholder="024 400 0000" />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Bank name</label>
          <input value={form.bank_name} onChange={set('bank_name')} className="input" />
        </div>
        <div>
          <label className="label">Account name</label>
          <input value={form.bank_account_name} onChange={set('bank_account_name')} className="input" />
        </div>
        <div>
          <label className="label">Account number</label>
          <input value={form.bank_account_number} onChange={set('bank_account_number')} className="input" />
        </div>
      </div>

      <div>
        <label className="label">Contact email</label>
        <input type="email" value={form.contact_email} onChange={set('contact_email')} className="input" />
      </div>

      <div>
        <label className="label">License terms (shown in license agreements & emails)</label>
        <textarea
          value={form.license_terms}
          onChange={set('license_terms')}
          className="input min-h-[110px] resize-y"
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={form.payment_auto_confirm === '1' || form.payment_auto_confirm === 1 || form.payment_auto_confirm === true}
          onChange={(e) => setForm((f) => ({ ...f, payment_auto_confirm: e.target.checked ? '1' : '0' }))}
          className="w-4 h-4 accent-fuchsia-500"
        />
        <span>
          Demo mode: automatically confirm payments after a few seconds. Uncheck to confirm payments
          manually from the Orders tab (like a real MoMo/bank callback would).
        </span>
      </label>

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? <Spinner className="w-4 h-4" /> : <Icon name="check" className="w-4 h-4" />}
        Save settings
      </button>
    </form>
  )
}
