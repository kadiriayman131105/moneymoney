import { readSession } from './auth.js'
import { db, readyToStore } from './db.js'

function clean(body) {
  if (!body || typeof body !== 'object') return null
  if (!Array.isArray(body.moi)) return null
  const nouran = body.nouran
  if (!nouran || typeof nouran !== 'object' || typeof nouran.opening !== 'number' || !Array.isArray(nouran.moves)) return null
  const next = { moi: body.moi, nouran: { opening: nouran.opening, moves: nouran.moves } }
  if (JSON.stringify(next).length > 800000) return null
  return next
}

export default async function handler(request, response) {
  if (!readyToStore()) {
    response.status(503).json({ error: 'offline' })
    return
  }
  if (!readSession(request)) {
    response.status(401).json({ error: 'locked' })
    return
  }
  const sql = await db()
  if (request.method === 'GET') {
    const rows = await sql`select moi, nouran from app_state where id = 1`
    const row = rows[0]
    response.status(200).json(row ? { moi: row.moi, nouran: row.nouran } : { moi: [], nouran: { opening: 0, moves: [] } })
    return
  }
  if (request.method === 'PUT') {
    const next = clean(request.body)
    if (!next) {
      response.status(400).json({ error: 'bad' })
      return
    }
    const moi = JSON.stringify(next.moi)
    const nouran = JSON.stringify(next.nouran)
    await sql`insert into app_state (id, moi, nouran, updated_at)
      values (1, ${moi}::jsonb, ${nouran}::jsonb, now())
      on conflict (id) do update set moi = excluded.moi, nouran = excluded.nouran, updated_at = now()`
    response.status(200).json({ ok: true })
    return
  }
  response.status(405).json({ error: 'method' })
}
