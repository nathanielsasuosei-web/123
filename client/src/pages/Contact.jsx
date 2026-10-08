import { useState } from 'react'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import { api } from '../api'
import { useSettings } from '../context/SettingsContext'

export default function Contact() {
  const { settings } = useSettings()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/api/contact', { method: 'POST', body: form })
      setSent(true)
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Get in touch</h1>
        <p className="text-slate-400 mt-2">
          Custom beat requests, licensing questions, collaborations — we reply by email.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card">
          {sent ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <Icon name="check" className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mt-4">Message sent!</h3>
              <p className="text-slate-400 mt-2">We will get back to you by email soon.</p>
              <button onClick={() => setSent(false)} className="btn-ghost mt-6 !px-4 !py-2 text-sm">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input value={form.name} onChange={set('name')} className="input" required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input value={form.subject} onChange={set('subject')} className="input" required />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  value={form.message}
                  onChange={set('message')}
                  className="input min-h-[140px] resize-y"
                  required
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? <Spinner className="w-5 h-5" /> : <Icon name="send" className="w-4 h-4" />}
                Send message
              </button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <div className="card flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-fuchsia-500/15 flex items-center justify-center shrink-0">
              <Icon name="mail" className="w-5 h-5 text-fuchsia-300" />
            </span>
            <div>
              <p className="font-semibold text-white">Email</p>
              <p className="text-sm text-slate-400 break-all">{settings.contactEmail || '—'}</p>
            </div>
          </div>
          <div className="card flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-fuchsia-500/15 flex items-center justify-center shrink-0">
              <Icon name="phone" className="w-5 h-5 text-fuchsia-300" />
            </span>
            <div>
              <p className="font-semibold text-white">Mobile Money</p>
              <p className="text-sm text-slate-400">
                {settings.momoProvider} · {settings.momoNumber || '—'}
              </p>
            </div>
          </div>
          <div className="card flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-fuchsia-500/15 flex items-center justify-center shrink-0">
              <Icon name="bank" className="w-5 h-5 text-fuchsia-300" />
            </span>
            <div>
              <p className="font-semibold text-white">Bank transfer</p>
              <p className="text-sm text-slate-400">
                {settings.bankName} · {settings.bankAccountNumber || '—'}
              </p>
            </div>
          </div>
          <div className="card bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border-fuchsia-500/20">
            <p className="text-sm text-slate-200">
              💬 <b className="text-white">Faster replies:</b> create a free account and use the chat box
              in your dashboard — every message is also sent by email.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
