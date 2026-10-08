import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
export const uploadsDir = path.join(here, '..', 'uploads')
for (const d of ['beats', 'covers', 'videos', 'thumbs']) {
  fs.mkdirSync(path.join(uploadsDir, d), { recursive: true })
}

export function filePath(sub, name) {
  return path.join(uploadsDir, sub, name)
}

export function removeFile(sub, name) {
  if (!name) return
  try {
    fs.unlinkSync(filePath(sub, name))
  } catch {
    /* already gone */
  }
}

const EXT_OK = {
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.opus'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'],
  video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv'],
}

function filterFor(kind) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const mimeOk =
      (kind === 'audio' && /^audio\//.test(file.mimetype)) ||
      (kind === 'image' && /^image\//.test(file.mimetype)) ||
      (kind === 'video' && /^video\//.test(file.mimetype))
    if (mimeOk || EXT_OK[kind].includes(ext)) cb(null, true)
    else cb(new Error(`Unsupported file type for ${file.fieldname}: ${file.mimetype || ext}`))
  }
}

function makeStorage() {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const sub =
        file.fieldname === 'audio' || file.fieldname === 'beatAudio'
          ? 'beats'
          : file.fieldname === 'video'
            ? 'videos'
            : file.fieldname === 'thumbnail'
              ? 'thumbs'
              : 'covers'
      cb(null, path.join(uploadsDir, sub))
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin'
      cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
    },
  })
}

const storage = makeStorage()

export const beatUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'audio') return filterFor('audio')(req, file, cb)
    if (file.fieldname === 'cover') return filterFor('image')(req, file, cb)
    cb(null, true)
  },
})

export const videoUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') return filterFor('video')(req, file, cb)
    if (file.fieldname === 'thumbnail') return filterFor('image')(req, file, cb)
    cb(null, true)
  },
})
