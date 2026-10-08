import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

export default function Login() {
  const { login } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'admin' ? '/admin' : location.state?.from || '/dashboard', { replace: true })
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
            <Icon name="disc" className="w-7 h-7 text-white" />
          </span>
          <h1 className="text-2xl font-bold text-white mt-4">Welcome back</h1>
          <p className="text-slate-400 mt-1">Log in to {settings.siteName}</p>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner className="w-5 h-5" /> : <Icon name="lock" className="w-4 h-4" />}
            Log in
          </button>
          <p className="text-sm text-slate-400 text-center">
            No account yet?{' '}
            <Link to="/register" className="text-fuchsia-300 hover:text-fuchsia-200 font-medium">
              Create one
            </Link>
          </p>
        </form>
        <div className="mt-4 text-center">
          <Link to="/contact" className="text-sm text-slate-500 hover:text-slate-300">
            Need help? Contact us
          </Link>
        </div>
      </div>
    </div>
  )
}
