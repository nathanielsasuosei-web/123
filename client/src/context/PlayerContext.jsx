import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  if (!audioRef.current) audioRef.current = new Audio()
  const audio = audioRef.current

  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)

  // refs so event handlers never see stale state
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  queueRef.current = queue
  indexRef.current = index

  const current = index >= 0 && queue[index] ? queue[index] : null

  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnd = () => {
      const qi = indexRef.current
      const q = queueRef.current
      if (qi + 1 < q.length) {
        setIndex(qi + 1)
        audio.src = q[qi + 1].audioUrl
        audio.play().catch(() => {})
      } else {
        setIsPlaying(false)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [audio])

  const playQueue = useCallback(
    (list, startIndex = 0) => {
      if (!list?.length) return
      const i = Math.min(Math.max(0, startIndex), list.length - 1)
      setQueue(list)
      setIndex(i)
      audio.src = list[i].audioUrl
      audio.currentTime = 0
      audio.play().catch(() => {})
    },
    [audio]
  )

  const playBeat = useCallback(
    (beat, list) => {
      if (!beat) return
      if (list && list.length) {
        const i = list.findIndex((b) => b.id === beat.id)
        playQueue(list, i >= 0 ? i : 0)
      } else {
        playQueue([beat], 0)
      }
    },
    [playQueue]
  )

  const toggle = useCallback(() => {
    if (!current) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [audio, current])

  const seek = useCallback(
    (frac) => {
      if (duration > 0) audio.currentTime = Math.min(duration - 0.05, Math.max(0, frac * duration))
    },
    [audio, duration]
  )

  const seekTo = useCallback(
    (t) => {
      audio.currentTime = Math.max(0, t)
    },
    [audio]
  )

  const next = useCallback(() => {
    const qi = indexRef.current
    const q = queueRef.current
    if (qi + 1 < q.length) {
      setIndex(qi + 1)
      audio.src = q[qi + 1].audioUrl
      audio.play().catch(() => {})
    }
  }, [audio])

  const prev = useCallback(() => {
    const qi = indexRef.current
    const q = queueRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (qi - 1 >= 0) {
      setIndex(qi - 1)
      audio.src = q[qi - 1].audioUrl
      audio.play().catch(() => {})
    }
  }, [audio])

  const setVolume = useCallback(
    (v) => {
      audio.volume = v
      setVolumeState(v)
    },
    [audio]
  )

  return (
    <PlayerContext.Provider
      value={{
        queue,
        index,
        current,
        isPlaying,
        currentTime,
        duration,
        volume,
        playBeat,
        playQueue,
        toggle,
        seek,
        seekTo,
        next,
        prev,
        setVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
