import {
  type ContentClearSetting,
  type ContentClearSettingChange,
  type DatabaseClient,
  changeContentClearSetting,
  readContentClearSettings
} from '@dfragon/database'
import type { ContentClearSettingRepository } from '#application/content-clear-settings/repository.js'

export class DatabaseContentClearSettingRepository implements ContentClearSettingRepository {
  constructor(private readonly client: DatabaseClient) {}

  readSettings(): Promise<ContentClearSetting[]> {
    return readContentClearSettings(this.client)
  }

  async change(change: ContentClearSettingChange): Promise<void> {
    await changeContentClearSetting(this.client, change)
  }
}
