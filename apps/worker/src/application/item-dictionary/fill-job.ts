import type { ItemDictionaryService } from '@dfragon/server-core/application/item-dictionary/index.js'
import { ITEM_DICTIONARY_SINCE } from '@dfragon/server-core/domain/item-dictionary/index.js'
import { z } from 'zod'
import { defineJob, NEOPLE_APIS } from '#application/jobs/index.js'
import type { AcquisitionItemRepository } from './repository.js'

// 아이템 종류 수를 재지 않았다. 15개씩 묶어 Neople을 부르므로 수천 종이어도 수백 번이라 넉넉히 1시간을 둔다.
const DELAY_MINUTES = 60

export function createItemDictionaryFillJob(
  repository: AcquisitionItemRepository,
  dictionary: Pick<ItemDictionaryService, 'fill'>
) {
  return defineJob({
    name: 'item-dictionary-fill',
    displayName: '아이템 사전 채우기',
    description:
      '중천 시작부터 저장한 레전더리 이상 장비 획득 기록 가운데 아이템 사전에 없는 아이템의 레벨과 종류를 Neople에서 받아 저장합니다. 다시 실행하면 남은 아이템만 받습니다.',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    neopleApi: NEOPLE_APIS.items,
    run: async (_args, { reportProgress }) => {
      const itemIds = await repository.readUnlistedItemIds(ITEM_DICTIONARY_SINCE)
      const fetched = await dictionary.fill(itemIds, reportProgress)

      return { fetched }
    }
  })
}
