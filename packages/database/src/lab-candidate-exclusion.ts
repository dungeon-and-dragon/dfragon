import { labItemBaseName } from '@dfragon/lib/lab-items'
import type { DatabaseClient } from './client.js'
import { VARIANT_GROUPED_KINDS } from './lab-candidate-variant.js'

export type LabCandidateExclusion = {
  itemName: string
  excludedAt: Date
}

export async function excludeLabCandidate(
  client: DatabaseClient,
  itemName: string
): Promise<{ status: 'excluded' | 'labItem' }> {
  return client.$transaction(async (transaction) => {
    const grouped = await transaction.labCandidate.findMany({
      where: { kind: { in: [...VARIANT_GROUPED_KINDS] } },
      select: { itemName: true }
    })

    const variantNames = grouped
      .map((row) => row.itemName)
      .filter((name) => labItemBaseName(name) === itemName)

    const names = [itemName, ...variantNames]
    const labItem = await transaction.labItem.findFirst({
      where: { itemName: { in: names } },
      select: { id: true }
    })

    if (labItem !== null) {
      return { status: 'labItem' }
    }

    const excludedAt = new Date()
    await transaction.labCandidateExclusion.upsert({
      where: { itemName },
      create: { itemName, excludedAt },
      update: {}
    })
    await transaction.labCandidate.deleteMany({ where: { itemName: { in: names } } })

    return { status: 'excluded' }
  })
}

export async function includeLabCandidate(client: DatabaseClient, itemName: string): Promise<void> {
  await client.labCandidateExclusion.deleteMany({ where: { itemName } })
}

export async function readLabCandidateExclusions(
  client: DatabaseClient
): Promise<LabCandidateExclusion[]> {
  return client.labCandidateExclusion.findMany({
    orderBy: [{ excludedAt: 'desc' }, { itemName: 'asc' }]
  })
}
