import { useEffect, useState } from 'react'
import Icon from '../icons'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { api } from '../api'

export default function Videos() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    api('/api/videos')
      .then((d) => setVideos(d.videos))
      .finally(() => setLoading(false))
  }, [])

  const open = (v) => {
    setPlaying(v)
    api(`/api/videos/${v.id}`).catch(() => {})
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold text-white">Videos</h1>
      <p className="text-slate-400 mt-1">Beat videos, visualizers and studio sessions</p>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner className="w-8 h-8 text-fuchsia-400" />
        </div>
      ) : videos.length === 0 ? (
        <EmptyState
          icon="video"
          title="No videos yet"
          message="The producer hasn't uploaded any videos yet. Check back soon!"
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => open(v)}
              className="group glass rounded-2xl overflow-hidden text-left hover:border-violet-500/40 transition"
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={v.videoUrl}
                  poster={v.thumbnailUrl || undefined}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                  <span className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition">
                    <Icon name="play" className="w-6 h-6 text-white" />
                  </span>
                </div>
              </div>
              <div className="p-4">
                <p className="font-semibold text-white">{v.title}</p>
                {v.beatTitle && (
                  <p className="text-xs text-fuchsia-300 mt-0.5">Beat: {v.beatTitle}</p>
                )}
                {v.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{v.description}</p>}
                <p className="text-xs text-slate-500 mt-2">{v.views.toLocaleString()} views</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl glass rounded-2xl overflow-hidden border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="font-semibold text-white truncate">{playing.title}</p>
              <button
                onClick={() => setPlaying(null)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <video src={playing.videoUrl} poster={playing.thumbnailUrl || undefined} controls autoPlay className="w-full aspect-video bg-black" />
          </div>
        </div>
      )}
    </div>
  )
}
