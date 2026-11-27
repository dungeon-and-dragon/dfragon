import type { DatabaseClient } from './client.js'

export type LabCandidateExclusion = {
  itemName: string
  excludedAt: Date
}

export async function excludeLabCandidate(
  client: DatabaseClient,
  itemName: string
): Promise<{ status: 'excluded' | 'labItem' }> {
  return client.$transaction(async (transaction) => {
    const labItem = await transaction.labItem.findFirst({
      where: { itemName },
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
    await transaction.labCandidate.deleteMany({ where: { itemName } })

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
