import './src/env.js'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { uploadsDir } from './src/upload.js'
import authRoutes from './src/routes/auth.js'
import beatsRoutes from './src/routes/beats.js'
import videosRoutes from './src/routes/videos.js'
import ordersRoutes from './src/routes/orders.js'
import messagesRoutes from './src/routes/messages.js'
import adminRoutes from './src/routes/admin.js'
import miscRoutes from './src/routes/misc.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 4000)

const app = express()

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: true }))
app.use(morgan('dev'))
app.use(express.json({ limit: '2mb' }))

// Uploaded media (beats, covers, videos, thumbnails)
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', fallthrough: true }))

// API
app.use('/api/auth', authRoutes)
app.use('/api/beats', beatsRoutes)
app.use('/api/videos', videosRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', miscRoutes)

// Serve the built client (production) if it exists
app.get('/', (req, res) => {
  res.json({ ok: true, name: 'MiraKilousE Beats API', docs: '/api/health' })
})

const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// JSON 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err)
  if (res.headersSent) return next(err)
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎧 MiraKilousE Beats API running at http://0.0.0.0:${PORT}`)
  console.log(`   Uploads served from ${uploadsDir}\n`)
})
