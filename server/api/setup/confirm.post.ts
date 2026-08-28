import { readBody } from 'h3'
import { z } from 'zod'
import { initializePortfolio } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  startDate: z.iso.date(),
  acquisitionPrice: z.string().regex(/^\d+(\.\d{1,6})?$/).refine(value => Number(value) > 0),
  priceSource: z.string().min(1).max(200),
  usedCurrentQuote: z.boolean().optional()
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event))
    return await initializePortfolio({
      startDate: input.startDate,
      acquisitionPrice: input.acquisitionPrice,
      priceSource: input.priceSource,
      ...(input.usedCurrentQuote === undefined ? {} : { usedCurrentQuote: input.usedCurrentQuote })
    })
  } catch (error) {
    return apiError(error)
  }
})
