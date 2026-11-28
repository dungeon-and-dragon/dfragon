import type { DatabaseClient } from './client.js'

export type ContentClearSetting = {
  contentId: string
  collected: boolean
  shown: boolean
  updatedAt: Date
}

export type ContentClearSettingChange = {
  contentId: string
  collected?: boolean
  shown?: boolean
}

export function readContentClearSettings(client: DatabaseClient): Promise<ContentClearSetting[]> {
  return client.contentClearSetting.findMany({ orderBy: { contentId: 'asc' } })
}

// 행이 없는 컨텐츠는 수집과 노출이 모두 켜진 것으로 보므로, 처음 바꿀 때 바꾸지 않은 쪽은 켠 채로 만든다.
export function changeContentClearSetting(
  client: DatabaseClient,
  { contentId, collected, shown }: ContentClearSettingChange
): Promise<ContentClearSetting> {
  const updatedAt = new Date()

  return client.contentClearSetting.upsert({
    where: { contentId },
    create: { contentId, collected: collected ?? true, shown: shown ?? true, updatedAt },
    update: { collected, shown, updatedAt }
  })
}
