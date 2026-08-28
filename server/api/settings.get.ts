import { readSettings } from '../services/settings'
import { apiError } from '../utils/http'

export default defineEventHandler(async () => {
  try {
    return await readSettings()
  } catch (error) {
    return apiError(error)
  }
})
