import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function Register() {
  const { register } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <Icon name="user" className="w-7 h-7 text-white" />
          </span>
          <h1 className="text-2xl font-bold text-white mt-4">Create your artist account</h1>
          <p className="text-slate-400 mt-1">
            Buy beats and get them delivered to your email — join {settings.siteName}
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label">Artist name</label>
            <input value={form.name} onChange={set('name')} className="input" placeholder="e.g. Lil Fresh" required />
          </div>
          <div>
            <label className="label">Email (your beats are sent here)</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="label">Phone / Mobile money number</label>
            <input value={form.phone} onChange={set('phone')} className="input" placeholder="024 123 4567" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                className="input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="label">Confirm</label>
              <input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5" /> : <Icon name="star" className="w-4 h-4" />}
            Create account
          </button>
          <p className="text-sm text-slate-400 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-fuchsia-300 hover:text-fuchsia-200 font-medium">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
