import { clearCookie } from './auth.js'

export default function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method' })
    return
  }
  response.setHeader('Set-Cookie', clearCookie())
  response.status(200).json({ ok: true })
}
