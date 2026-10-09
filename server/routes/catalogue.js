import { Router } from 'express';
import { q } from '../db.js';
import { toBeatDto, toVideoDto, wrap, str } from '../lib/http.js';

export const beatsRouter = Router();
export const videosRouter = Router();

const SORTS = {
  new: 'created_at DESC, id DESC',
  popular: 'plays DESC, id DESC',
  price_asc: 'price_mp3 ASC',
  price_desc: 'price_mp3 DESC',
  bpm: 'bpm ASC',
};

beatsRouter.get('/', wrap(async (req, res) => {
  const search = str(req.query.q, 100);
  const genre = str(req.query.genre, 60);
  const sort = SORTS[req.query.sort] ? req.query.sort : 'new';
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 12;

  const where = ['published = 1'];
  const params = [];
  if (search) {
    where.push('(title LIKE ? OR tags LIKE ? OR genre LIKE ? OR mood LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (genre) {
    where.push('genre = ?');
    params.push(genre);
  }
  const whereSql = where.join(' AND ');

  const total = q.get(`SELECT COUNT(*) AS n FROM beats WHERE ${whereSql}`, ...params).n;
  const rows = q.all(
    `SELECT * FROM beats WHERE ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit,
  );
  const genres = q.all("SELECT DISTINCT genre FROM beats WHERE published = 1 AND genre <> '' ORDER BY genre").map((r) => r.genre);

  res.json({
    items: rows.map((r) => toBeatDto(r)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    genres,
  });
}));

beatsRouter.get('/:slug', wrap(async (req, res) => {
  const row = q.get('SELECT * FROM beats WHERE slug = ? AND published = 1', req.params.slug);
  if (!row) return res.status(404).json({ error: 'Beat not found.' });
  const related = q.all(
    'SELECT * FROM beats WHERE published = 1 AND id <> ? AND genre = ? ORDER BY plays DESC LIMIT 4',
    row.id,
    row.genre,
  );
  res.json({ beat: toBeatDto(row), related: related.map((r) => toBeatDto(r)) });
}));

beatsRouter.post('/:slug/play', wrap(async (req, res) => {
  q.run('UPDATE beats SET plays = plays + 1 WHERE slug = ? AND published = 1', req.params.slug);
  res.json({ ok: true });
}));

videosRouter.get('/', wrap(async (req, res) => {
  const rows = q.all('SELECT * FROM videos WHERE published = 1 ORDER BY created_at DESC, id DESC');
  res.json({ items: rows.map(toVideoDto) });
}));

videosRouter.post('/:id/view', wrap(async (req, res) => {
  q.run('UPDATE videos SET views = views + 1 WHERE id = ? AND published = 1', req.params.id);
  res.json({ ok: true });
}));
