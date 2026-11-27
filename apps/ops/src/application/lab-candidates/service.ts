import type {
  AuctionPriceHistoryEntry,
  LabCandidateInput,
  LabCandidateQuery,
  LabCandidateSummary,
  LabCurrencyIcon
} from '@dfragon/database'
import type { LabItemTier } from '@dfragon/lib/lab-items'
import { OpsFailure } from '#domain/failure.js'
import type { LabCandidateRepository } from './repository.js'

// 운영 화면의 가격 추이 그림에 쓰는 만큼만 낸다.
const PRICE_HISTORY_MAX_COUNT = 200

const RECOMMENDED_TIERS: readonly LabItemTier[] = ['종결', '준종결']

export type LabCandidateBadge = '미조회' | '검색 없음' | '매물 없음'

export type LabCandidateView = LabCandidateSummary & {
  recommendedTier: LabItemTier | null
  badge: LabCandidateBadge | null
}

function badgeOf({ itemId, unitPrice, checkedAt }: LabCandidateSummary): LabCandidateBadge | null {
  if (checkedAt === null) {
    return '미조회'
  }

  if (itemId === null) {
    return '검색 없음'
  }

  if (unitPrice === null) {
    return '매물 없음'
  }

  return null
}

// 명성이 같은 후보는 같은 등급을 받도록 dense rank로 매긴다.
function recommendTiers(candidates: LabCandidateSummary[]): LabCandidateView[] {
  const fames = new Set<number>()

  for (const { fame } of candidates) {
    if (fame !== null) {
      fames.add(fame)
    }
  }

  const ranked = [...fames].sort((left, right) => right - left)

  const tierOf = (fame: number | null): LabItemTier | null => {
    if (fame === null) {
      return null
    }

    const rank = ranked.indexOf(fame)

    if (rank >= RECOMMENDED_TIERS.length) {
      return null
    }

    return RECOMMENDED_TIERS[rank]
  }

  return candidates.map((candidate) => {
    const recommendedTier = tierOf(candidate.fame)
    const badge = badgeOf(candidate)

    return { ...candidate, recommendedTier, badge }
  })
}

export class LabCandidateService {
  constructor(private readonly repository: LabCandidateRepository) {}

  importBatch(snapshotId: string, items: LabCandidateInput[]): Promise<void> {
    const importedAt = new Date()

    return this.repository.upsert({ versionId: snapshotId, importedAt, items })
  }

  async saveIcon(itemName: string, icon: LabCurrencyIcon): Promise<void> {
    const { status } = await this.repository.saveIcon(itemName, icon)

    if (status === 'notFound') {
      throw new OpsFailure('labCandidateNotFound')
    }
  }

  async finish(snapshotId: string): Promise<{ kept: number; pruned: number }> {
    const { remaining, deleted } = await this.repository.deleteOtherVersions(snapshotId)

    if (remaining === 0) {
      throw new OpsFailure('labCandidateSnapshotNotFound')
    }

    return { kept: remaining, pruned: deleted }
  }

  async readCandidates(query: LabCandidateQuery): Promise<LabCandidateView[]> {
    const candidates = await this.repository.readCandidates(query)

    return recommendTiers(candidates)
  }

  async readPriceHistory(itemName: string): Promise<AuctionPriceHistoryEntry[]> {
    const history = await this.repository.readPriceHistory(itemName)

    return history.slice(0, PRICE_HISTORY_MAX_COUNT)
  }

  async readIcon(itemName: string): Promise<LabCurrencyIcon> {
    const icon = await this.repository.readIcon(itemName)

    if (icon === null) {
      throw new OpsFailure('labCandidateIconNotFound')
    }

    return icon
  }
}
