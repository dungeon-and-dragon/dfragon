export interface LabCandidateWearCountRepository {
  replaceWearCounts(computedAt: Date): Promise<number>
}
