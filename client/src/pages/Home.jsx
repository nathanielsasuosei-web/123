import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../icons'
import BeatCard from '../components/BeatCard'
import Spinner from '../components/Spinner'
import { api } from '../api'
import { useSettings } from '../context/SettingsContext'

export default function Home() {
  const { settings } = useSettings()
  const [beats, setBeats] = useState([])
  const [videos, setVideos] = useState([])
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/api/beats?sort=popular&limit=8'),
      api('/api/videos'),
      api('/api/beats/meta'),
    ])
      .then(([b, v, m]) => {
        setBeats(b.beats)
        setVideos(v.videos.slice(0, 3))
        setGenres(m.genres.slice(0, 12))
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-32 -left-24 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <span className="badge bg-white/10 text-fuchsia-200 border border-white/10">
            <Icon name="zap" className="w-3.5 h-3.5" /> New beats every week
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black text-white leading-tight">
            Exclusive Type Beats by{' '}
            <span className="gradient-text">{settings.producerName}</span>
          </h1>
          <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto">
            Preview, buy with <b>Mobile Money</b> or <b>bank transfer</b>, and get your beat delivered
            instantly — by download and by email.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/beats" className="btn-primary">
              <Icon name="disc" className="w-4 h-4" /> Browse beats
            </Link>
            <Link to="/videos" className="btn-ghost">
              <Icon name="video" className="w-4 h-4" /> Watch videos
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <Icon name="phone" className="w-4 h-4 text-fuchsia-400" /> Mobile Money
            </span>
            <span className="flex items-center gap-2">
              <Icon name="bank" className="w-4 h-4 text-fuchsia-400" /> Bank transfer
            </span>
            <span className="flex items-center gap-2">
              <Icon name="mail" className="w-4 h-4 text-fuchsia-400" /> Instant email delivery
            </span>
          </div>
        </div>
      </section>

      {/* Featured beats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">🔥 Trending beats</h2>
            <p className="text-slate-400 mt-1">Most played this week</p>
          </div>
          <Link to="/beats" className="btn-ghost !px-4 !py-2 text-sm hidden sm:inline-flex">
            View all <Icon name="arrowRight" className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="w-8 h-8 text-fuchsia-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {beats.map((b) => (
              <BeatCard key={b.id} beat={b} list={beats} />
            ))}
          </div>
        )}
      </section>

      {/* Genres */}
      {genres.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h2 className="text-2xl font-bold text-white mb-5">Browse by genre</h2>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Link
                key={g}
                to={`/beats?genre=${encodeURIComponent(g)}`}
                className="px-4 py-2 rounded-full glass text-sm text-slate-200 hover:border-fuchsia-500/50 hover:text-white transition"
              >
                {g}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: 'search',
              title: '1. Find your beat',
              text: 'Preview exclusive type beats with the built-in player. Filter by genre, mood and price.',
            },
            {
              icon: 'wallet',
              title: '2. Pay your way',
              text: 'Checkout with Mobile Money (MTN, Vodafone, AirtelTigo) or a bank transfer.',
            },
            {
              icon: 'mail',
              title: '3. Receive & record',
              text: 'Once payment is confirmed, download instantly and get the beat + license by email. Chat with the producer any time.',
            },
          ].map((s) => (
            <div key={s.title} className="card text-center hover:border-fuchsia-500/30 transition">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                <Icon name={s.icon} className="w-7 h-7 text-fuchsia-300" />
              </div>
              <h3 className="font-bold text-white mt-4">{s.title}</h3>
              <p className="text-sm text-slate-400 mt-2">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Latest videos */}
      {videos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">🎬 Latest videos</h2>
              <p className="text-slate-400 mt-1">Beat videos and visualizers</p>
            </div>
            <Link to="/videos" className="btn-ghost !px-4 !py-2 text-sm hidden sm:inline-flex">
              View all <Icon name="arrowRight" className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {videos.map((v) => (
              <Link key={v.id} to="/videos" className="group glass rounded-2xl overflow-hidden hover:border-violet-500/40 transition">
                <div className="relative aspect-video bg-black">
                  <video src={v.videoUrl} poster={v.thumbnailUrl || undefined} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                    <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition">
                      <Icon name="play" className="w-5 h-5 text-white" />
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-white truncate">{v.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{v.views.toLocaleString()} views</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-10 sm:p-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Ready to make your next hit?</h2>
          <p className="text-white/80 mt-3 max-w-xl mx-auto">
            Create a free account to buy beats, download instantly and chat with {settings.producerName}.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="px-6 py-3 rounded-full font-semibold bg-white text-fuchsia-600 hover:bg-slate-100 transition">
              Create free account
            </Link>
            <Link to="/contact" className="px-6 py-3 rounded-full font-semibold border border-white/40 text-white hover:bg-white/10 transition">
              Custom beat request
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
