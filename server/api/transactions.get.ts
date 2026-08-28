import { getLedger } from '../services/portfolio'
import { apiError } from '../utils/http'

export default defineEventHandler(async () => {
  try {
    return await getLedger()
  } catch (error) {
    return apiError(error)
  }
})
