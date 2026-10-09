import { config } from '../config.js';
import { publicUrl } from '../uploads.js';

/** Express 4 does not catch promise rejections, so wrap async handlers. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Trimmed string from form/JSON input, capped in length. */
export function str(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export function toBeatDto(row, { includeAdminFields = false } = {}) {
  const dto = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    genre: row.genre,
    mood: row.mood,
    bpm: row.bpm,
    key: row.musical_key,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    description: row.description,
    prices: { mp3: row.price_mp3, wav: row.price_wav, exclusive: row.price_exclusive },
    coverUrl: publicUrl(row.cover_path),
    previewUrl: publicUrl(row.preview_path),
    plays: row.plays,
    published: !!row.published,
    createdAt: row.created_at,
  };
  if (includeAdminFields) {
    dto.audioName = row.audio_name;
    dto.audioSize = row.audio_size;
    dto.coverPath = row.cover_path;
    dto.previewPath = row.preview_path;
  }
  return dto;
}

export function toVideoDto(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: publicUrl(row.file_path),
    coverUrl: publicUrl(row.cover_path),
    youtubeUrl: row.youtube_url,
    beatId: row.beat_id,
    published: !!row.published,
    views: row.views,
    createdAt: row.created_at,
  };
}

export function toUserDto(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export const paymentDetails = () => ({
  momo: config.momo.number ? config.momo : null,
  bank: config.bank.accountNumber ? config.bank : null,
});
