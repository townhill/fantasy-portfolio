import { getQuery } from 'h3'
import { apiError } from '../utils/http'
import { getPortfolioSnapshot } from '../services/portfolio'

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event)
    return await getPortfolioSnapshot(query.refresh === 'true')
  } catch (error) {
    return apiError(error)
  }
})
