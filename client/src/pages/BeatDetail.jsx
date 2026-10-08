import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import BeatCard from '../components/BeatCard'
import Waveform from '../components/Waveform'
import CheckoutModal from '../components/CheckoutModal'
import ChatBox from '../components/ChatBox'
import Modal from '../components/Modal'
import { api } from '../api'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { formatMoney, formatTime, LICENSE_LABELS, cn } from '../utils'

const LICENSES = [
  {
    id: 'mp3',
    name: 'MP3 Lease',
    desc: 'Tagged MP3 · 1 commercial release · up to 10k streams',
    icon: 'music',
  },
  {
    id: 'wav',
    name: 'WAV Lease',
    desc: 'Untagged WAV · 1 commercial release · up to 50k streams',
    icon: 'download',
  },
  {
    id: 'exclusive',
    name: 'Exclusive Rights',
    desc: 'Full ownership transfer · beat is removed from the store',
    icon: 'shield',
  },
]

export default function BeatDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { current, isPlaying, playBeat, toggle, currentTime, duration, seek } = usePlayer()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [license, setLicense] = useState('mp3')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    api(`/api/beats/${id}`)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
    api(`/api/beats/${id}/play`, { method: 'POST' }).catch(() => {})
  }, [id])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-fuchsia-400" />
      </div>
    )
  }
  if (notFound || !data) return <EmptyState icon="disc" title="Beat not found" message="This beat may have been removed." />

  const { beat, related } = data
  const isCurrent = current?.id === beat.id
  const progress = isCurrent && duration > 0 ? currentTime / duration : 0

  const openCheckout = () => {
    if (!user) {
      window.location.href = '/login'
      return
    }
    setCheckoutOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* breadcrumb */}
      <div className="text-sm text-slate-400 mb-6">
        <Link to="/beats" className="hover:text-white">
          Beats
        </Link>{' '}
        / <span className="text-white">{beat.title}</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* left: cover + player */}
        <div className="lg:col-span-2">
          <div className="relative aspect-square rounded-3xl overflow-hidden glass">
            {beat.coverUrl ? (
              <img src={beat.coverUrl} alt={beat.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-900 to-fuchsia-900 flex items-center justify-center">
                <Icon name="music" className="w-24 h-24 text-white/40" />
              </div>
            )}
            <button
              onClick={() => (isCurrent ? toggle() : playBeat(beat))}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition group"
              aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
            >
              <span className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-2xl shadow-fuchsia-500/40 group-hover:scale-110 transition-transform">
                <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="w-8 h-8" />
              </span>
            </button>
          </div>

          <div className="mt-4 glass rounded-2xl p-4">
            <Waveform url={beat.audioUrl} progress={progress} onSeek={seek} height={80} />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>{formatTime(isCurrent ? currentTime : 0)}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Icon name="star" className="w-3.5 h-3.5 text-amber-400" /> {beat.plays.toLocaleString()} plays
                </span>
                {beat.bpm && <span>{beat.bpm} BPM</span>}
                {beat.key && <span>{beat.key}</span>}
              </div>
              <span>{formatTime(isCurrent ? duration : 0)}</span>
            </div>
          </div>
        </div>

        {/* right: info + licenses */}
        <div className="lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            {beat.genre && <span className="badge bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30">{beat.genre}</span>}
            {beat.mood && <span className="badge bg-violet-500/15 text-violet-200 border border-violet-500/30">{beat.mood}</span>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-4">{beat.title}</h1>
          <p className="text-slate-400 mt-1">
            Produced by <span className="text-white font-medium">{beat.producer}</span>
          </p>

          {beat.description && <p className="text-slate-300 mt-5 leading-relaxed">{beat.description}</p>}

          {beat.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {beat.tags.map((t) => (
                <span key={t} className="text-xs text-slate-400 px-2.5 py-1 rounded-full bg-white/5">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-bold text-white mt-8 mb-4">Choose a license</h3>
          <div className="space-y-3">
            {LICENSES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLicense(l.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition',
                  license === l.id
                    ? 'border-fuchsia-500/60 bg-fuchsia-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                    license === l.id
                      ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                      : 'bg-white/10 text-slate-300'
                  )}
                >
                  <Icon name={l.icon} className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-white">{l.name}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{l.desc}</span>
                </span>
                <span className="font-bold gradient-text">{formatMoney(beat.prices[l.id], settings)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={openCheckout} className="btn-primary flex-1 sm:flex-none">
              <Icon name="cart" className="w-4 h-4" /> Buy {LICENSE_LABELS[license]} —{' '}
              {formatMoney(beat.prices[license], settings)}
            </button>
            {user ? (
              <button onClick={() => setChatOpen(true)} className="btn-ghost">
                <Icon name="message" className="w-4 h-4" /> Message producer
              </button>
            ) : (
              <Link to="/login" className="btn-ghost">
                <Icon name="message" className="w-4 h-4" /> Log in to message
              </Link>
            )}
          </div>
          {!user && (
            <p className="text-xs text-slate-500 mt-3">
              You need a free artist account to buy beats and chat with the producer.
            </p>
          )}
        </div>
      </div>

      {/* related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6">More like this</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {related.map((b) => (
              <BeatCard key={b.id} beat={b} list={related} />
            ))}
          </div>
        </section>
      )}

      {checkoutOpen && <CheckoutModal beat={beat} license={license} onClose={() => setCheckoutOpen(false)} />}

      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title={`Chat with ${settings.producerName}`} maxWidth="max-w-lg">
        <ChatBox height="480px" />
      </Modal>
    </div>
  )
}
