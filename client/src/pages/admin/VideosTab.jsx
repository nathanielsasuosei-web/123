import { useCallback, useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import { api } from '../../api'
import { formatDate } from '../../utils'

export default function VideosTab() {
  const [videos, setVideos] = useState([])
  const [beats, setBeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ title: '', description: '', beat_id: '' })
  const [video, setVideo] = useState(null)
  const [thumb, setThumb] = useState(null)

  const load = useCallback(async () => {
    try {
      const [v, b] = await Promise.all([api('/api/videos'), api('/api/beats?limit=100')])
      setVideos(v.videos)
      setBeats(b.beats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!video) {
      setError('Please choose a video file')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('description', form.description)
      if (form.beat_id) fd.append('beat_id', form.beat_id)
      fd.append('video', video)
      if (thumb) fd.append('thumbnail', thumb)
      await api('/api/videos', { method: 'POST', body: fd })
      setForm({ title: '', description: '', beat_id: '' })
      setVideo(null)
      setThumb(null)
      e.target.reset()
      setSuccess('Video uploaded!')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (v) => {
    if (!window.confirm(`Delete video "${v.title}"?`)) return
    await api(`/api/videos/${v.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <div className="lg:col-span-2 card h-fit">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Icon name="upload" className="w-4 h-4 text-fuchsia-300" /> Upload video
        </h3>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">{error}</div>}
          {success && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">{success}</div>}
          <div>
            <label className="label">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input min-h-[70px] resize-y"
            />
          </div>
          <div>
            <label className="label">Link to a beat (optional)</label>
            <select
              value={form.beat_id}
              onChange={(e) => setForm((f) => ({ ...f, beat_id: e.target.value }))}
              className="input"
            >
              <option value="" className="bg-panel">— none —</option>
              {beats.map((b) => (
                <option key={b.id} value={b.id} className="bg-panel">{b.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Video file *</label>
            <label className="input flex items-center gap-2 cursor-pointer text-slate-400 hover:border-fuchsia-500/50 transition">
              <Icon name="video" className="w-4 h-4 shrink-0" />
              <span className="truncate">{video ? video.name : 'Choose MP4 / WebM…'}</span>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <label className="label">Thumbnail (optional)</label>
            <label className="input flex items-center gap-2 cursor-pointer text-slate-400 hover:border-fuchsia-500/50 transition">
              <Icon name="upload" className="w-4 h-4 shrink-0" />
              <span className="truncate">{thumb ? thumb.name : 'Choose image…'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumb(e.target.files?.[0] || null)} />
            </label>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner className="w-4 h-4" /> : <Icon name="upload" className="w-4 h-4" />}
            Upload video
          </button>
        </form>
      </div>

      <div className="lg:col-span-3">
        <h3 className="font-bold text-white mb-4">{videos.length} video(s)</h3>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
        ) : videos.length === 0 ? (
          <EmptyState icon="video" title="No videos yet" message="Upload your first beat video or studio session." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="glass rounded-2xl overflow-hidden">
                <div className="relative aspect-video bg-black">
                  <video src={v.videoUrl} poster={v.thumbnailUrl || undefined} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                </div>
                <div className="p-3">
                  <p className="font-semibold text-white text-sm truncate">{v.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {v.beatTitle ? `Beat: ${v.beatTitle} · ` : ''}{v.views.toLocaleString()} views · {formatDate(v.createdAt)}
                  </p>
                  <button
                    onClick={() => remove(v)}
                    className="mt-2 text-xs text-red-300 hover:text-red-200 flex items-center gap-1"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
