import { z } from 'zod'
import type { ContentClearSettingSummary } from '#application/content-clear-settings/index.js'

export const changeBody = z
  .object({ collected: z.boolean().optional(), shown: z.boolean().optional() })
  .strict()
  .refine(({ collected, shown }) => collected !== undefined || shown !== undefined)

export type ChangeBody = z.infer<typeof changeBody>

export type ContentClearSettingListResponse = {
  contents: ContentClearSettingSummary[]
}

export function toContentClearSettingListResponse(
  contents: readonly ContentClearSettingSummary[]
): ContentClearSettingListResponse {
  return { contents: [...contents] }
}
