import { getQuery } from 'h3'
import { z } from 'zod'
import { getPerformance } from '../services/portfolio'
import { apiError, parseWithZod } from '../utils/http'

const schema = z.object({
  range: z.enum(['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL']).default('ALL')
})

export default defineEventHandler(async event => {
  try {
    const { range } = parseWithZod(schema, getQuery(event))
    return await getPerformance(range)
  } catch (error) {
    return apiError(error)
  }
})
