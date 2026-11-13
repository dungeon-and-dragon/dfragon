import { NeopleRequestFailure } from '@dfragon/neople'
import { createCatalogService } from '../application/character-catalog/service.js'
import type {
  ScoreCalculationJobDependencies,
  ScoreSourceEvents,
  ScoreSources
} from '../application/character-score/ports.js'
import { createNeopleCatalog } from '../infrastructure/neople/character-catalog.js'
import type { WorkerNeople } from '../infrastructure/neople/character-collection.js'
import { createNeopleCharacterDetails } from '../infrastructure/neople/character-detail.js'
import { createScoreEngine } from '../infrastructure/score/engine.js'

type ScoreNeople = Pick<WorkerNeople, 'character' | 'multiItems'>

export function createScoreSources(
  neople: ScoreNeople,
  { onRequest, onItemLookupUnavailable }: ScoreSourceEvents
): ScoreSources {
  const counted: ScoreNeople = {
    character: (identity, section, signal) => {
      onRequest()

      return neople.character(identity, section, signal)
    },
    multiItems: async (itemIds, signal) => {
      onRequest()

      try {
        return await neople.multiItems(itemIds, signal)
      } catch (error) {
        // 공용 아이템 조회는 실패를 삼키고 아이템을 빈 채로 두므로, 일시 실패인지는 여기서만 알 수 있다.
        if (
          error instanceof NeopleRequestFailure &&
          (error.kind === 'unavailable' || error.kind === 'timeout')
        ) {
          onItemLookupUnavailable()
        }

        throw error
      }
    }
  }

  const fetchDetails = createNeopleCharacterDetails(counted)
  const catalog = createCatalogService(createNeopleCatalog(counted))

  return { fetchDetails, catalog }
}

/** 엔진 worker는 실행마다 띄우고 닫아, 점수 계산을 하지 않는 동안 worker 프로세스에 남지 않는다. */
export function createScoreEngineOpener(
  libraryPath: string | null,
  report: (code: string) => void
): ScoreCalculationJobDependencies['openEngine'] {
  return () => {
    if (libraryPath === null) {
      return null
    }

    return createScoreEngine({ path: libraryPath, report })
  }
}
