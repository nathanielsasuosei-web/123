import { Link } from 'react-router-dom'
import Icon from '../icons'
import { useSettings } from '../context/SettingsContext'

export default function Footer() {
  const { settings } = useSettings()
  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Icon name="disc" className="w-5 h-5 text-white" />
            </span>
            <span className="gradient-text">{settings.siteName}</span>
          </div>
          <p className="text-sm text-slate-400 mt-4 max-w-md">
            Exclusive type beats by {settings.producerName}. Preview, buy with Mobile Money or bank
            transfer, and receive your downloads instantly by email.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Explore</h4>
          <div className="flex flex-col gap-2 text-sm text-slate-400">
            <Link to="/beats" className="hover:text-white transition">
              Browse beats
            </Link>
            <Link to="/videos" className="hover:text-white transition">
              Videos
            </Link>
            <Link to="/contact" className="hover:text-white transition">
              Contact
            </Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">Account</h4>
          <div className="flex flex-col gap-2 text-sm text-slate-400">
            <Link to="/login" className="hover:text-white transition">
              Log in
            </Link>
            <Link to="/register" className="hover:text-white transition">
              Create account
            </Link>
            <Link to="/dashboard" className="hover:text-white transition">
              My downloads
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {settings.siteName} · Produced by {settings.producerName}
      </div>
    </footer>
  )
}
