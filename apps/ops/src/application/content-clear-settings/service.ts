import type { ContentClearSettingChange } from '@dfragon/database'
import {
  CLEAR_CONTENT_CATALOG,
  type ClearContentCatalogEntry
} from '@dfragon/lib/content-clear-catalog'
import { OpsFailure } from '#domain/failure.js'
import type { ContentClearSettingRepository } from './repository.js'

export type ContentClearSettingSummary = ClearContentCatalogEntry & {
  collected: boolean
  shown: boolean
  scoreBandMinPopulation: number
}

export class ContentClearSettingService {
  constructor(private readonly repository: ContentClearSettingRepository) {}

  // 설정 행이 없는 컨텐츠는 수집과 노출이 모두 켜져 있고 점수 구간을 묶지 않는 것으로 본다.
  async readSettings(): Promise<ContentClearSettingSummary[]> {
    const settings = await this.repository.readSettings()

    return CLEAR_CONTENT_CATALOG.map((content) => {
      const setting = settings.find(({ contentId }) => contentId === content.id)
      const collected = setting?.collected ?? true
      const shown = setting?.shown ?? true
      const scoreBandMinPopulation = setting?.scoreBandMinPopulation ?? 0

      return { ...content, collected, shown, scoreBandMinPopulation }
    })
  }

  async change(change: ContentClearSettingChange): Promise<void> {
    if (!CLEAR_CONTENT_CATALOG.some(({ id }) => id === change.contentId)) {
      throw new OpsFailure('contentClearNotFound')
    }

    await this.repository.change(change)
  }
}
