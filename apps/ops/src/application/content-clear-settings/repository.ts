import type { ContentClearSetting, ContentClearSettingChange } from '@dfragon/database'

export interface ContentClearSettingRepository {
  readSettings(): Promise<ContentClearSetting[]>
  change(change: ContentClearSettingChange): Promise<void>
}
