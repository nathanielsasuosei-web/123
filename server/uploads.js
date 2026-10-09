import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from './config.js';
import { randomToken } from './util.js';

const AUDIO = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
const IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO = ['.mp4', '.webm', '.mov', '.m4v'];

// audio → private (never served directly). preview, cover, video → public under /media.
const FOLDERS = {
  audio: path.join(config.dataDir, 'private', 'audio'),
  preview: path.join(config.dataDir, 'public', 'previews'),
  cover: path.join(config.dataDir, 'public', 'covers'),
  video: path.join(config.dataDir, 'public', 'videos'),
};
const RULES = { audio: AUDIO, preview: AUDIO, cover: IMAGE, video: VIDEO };
for (const dir of Object.values(FOLDERS)) fs.mkdirSync(dir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, FOLDERS[file.fieldname]),
    filename: (req, file, cb) => cb(null, randomToken(16) + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 400 * 1024 * 1024, files: 4, fields: 30 },
  fileFilter: (req, file, cb) => {
    const allowed = RULES[file.fieldname];
    if (!allowed) return cb(new Error(`Unexpected upload field "${file.fieldname}".`));
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error(`"${file.originalname}" is not a supported file type for ${file.fieldname}.`));
    }
    cb(null, true);
  },
});

/** Path as stored in the database, relative to its root (private or public). */
export function storedPath(file) {
  const root = file.fieldname === 'audio' ? 'private' : 'public';
  return path.relative(path.join(config.dataDir, root), file.path).split(path.sep).join('/');
}

export const mediaUrl = (rel) => (rel ? `/media/${rel}` : null);

export function removeFiles(files = {}) {
  for (const list of Object.values(files)) for (const f of list) fs.rm(f.path, { force: true }, () => {});
}

export function removeStored(rel, { isPrivate = false } = {}) {
  if (rel) fs.rm(path.join(config.dataDir, isPrivate ? 'private' : 'public', rel), { force: true }, () => {});
}

export const uploadBeat = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'preview', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

export const uploadVideo = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);
