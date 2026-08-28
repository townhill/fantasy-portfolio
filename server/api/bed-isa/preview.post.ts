import { readBody } from 'h3'
import { z } from 'zod'
import { previewBedIsa } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  date: z.iso.date().optional()
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event) ?? {})
    return await previewBedIsa(input.amount, input.date)
  } catch (error) {
    return apiError(error)
  }
})
