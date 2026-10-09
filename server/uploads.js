import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from './config.js';
import { randomToken } from './lib/util.js';

const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];

/**
 * Upload folders.
 * - private/audio: full beat files. Never served directly; only sent after a paid order.
 * - public/*: covers, previews and videos, served at /media/*.
 */
const folders = {
  audio: path.join(config.dataDir, 'private', 'audio'),
  preview: path.join(config.dataDir, 'public', 'previews'),
  cover: path.join(config.dataDir, 'public', 'covers'),
  video: path.join(config.dataDir, 'public', 'videos'),
};
for (const dir of Object.values(folders)) fs.mkdirSync(dir, { recursive: true });

const rules = {
  audio: AUDIO_EXT,
  preview: AUDIO_EXT,
  cover: IMAGE_EXT,
  video: VIDEO_EXT,
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, folders[file.fieldname]),
    filename: (req, file, cb) => cb(null, randomToken(16) + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 400 * 1024 * 1024, files: 4, fields: 30 },
  fileFilter: (req, file, cb) => {
    const allowed = rules[file.fieldname];
    if (!allowed) return cb(new Error(`Unexpected upload field "${file.fieldname}".`));
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error(`"${file.originalname}" is not a supported file type for ${file.fieldname}.`));
    }
    cb(null, true);
  },
});

/** Returns the path stored in the database, relative to its storage root. */
export function storedPath(file) {
  const root = file.fieldname === 'audio' ? path.join(config.dataDir, 'private') : path.join(config.dataDir, 'public');
  return path.relative(root, file.path).split(path.sep).join('/');
}

export function publicUrl(relPath) {
  return relPath ? `/media/${relPath}` : null;
}

/** Deletes uploaded files, used when a request fails after files were stored. */
export function removeFiles(files = {}) {
  for (const list of Object.values(files)) {
    for (const file of list) fs.rm(file.path, { force: true }, () => {});
  }
}

export function removeStored(relPath, { private: isPrivate = false } = {}) {
  if (!relPath) return;
  const root = isPrivate ? path.join(config.dataDir, 'private') : path.join(config.dataDir, 'public');
  fs.rm(path.join(root, relPath), { force: true }, () => {});
}

export const uploadBeatFiles = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'preview', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

export const uploadVideoFiles = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);
