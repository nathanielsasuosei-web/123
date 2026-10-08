import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../icons'
import BeatCard from '../components/BeatCard'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { api } from '../api'

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
]

export default function Beats() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState({ beats: [], total: 0 })
  const [meta, setMeta] = useState({ genres: [], moods: [] })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const search = params.get('search') || ''
  const genre = params.get('genre') || ''
  const mood = params.get('mood') || ''
  const sort = params.get('sort') || 'newest'

  useEffect(() => {
    api('/api/beats/meta').then(setMeta).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const q = new URLSearchParams({ limit: '24', offset: String(page * 24), sort })
    if (search) q.set('search', search)
    if (genre) q.set('genre', genre)
    if (mood) q.set('mood', mood)
    api(`/api/beats?${q}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [search, genre, mood, sort, page])

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
    setPage(0)
  }

  const pages = Math.ceil(data.total / 24)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-white">Browse beats</h1>
      <p className="text-slate-400 mt-1">Preview and buy exclusive type beats</p>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="Search title, tag, mood…"
            className="input !py-2.5 !pl-9 w-64 text-sm"
          />
        </div>
        <select
          value={genre}
          onChange={(e) => update('genre', e.target.value)}
          className="input !py-2.5 w-44 text-sm"
        >
          <option value="" className="bg-panel">
            All genres
          </option>
          {meta.genres.map((g) => (
            <option key={g} value={g} className="bg-panel">
              {g}
            </option>
          ))}
        </select>
        <select
          value={mood}
          onChange={(e) => update('mood', e.target.value)}
          className="input !py-2.5 w-44 text-sm"
        >
          <option value="" className="bg-panel">
            All moods
          </option>
          {meta.moods.map((m) => (
            <option key={m} value={m} className="bg-panel">
              {m}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => update('sort', e.target.value)}
          className="input !py-2.5 w-48 text-sm md:ml-auto"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-panel">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {(search || genre || mood) && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <span>Filters:</span>
          {search && <span className="badge bg-white/10">“{search}”</span>}
          {genre && <span className="badge bg-white/10">{genre}</span>}
          {mood && <span className="badge bg-white/10">{mood}</span>}
          <button
            onClick={() => {
              setParams({})
              setPage(0)
            }}
            className="text-fuchsia-300 hover:text-fuchsia-200 flex items-center gap-1"
          >
            <Icon name="x" className="w-3.5 h-3.5" /> clear
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-24">
            <Spinner className="w-8 h-8 text-fuchsia-400" />
          </div>
        ) : data.beats.length === 0 ? (
          <EmptyState
            icon="search"
            title="No beats found"
            message="Try a different search, genre or mood."
          />
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">{data.total} beat(s)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {data.beats.map((b) => (
                <BeatCard key={b.id} beat={b} list={data.beats} />
              ))}
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-ghost !px-4 !py-2 text-sm disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {page + 1} of {pages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= pages}
                  className="btn-ghost !px-4 !py-2 text-sm disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
