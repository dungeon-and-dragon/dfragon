import { z } from 'zod'
import { storedCharacterSchema } from '../ranking/ranking-stats'
import { clearKind } from '../character/character-timeline'

const clearNameSchema = z.object({ kind: clearKind, name: z.string() })

export const adventureWeeklySchema = z.object({
  adventureName: z.string(),
  clearNames: z.array(clearNameSchema),
  characters: z.array(storedCharacterSchema.extend({ weeklyClears: z.array(clearNameSchema) }))
})

export type ClearName = z.infer<typeof clearNameSchema>
export type AdventureWeekly = z.infer<typeof adventureWeeklySchema>
export type WeeklyCharacter = AdventureWeekly['characters'][number]
