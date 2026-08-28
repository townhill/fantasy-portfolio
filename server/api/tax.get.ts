import { getEriRecords, getTaxYearSummary } from '../services/portfolio'
import { apiError } from '../utils/http'

export default defineEventHandler(async () => {
  try {
    const [years, eriRecords] = await Promise.all([getTaxYearSummary(), getEriRecords()])
    return { years, eriRecords }
  } catch (error) {
    return apiError(error)
  }
})
