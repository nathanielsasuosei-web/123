import { Link } from 'react-router-dom'
import Icon from '../icons'
import { usePlayer } from '../context/PlayerContext'
import { useSettings } from '../context/SettingsContext'
import { formatMoney } from '../utils'

export default function BeatCard({ beat, list }) {
  const { current, isPlaying, playBeat, toggle } = usePlayer()
  const { settings } = useSettings()
  const isCurrent = current?.id === beat.id
  const minPrice = Math.min(beat.prices.mp3, beat.prices.wav, beat.prices.exclusive)

  return (
    <div className="group glass rounded-2xl overflow-hidden hover:border-violet-500/40 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-500/10">
      <div className="relative aspect-square overflow-hidden">
        {beat.coverUrl ? (
          <img
            src={beat.coverUrl}
            alt={beat.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-900 to-fuchsia-900 flex items-center justify-center">
            <Icon name="music" className="w-16 h-16 text-white/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={() => (isCurrent ? toggle() : playBeat(beat, list))}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30 hover:scale-110 transition-transform"
            aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isCurrent && isPlaying ? 'pause' : 'play'} className="w-6 h-6" />
          </button>
        </div>
        {isCurrent && isPlaying && (
          <div className="absolute top-2 right-2 flex items-end gap-[3px] h-5 px-2 py-1 rounded bg-black/60">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-fuchsia-400 animate-equalizer origin-bottom"
                style={{ height: 6 + ((i * 5) % 12), animationDelay: i * 0.15 + 's' }}
              />
            ))}
          </div>
        )}
        {beat.genre && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-xs font-medium text-white backdrop-blur">
            {beat.genre}
          </div>
        )}
      </div>
      <div className="p-4">
        <Link
          to={`/beats/${beat.id}`}
          className="font-semibold text-white hover:text-fuchsia-300 transition-colors line-clamp-1"
        >
          {beat.title}
        </Link>
        <p className="text-sm text-slate-400 mt-0.5 truncate">
          {beat.producer}
          {beat.bpm ? ` · ${beat.bpm} BPM` : ''}
          {beat.key ? ` · ${beat.key}` : ''}
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-slate-500">{beat.plays.toLocaleString()} plays</span>
          <span className="text-sm font-bold gradient-text">from {formatMoney(minPrice, settings)}</span>
        </div>
      </div>
    </div>
  )
}
