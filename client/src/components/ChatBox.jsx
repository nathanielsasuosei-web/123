import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../icons'
import Spinner from './Spinner'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils'

/**
 * Chat box between an artist and the producer (admin).
 * Artists talk to the producer automatically; admins pass `peerId`.
 */
export default function ChatBox({ peerId, height = '440px' }) {
  const { user } = useAuth()
  const [peer, setPeer] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback(
    async (silent = false) => {
      try {
        const q = user?.role === 'admin' ? `?with=${peerId}` : ''
        const data = await api(`/api/messages/thread${q}`)
        setPeer(data.peer)
        setMessages(data.messages)
        setError('')
      } catch (err) {
        if (!silent) setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [peerId, user?.role]
  )

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 4000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async (e) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setText('')
    setSending(true)
    try {
      const recipientId = user?.role === 'admin' ? peerId : peer?.id
      const { message } = await api('/api/messages', {
        method: 'POST',
        body: { recipientId, body },
      })
      setMessages((m) => [...m, message])
    } catch (err) {
      setText(body)
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Spinner className="w-7 h-7 text-fuchsia-400" />
      </div>
    )
  }

  if (error && !peer) {
    return (
      <div className="flex items-center justify-center text-red-300 text-sm p-6" style={{ height }}>
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col glass rounded-2xl overflow-hidden" style={{ height }}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-white/5">
        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {(peer?.name || '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {peer?.name} {peer?.role === 'admin' ? '(Producer)' : ''}
          </p>
          <p className="text-xs text-slate-400 truncate">{peer?.email}</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            No messages yet — say hello! 👋 You will both get an email when a new message arrives.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  mine
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-br-sm'
                    : 'bg-white/10 text-slate-100 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                  {formatDate(m.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 text-xs text-red-300">{error}</p>}

      <form onSubmit={send} className="p-3 border-t border-white/10 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="input !py-2.5 text-sm flex-1"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="btn-primary !px-4 !py-2.5 disabled:opacity-50"
          aria-label="Send"
        >
          {sending ? <Spinner className="w-4 h-4" /> : <Icon name="send" className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
