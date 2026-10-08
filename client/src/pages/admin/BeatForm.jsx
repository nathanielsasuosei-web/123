import { useState } from 'react'
import Icon from '../../icons'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { api } from '../../api'

const EMPTY = {
  title: '',
  producer: '',
  genre: '',
  mood: '',
  bpm: '',
  key: '',
  description: '',
  tags: '',
  price_mp3: '',
  price_wav: '',
  price_exclusive: '',
}

export default function BeatForm({ beat, onClose, onSaved }) {
  const [form, setForm] = useState(
    beat
      ? {
          title: beat.title,
          producer: beat.producer,
          genre: beat.genre,
          mood: beat.mood,
          bpm: beat.bpm || '',
          key: beat.key,
          description: beat.description,
          tags: beat.tags.join(', '),
          price_mp3: beat.prices.mp3,
          price_wav: beat.prices.wav,
          price_exclusive: beat.prices.exclusive,
        }
      : EMPTY
  )
  const [audio, setAudio] = useState(null)
  const [cover, setCover] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!beat && !audio) {
      setError('Please choose an audio file for the beat')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      for (const [k, v] of Object.entries(form)) fd.append(k, v)
      if (audio) fd.append('audio', audio)
      if (cover) fd.append('cover', cover)
      if (beat) await api(`/api/beats/${beat.id}`, { method: 'PUT', body: fd })
      else await api('/api/beats', { method: 'POST', body: fd })
      onSaved?.()
      onClose?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={beat ? `Edit beat — ${beat.title}` : 'Upload a new beat'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={set('title')} className="input" required />
          </div>
          <div>
            <label className="label">Producer</label>
            <input value={form.producer} onChange={set('producer')} className="input" placeholder="MiraKilousE" />
          </div>
          <div>
            <label className="label">Genre</label>
            <input value={form.genre} onChange={set('genre')} className="input" placeholder="Trap, Drill, Afrobeat…" />
          </div>
          <div>
            <label className="label">Mood</label>
            <input value={form.mood} onChange={set('mood')} className="input" placeholder="Dark, Chill, Energetic…" />
          </div>
          <div>
            <label className="label">BPM</label>
            <input type="number" value={form.bpm} onChange={set('bpm')} className="input" placeholder="140" />
          </div>
          <div>
            <label className="label">Musical key</label>
            <input value={form.key} onChange={set('key')} className="input" placeholder="F# Minor" />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            className="input min-h-[80px] resize-y"
            placeholder="Describe the vibe, instruments, suggested use…"
          />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input value={form.tags} onChange={set('tags')} className="input" placeholder="dark, trap, melodic" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">MP3 lease price</label>
            <input type="number" min="0" step="0.01" value={form.price_mp3} onChange={set('price_mp3')} className="input" required />
          </div>
          <div>
            <label className="label">WAV lease price</label>
            <input type="number" min="0" step="0.01" value={form.price_wav} onChange={set('price_wav')} className="input" required />
          </div>
          <div>
            <label className="label">Exclusive price</label>
            <input type="number" min="0" step="0.01" value={form.price_exclusive} onChange={set('price_exclusive')} className="input" required />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Audio file {!beat && '*'}</label>
            <label className="input flex items-center gap-2 cursor-pointer text-slate-400 hover:border-fuchsia-500/50 transition">
              <Icon name="upload" className="w-4 h-4 shrink-0" />
              <span className="truncate">{audio ? audio.name : beat ? 'Replace audio (optional)' : 'Choose MP3 / WAV…'}</span>
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudio(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <label className="label">Cover image</label>
            <label className="input flex items-center gap-2 cursor-pointer text-slate-400 hover:border-fuchsia-500/50 transition">
              <Icon name="upload" className="w-4 h-4 shrink-0" />
              <span className="truncate">{cover ? cover.name : beat ? 'Replace cover (optional)' : 'Choose cover image…'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setCover(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost !px-4 !py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary !px-5 !py-2 text-sm">
            {busy ? <Spinner className="w-4 h-4" /> : <Icon name={beat ? 'check' : 'upload'} className="w-4 h-4" />}
            {beat ? 'Save changes' : 'Upload beat'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
