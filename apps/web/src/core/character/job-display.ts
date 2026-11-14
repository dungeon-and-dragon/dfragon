import type { CharacterCardRole } from './character'
import { formatJobName } from './job-format'
import { maleCrusaderRoleOf, withMaleCrusaderRole } from './male-crusader'

type JobNames = Readonly<{ jobName: string | null; jobGrowName: string | null }>

export type JobLabel = Readonly<{ grow: string; job: string | null }>

export function jobLabelOf(
  character: JobNames & { jobGrowName: string },
  role?: CharacterCardRole | null
): JobLabel
export function jobLabelOf(character: JobNames, role?: CharacterCardRole | null): JobLabel | null
export function jobLabelOf(
  character: JobNames,
  role: CharacterCardRole | null = null
): JobLabel | null {
  const name = character.jobGrowName ?? character.jobName
  if (name === null) {
    return null
  }

  const growName = formatJobName(name)
  const grow = withMaleCrusaderRole(growName, maleCrusaderRoleOf(character, role))
  const { jobName } = character
  const job = character.jobGrowName !== null && jobName !== growName ? jobName : null

  return { grow, job }
}

export function displayJobName(
  character: JobNames & { jobGrowName: string },
  role?: CharacterCardRole | null
): string
export function displayJobName(character: JobNames, role?: CharacterCardRole | null): string | null
export function displayJobName(
  character: JobNames,
  role: CharacterCardRole | null = null
): string | null {
  const label = jobLabelOf(character, role)
  if (label === null) {
    return null
  }

  if (label.job === null) {
    return label.grow
  }

  return `${label.grow} ${label.job}`
}
