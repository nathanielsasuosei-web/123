import { Link } from 'react-router-dom'
import Icon from '../icons'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <Icon name="disc" className="w-16 h-16 text-fuchsia-400 animate-floaty" />
      <h1 className="text-6xl font-black gradient-text mt-6">404</h1>
      <p className="text-slate-400 mt-3">This page dropped out of the mix.</p>
      <Link to="/" className="btn-primary mt-8">
        <Icon name="home" className="w-4 h-4" /> Back home
      </Link>
    </div>
  )
}
