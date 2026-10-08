import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Icon from '../icons'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

const navLink = ({ isActive }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`

export default function Navbar() {
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  const submitSearch = (e) => {
    e.preventDefault()
    navigate(q.trim() ? `/beats?search=${encodeURIComponent(q.trim())}` : '/beats')
    setOpen(false)
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass border-b border-white/5">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-lg text-white shrink-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <Icon name="disc" className="w-5 h-5 text-white" />
          </span>
          <span className="gradient-text">{settings.siteName}</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <NavLink to="/" className={navLink} end>
            Home
          </NavLink>
          <NavLink to="/beats" className={navLink}>
            Beats
          </NavLink>
          <NavLink to="/videos" className={navLink}>
            Videos
          </NavLink>
          <NavLink to="/contact" className={navLink}>
            Contact
          </NavLink>
        </div>

        <form onSubmit={submitSearch} className="hidden lg:flex flex-1 max-w-sm ml-auto">
          <div className="relative w-full">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search beats, genres, moods…"
              className="w-full pl-9 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/60"
            />
          </div>
        </form>

        <div className="hidden md:flex items-center gap-2 ml-auto lg:ml-0">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-full glass hover:bg-white/10 transition"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-white max-w-[120px] truncate">{user.name}</span>
                <Icon name="chevDown" className="w-4 h-4 text-slate-400" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 glass rounded-xl overflow-hidden z-20 shadow-xl">
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                      >
                        <Icon name="shield" className="w-4 h-4" /> Admin dashboard
                      </Link>
                    )}
                    <Link
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                    >
                      <Icon name="user" className="w-4 h-4" /> My dashboard
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-300 hover:bg-white/10"
                    >
                      <Icon name="logout" className="w-4 h-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn-ghost !px-4 !py-2 text-sm">
                Log in
              </Link>
              <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden ml-auto p-2 text-slate-300"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          <Icon name={open ? 'x' : 'menu'} className="w-6 h-6" />
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-white/5 px-4 py-4 space-y-3">
          <form onSubmit={submitSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search beats…"
              className="input !py-2.5 text-sm"
            />
          </form>
          <div className="flex flex-col gap-1">
            <NavLink to="/" className={navLink} end onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/beats" className={navLink} onClick={() => setOpen(false)}>
              Beats
            </NavLink>
            <NavLink to="/videos" className={navLink} onClick={() => setOpen(false)}>
              Videos
            </NavLink>
            <NavLink to="/contact" className={navLink} onClick={() => setOpen(false)}>
              Contact
            </NavLink>
            {user && (
              <NavLink to="/dashboard" className={navLink} onClick={() => setOpen(false)}>
                My dashboard
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLink} onClick={() => setOpen(false)}>
                Admin
              </NavLink>
            )}
          </div>
          {!user && (
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="btn-ghost flex-1 text-sm" onClick={() => setOpen(false)}>
                Log in
              </Link>
              <Link to="/register" className="btn-primary flex-1 text-sm" onClick={() => setOpen(false)}>
                Sign up
              </Link>
            </div>
          )}
          {user && (
            <button
              onClick={() => {
                logout()
                setOpen(false)
              }}
              className="btn-ghost w-full text-sm text-red-300"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </header>
  )
}
