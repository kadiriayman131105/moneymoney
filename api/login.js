import { passwordOk, sessionCookie } from './auth.js'
import { readyToStore } from './db.js'

export default function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method' })
    return
  }
  if (!readyToStore()) {
    response.status(503).json({ error: 'offline' })
    return
  }
  const password = request.body?.password
  if (!passwordOk(password)) {
    response.status(401).json({ error: 'bad' })
    return
  }
  response.setHeader('Set-Cookie', sessionCookie(Boolean(request.body?.remember)))
  response.status(200).json({ ok: true })
}
