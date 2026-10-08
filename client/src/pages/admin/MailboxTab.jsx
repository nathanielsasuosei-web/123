import { useCallback, useEffect, useState } from 'react'
import Icon from '../../icons'
import Spinner from '../../components/Spinner'
import Modal from '../../components/Modal'
import { api } from '../../api'
import { formatDate } from '../../utils'

export default function MailboxTab() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    try {
      const { emails } = await api('/api/admin/mailbox')
      setEmails(emails)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  const open = async (id) => {
    const { email } = await api(`/api/admin/mailbox/${id}`)
    setViewing(email)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">📬 Mailbox</h2>
        <span className="text-xs text-slate-500">
          Demo mode: emails are stored here. Configure SMTP in server/.env to send real emails.
        </span>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-7 h-7 text-fuchsia-400" /></div>
      ) : emails.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No emails yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">To</th>
                <th className="py-2 pr-4 font-medium">Subject</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => open(e.id)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                >
                  <td className="py-2.5 pr-4 text-white">{e.to}</td>
                  <td className="py-2.5 pr-4 text-slate-300">{e.subject}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`badge ${e.status === 'sent' ? 'bg-emerald-500/15 text-emerald-300' : e.status.startsWith('failed') ? 'bg-red-500/15 text-red-300' : 'bg-white/10 text-slate-300'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500 whitespace-nowrap">{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.subject || ''} maxWidth="max-w-3xl">
        {viewing && (
          <div>
            <p className="text-xs text-slate-400 mb-4">
              To: <span className="text-white">{viewing.to}</span> · {formatDate(viewing.createdAt)} · status: {viewing.status}
            </p>
            {viewing.html ? (
              <iframe
                title="email"
                srcDoc={viewing.html}
                className="w-full h-[55vh] rounded-xl bg-white border-0"
                sandbox=""
              />
            ) : (
              <pre className="text-sm text-slate-300 whitespace-pre-wrap bg-white/5 rounded-xl p-4">{viewing.text}</pre>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
