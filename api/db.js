import { neon } from '@neondatabase/serverless'

export function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || ''
}

export function readyToStore() {
  return Boolean(databaseUrl() && process.env.APP_PASSWORD)
}

let ready = false

export async function db() {
  const sql = neon(databaseUrl())
  if (!ready) {
    await sql`create table if not exists app_state (
      id integer primary key,
      moi jsonb not null,
      nouran jsonb not null,
      updated_at timestamptz not null default now()
    )`
    ready = true
  }
  return sql
}
