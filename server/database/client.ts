import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as schema from './schema'

let connection: Database.Database | null = null
let database: ReturnType<typeof drizzle<typeof schema>> | null = null

function migrationDirectory() {
  return join(process.cwd(), 'server/database/migrations')
}

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __migration (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
  const applied = new Set(
    sqlite.prepare('SELECT name FROM __migration').all().map(row => (row as { name: string }).name)
  )
  const directory = migrationDirectory()
  let files: string[] = []
  try {
    files = readdirSync(directory).filter(file => file.endsWith('.sql')).sort()
  } catch {
    return
  }
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(directory, file), 'utf8')
    sqlite.transaction(() => {
      sqlite.exec(sql)
      sqlite.prepare('INSERT INTO __migration (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
    })()
  }
  sqlite.pragma('optimize')
}

export function getDatabase(path?: string) {
  if (database) return database
  const config = useRuntimeConfig()
  // Nuxt runtimeConfig is normally overridden with NUXT_DATABASE_PATH. Keep
  // DATABASE_PATH as an explicit fallback for the CLI migration script and
  // conventional container deployments.
  const databasePath = path || process.env.DATABASE_PATH || String(config.databasePath)
  mkdirSync(dirname(databasePath), { recursive: true })
  connection = new Database(databasePath)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.pragma('busy_timeout = 5000')
  runMigrations(connection)
  database = drizzle(connection, { schema })
  return database
}

export function getSqlite() {
  getDatabase()
  if (!connection) throw new Error('Database connection is unavailable')
  return connection
}

export function closeDatabaseForTests() {
  connection?.close()
  connection = null
  database = null
}
