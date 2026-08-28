import Database from 'better-sqlite3'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const databasePath = process.env.DATABASE_PATH || '.data/vuag.db'
mkdirSync(dirname(databasePath), { recursive: true })
const sqlite = new Database(databasePath)
sqlite.pragma('foreign_keys = ON')
sqlite.exec('CREATE TABLE IF NOT EXISTS __migration (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)')
const directory = join(process.cwd(), 'server/database/migrations')
const applied = new Set(sqlite.prepare('SELECT name FROM __migration').all().map(row => (row as { name: string }).name))

for (const file of readdirSync(directory).filter(file => file.endsWith('.sql')).sort()) {
  if (applied.has(file)) continue
  sqlite.transaction(() => {
    sqlite.exec(readFileSync(join(directory, file), 'utf8'))
    sqlite.prepare('INSERT INTO __migration (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
  })()
}

sqlite.pragma('optimize')
sqlite.close()
console.log(`Migrations applied to ${databasePath}`)
