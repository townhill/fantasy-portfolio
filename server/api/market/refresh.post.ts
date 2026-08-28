import { MarketDataService } from '../../services/market/service'
import { apiError } from '../../utils/http'

export default defineEventHandler(async () => {
  try {
    return await new MarketDataService().getQuote('VUAG.L', true)
  } catch (error) {
    return apiError(error)
  }
})
