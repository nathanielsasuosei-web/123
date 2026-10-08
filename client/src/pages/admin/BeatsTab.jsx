import { useCallback, useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import BeatForm from './BeatForm'
import { api } from '../../api'
import { useSettings } from '../../context/SettingsContext'
import { formatMoney, formatDate } from '../../utils'

export default function BeatsTab() {
  const { settings } = useSettings()
  const [beats, setBeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try {
      const { beats } = await api('/api/beats?limit=100&sort=newest')
      setBeats(beats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (beat) => {
    if (!window.confirm(`Delete "${beat.title}"? This cannot be undone.`)) return
    await api(`/api/beats/${beat.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">{beats.length} beat(s)</h2>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="btn-primary !px-4 !py-2 text-sm"
        >
          <Icon name="plus" className="w-4 h-4" /> Upload beat
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
      ) : beats.length === 0 ? (
        <EmptyState
          icon="music"
          title="No beats yet"
          message="Upload your first beat — audio file plus cover art, set your prices, and it goes live instantly."
        />
      ) : (
        <div className="space-y-3">
          {beats.map((b) => (
            <div key={b.id} className="card flex items-center gap-4 !p-4">
              {b.coverUrl ? (
                <img src={b.coverUrl} alt={b.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
                  <Icon name="music" className="w-6 h-6 text-white" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white truncate">
                  {b.title} <span className="text-slate-500 font-normal">· {b.producer}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {b.genre || '—'} {b.mood ? `· ${b.mood}` : ''} {b.bpm ? `· ${b.bpm} BPM` : ''} {b.key ? `· ${b.key}` : ''} ·{' '}
                  {b.plays.toLocaleString()} plays · {formatDate(b.createdAt)}
                </p>
                <p className="text-xs mt-1">
                  <span className="gradient-text font-semibold">
                    MP3 {formatMoney(b.prices.mp3, settings)}
                  </span>
                  <span className="text-slate-500"> · </span>
                  <span className="gradient-text font-semibold">
                    WAV {formatMoney(b.prices.wav, settings)}
                  </span>
                  <span className="text-slate-500"> · </span>
                  <span className="gradient-text font-semibold">
                    EXCL {formatMoney(b.prices.exclusive, settings)}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditing(b)
                    setFormOpen(true)
                  }}
                  className="p-2.5 rounded-xl glass hover:bg-white/10 text-slate-300 hover:text-white transition"
                  aria-label="Edit"
                >
                  <Icon name="edit" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(b)}
                  className="p-2.5 rounded-xl glass hover:bg-red-500/20 text-slate-300 hover:text-red-300 transition"
                  aria-label="Delete"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <BeatForm
          beat={editing}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
