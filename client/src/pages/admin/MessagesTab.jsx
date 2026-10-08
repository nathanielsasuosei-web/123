import { useCallback, useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import ChatBox from '../../components/ChatBox'
import { api } from '../../api'
import { formatDate, cn } from '../../utils'

export default function MessagesTab() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)

  const load = useCallback(async () => {
    try {
      const { conversations } = await api('/api/messages/conversations')
      setConversations(conversations)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>

  return (
    <div className="grid md:grid-cols-3 gap-6" style={{ minHeight: '560px' }}>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 font-semibold text-white text-sm">Conversations</div>
        <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition',
                  active?.id === c.id && 'bg-white/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      {c.unread > 0 && (
                        <span className="badge bg-fuchsia-500 text-white text-[10px] !px-1.5 !py-0.5">{c.unread}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{c.lastBody}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(c.lastAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="md:col-span-2">
        {active ? (
          <ChatBox key={active.id} peerId={active.id} height="560px" />
        ) : (
          <div className="h-full glass rounded-2xl flex flex-col items-center justify-center text-center p-8">
            <Icon name="message" className="w-10 h-10 text-slate-600" />
            <p className="text-slate-400 mt-3">Select a conversation to open the chat box.</p>
          </div>
        )}
      </div>
    </div>
  )
}
