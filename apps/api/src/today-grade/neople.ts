import { type NeopleClient, NeopleRequestFailure } from '@dfragon/neople'
import { forwardCause } from '../error-chain.js'
import { TodayGradeFailure } from './errors.js'

export type FetchShopGrade = (itemId: string, signal: AbortSignal) => Promise<number>

export function createNeopleShopGrade(neople: NeopleClient): FetchShopGrade {
  return async (itemId, signal) => {
    try {
      const { itemGradeValue } = await neople.itemShop(itemId, signal)
      if (itemGradeValue < 0 || itemGradeValue > 100) {
        throw new TodayGradeFailure('api')
      }

      return itemGradeValue
    } catch (error) {
      if (error instanceof TodayGradeFailure) {
        throw error
      }

      if (error instanceof NeopleRequestFailure) {
        throw new TodayGradeFailure(error.kind, forwardCause(error))
      }
      throw new TodayGradeFailure('api', { cause: error })
    }
  }
}
