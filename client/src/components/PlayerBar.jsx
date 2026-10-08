import { Link } from 'react-router-dom'
import Icon from '../icons'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../utils'

export default function PlayerBar() {
  const { current, isPlaying, toggle, currentTime, duration, seek, next, prev, volume, setVolume } =
    usePlayer()

  if (!current) return null
  const progress = duration > 0 ? currentTime / duration : 0

  const onSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 glass border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center gap-4">
        <Link to={`/beats/${current.id}`} className="flex items-center gap-3 min-w-0 w-56 shrink-0">
          {current.coverUrl ? (
            <img
              src={current.coverUrl}
              alt={current.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <span className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Icon name="music" className="w-6 h-6 text-white" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{current.title}</p>
            <p className="text-xs text-slate-400 truncate">{current.producer}</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={prev} className="p-2 text-slate-300 hover:text-white transition" aria-label="Previous">
            <Icon name="prev" className="w-5 h-5" />
          </button>
          <button
            onClick={toggle}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white hover:scale-105 transition shadow-lg shadow-fuchsia-500/30"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} className="w-5 h-5" />
          </button>
          <button onClick={next} className="p-2 text-slate-300 hover:text-white transition" aria-label="Next">
            <Icon name="next" className="w-5 h-5" />
          </button>
        </div>

        <span className="text-xs text-slate-400 w-10 text-right shrink-0">{formatTime(currentTime)}</span>
        <div
          className="flex-1 h-1.5 rounded-full bg-white/10 cursor-pointer group"
          onClick={onSeek}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 relative"
            style={{ width: `${progress * 100}%` }}
          >
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition" />
          </div>
        </div>
        <span className="text-xs text-slate-400 w-10 shrink-0">{formatTime(duration)}</span>

        <div className="hidden sm:flex items-center gap-2 w-28 shrink-0">
          <Icon name="volume" className="w-4 h-4 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  )
}
