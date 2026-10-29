import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.get('/api/scenarios', wrap(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, mode, created_at FROM scenarios ORDER BY created_at DESC LIMIT 50');
  res.json(rows);
}));

app.get('/api/scenarios/:id', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM scenarios WHERE id = $1', [req.params.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found.' });
}));

app.post('/api/scenarios', wrap(async (req, res) => {
  const { name, mode, inputs } = req.body;
  if (!name?.trim() || !['new', 'old'].includes(mode) || typeof inputs !== 'object') {
    return res.status(400).json({ error: 'Give the scenario a name and valid inputs.' });
  }
  const { rows } = await pool.query(
    'INSERT INTO scenarios (name, mode, inputs) VALUES ($1, $2, $3) RETURNING id, name, mode, created_at',
    [name.trim().slice(0, 80), mode, inputs]);
  res.status(201).json(rows[0]);
}));

app.delete('/api/scenarios/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM scenarios WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

app.listen(process.env.PORT || 4000, () =>
  console.log(`Server running on http://localhost:${process.env.PORT || 4000}`));
