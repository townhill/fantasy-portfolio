import { readBody } from 'h3'
import { z } from 'zod'
import { applyWithdrawal } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  account: z.enum(['ISA', 'GIA']).default('ISA'),
  confirmation: z.literal(true)
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event))
    return await applyWithdrawal(input.amount, input.account)
  } catch (error) {
    return apiError(error)
  }
})
