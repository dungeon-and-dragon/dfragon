import {
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_ROLES,
  LAB_ITEM_TIERS,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import { z } from 'zod'

type GroupKeyText = { category: string; role: string; tier: string }

const candidateGroupSchema = z
  .object({
    category: z.enum(LAB_ITEM_CATEGORIES),
    role: z.enum(LAB_ITEM_ROLES),
    tier: z.enum(LAB_ITEM_TIERS),
    itemNames: z.array(z.string().trim().min(1))
  })
  .refine(({ category, role }) => labItemRolesOf(category).includes(role))

const candidateFileSchema = z.object({
  version: z.literal(1),
  groups: z.array(candidateGroupSchema)
})

export type CandidateNames = ReadonlyMap<string, readonly string[]>

export function groupIdOf({ category, role, tier }: GroupKeyText): string {
  return `${category}:${role}:${tier}`
}

export function uniqueNames(names: readonly string[]): string[] {
  return [...new Set(names)]
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function readCandidateFile(text: string): CandidateNames | null {
  const file = candidateFileSchema.safeParse(parseJson(text))

  if (!file.success) {
    return null
  }

  const candidates = new Map<string, string[]>()

  for (const group of file.data.groups) {
    const id = groupIdOf(group)
    const names = [...(candidates.get(id) ?? []), ...group.itemNames]
    candidates.set(id, uniqueNames(names))
  }

  return candidates
}
