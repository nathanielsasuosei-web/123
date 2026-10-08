import { Routes, Route, Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import PlayerBar from './components/PlayerBar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Beats from './pages/Beats'
import BeatDetail from './pages/BeatDetail'
import Videos from './pages/Videos'
import Login from './pages/Login'
import Register from './pages/Register'
import Contact from './pages/Contact'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
      <Footer />
      <PlayerBar />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="beats" element={<Beats />} />
        <Route path="beats/:id" element={<BeatDetail />} />
        <Route path="videos" element={<Videos />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
