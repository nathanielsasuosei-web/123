import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Interactive waveform for an audio URL. Decodes the file with the Web Audio
 * API, draws peak bars on a canvas, and reports clicks/drags as a 0..1 fraction.
 */
export default function Waveform({ url, progress = 0, onSeek, height = 90, className = '' }) {
  const canvasRef = useRef(null)
  const peaksRef = useRef(null)
  const dragRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setFailed(false)
    peaksRef.current = null
    if (!url) return undefined
    const AC = window.AudioContext || window.webkitAudioContext
    const ac = new AC()
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.arrayBuffer()
      })
      .then((ab) => ac.decodeAudioData(ab))
      .then((buf) => {
        if (cancelled) return
        const samples = buf.getChannelData(0)
        const bars = 220
        const step = Math.max(1, Math.floor(samples.length / bars))
        const peaks = []
        for (let i = 0; i < bars; i++) {
          let min = 1
          let max = -1
          const end = Math.min(samples.length, (i + 1) * step)
          for (let j = i * step; j < end; j++) {
            const v = samples[j]
            if (v < min) min = v
            if (v > max) max = v
          }
          peaks.push(Math.max(Math.abs(min), Math.abs(max)))
        }
        peaksRef.current = peaks
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      try {
        ac.close()
      } catch {
        /* ignore */
      }
    }
  }, [url])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const peaks = peaksRef.current
    if (!peaks) return
    const barW = w / peaks.length
    const gap = Math.max(1, barW * 0.28)
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, '#8b5cf6')
    grad.addColorStop(1, '#e879f9')
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barW
      const bh = Math.max(2, peaks[i] * (h - 8))
      const y = (h - bh) / 2
      ctx.fillStyle = i / peaks.length <= progress ? grad : 'rgba(255,255,255,0.16)'
      ctx.fillRect(x, y, Math.max(1, barW - gap), bh)
    }
  }, [progress])

  useEffect(() => {
    draw()
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw, ready])

  const seekFromEvent = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    onSeek?.(frac)
  }

  return (
    <div className={`relative rounded-xl overflow-hidden bg-white/5 ${className}`} style={{ height }}>
      {!ready && !failed && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      {failed && (
        <div className="absolute inset-0 flex items-center px-4">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(e) => onSeek?.(Number(e.target.value))}
            className="w-full"
            aria-label="Seek"
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-pointer"
        style={{ height }}
        onPointerDown={(e) => {
          dragRef.current = true
          e.currentTarget.setPointerCapture?.(e.pointerId)
          seekFromEvent(e)
        }}
        onPointerMove={(e) => {
          if (dragRef.current) seekFromEvent(e)
        }}
        onPointerUp={() => {
          dragRef.current = false
        }}
        onPointerCancel={() => {
          dragRef.current = false
        }}
      />
    </div>
  )
}
