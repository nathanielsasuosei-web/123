import Icon from '../icons'

export default function EmptyState({ icon = 'disc', title = 'Nothing here yet', message = '' }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon name={icon} className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {message && <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">{message}</p>}
    </div>
  )
}
