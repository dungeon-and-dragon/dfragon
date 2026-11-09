import type { CharacterCardRole } from './character'
import { formatJobName } from './job-format'
import { maleCrusaderRoleOf, withMaleCrusaderRole } from './male-crusader'

export const SHARED_GROW_JOB_NAMES: readonly string[] = [
  '넨마스터',
  '스트라이커',
  '스트리트파이터',
  '그래플러',
  '레인저',
  '런처',
  '메카닉',
  '스핏파이어',
  '크루세이더',
  '인파이터'
]

const JOB_GENDER_SUFFIX = /\((남|여)\)$/u

type JobNames = Readonly<{ jobName: string | null; jobGrowName: string | null }>

export function displayJobName(
  character: JobNames & { jobGrowName: string },
  role?: CharacterCardRole | null
): string
export function displayJobName(character: JobNames, role?: CharacterCardRole | null): string | null
export function displayJobName(
  character: JobNames,
  role: CharacterCardRole | null = null
): string | null {
  const job = character.jobGrowName ?? character.jobName
  if (job === null) {
    return null
  }

  const name = formatJobName(job)
  const maleCrusaderRole = maleCrusaderRoleOf(character, role)
  if (maleCrusaderRole !== null) {
    return withMaleCrusaderRole(name, maleCrusaderRole)
  }

  const gender = character.jobName?.match(JOB_GENDER_SUFFIX)?.[1]
  const isSharedGrowJob = character.jobGrowName !== null && SHARED_GROW_JOB_NAMES.includes(name)
  if (isSharedGrowJob && gender !== undefined) {
    return `${name} (${gender})`
  }

  return name
}
