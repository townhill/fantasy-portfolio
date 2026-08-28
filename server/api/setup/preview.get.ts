import { getQuery } from 'h3'
import { z } from 'zod'
import { setupPreview } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  startDate: z.iso.date().optional(),
  manualPrice: z.string().regex(/^\d+(\.\d{1,6})?$/).optional()
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, getQuery(event))
    return await setupPreview(input.startDate, input.manualPrice)
  } catch (error) {
    return apiError(error)
  }
})
