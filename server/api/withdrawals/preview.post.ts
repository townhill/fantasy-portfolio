import { readBody } from 'h3'
import { z } from 'zod'
import { previewWithdrawal } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  account: z.enum(['ISA', 'GIA']).default('ISA')
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event) ?? {})
    return await previewWithdrawal(input.amount, input.account)
  } catch (error) {
    return apiError(error)
  }
})
