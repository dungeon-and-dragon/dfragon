import { z } from 'zod'
import { characterSetsShape, storedCharacterSchema } from '#entities/ranking/@x/adventure-guild'
import { clearKind } from '#entities/character/@x/adventure-guild'

const clearNameSchema = z.object({ kind: clearKind, name: z.string() })

export const adventureWeeklySchema = z.object({
  adventureName: z.string(),
  clearNames: z.array(clearNameSchema),
  characters: z.array(
    storedCharacterSchema.extend({ ...characterSetsShape, weeklyClears: z.array(clearNameSchema) })
  )
})

export type ClearName = z.infer<typeof clearNameSchema>
export type AdventureWeekly = z.infer<typeof adventureWeeklySchema>
export type WeeklyCharacter = AdventureWeekly['characters'][number]
