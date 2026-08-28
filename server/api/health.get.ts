import { getDatabase } from '../database/client'
import { ensureApplicationDefaults } from '../services/settings'

export default defineEventHandler(async () => {
  await ensureApplicationDefaults()
  getDatabase()
  return { ok: true, service: 'vuag-portfolio', time: new Date().toISOString() }
})
