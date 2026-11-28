import { z } from 'zod'
import type { ContentClearSettingSummary } from '#application/content-clear-settings/index.js'

export const changeBody = z
  .object({
    collected: z.boolean().optional(),
    shown: z.boolean().optional(),
    scoreBandMinPopulation: z.int32().nonnegative().optional()
  })
  .strict()
  .refine(
    ({ collected, shown, scoreBandMinPopulation }) =>
      collected !== undefined || shown !== undefined || scoreBandMinPopulation !== undefined
  )

export type ChangeBody = z.infer<typeof changeBody>

export type ContentClearSettingListResponse = {
  contents: ContentClearSettingSummary[]
}

export function toContentClearSettingListResponse(
  contents: readonly ContentClearSettingSummary[]
): ContentClearSettingListResponse {
  return { contents: [...contents] }
}
