import type { CharacterCardRole } from '#entities/character/model/character'
import {
  MALE_CRUSADER_ROLE_LABELS,
  maleCrusaderRoleOf
} from '#entities/character/model/male-crusader'
import { formatJobName } from './job-format'
import { RANKING_JOBS } from './ranking-jobs'

type JobNames = Readonly<{ jobName: string | null; jobGrowName: string | null }>

const JOB_GENDER_SUFFIX = /\(([남여])\)$/u
const MALE_JOB_SUFFIX = '(남)'
const FEMALE_JOB_SUFFIX = '(여)'

function isSharedGrowName(growName: string): boolean {
  const jobs = RANKING_JOBS.filter(({ grows }) => grows.some(({ name }) => name === growName))

  return (
    jobs.some(({ name }) => name.endsWith(MALE_JOB_SUFFIX)) &&
    jobs.some(({ name }) => name.endsWith(FEMALE_JOB_SUFFIX))
  )
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
  const { jobName, jobGrowName } = character
  const name = jobGrowName ?? jobName

  if (name === null) {
    return null
  }

  const growName = formatJobName(name)
  const gender = jobName?.match(JOB_GENDER_SUFFIX)?.[1]

  if (
    jobGrowName === null ||
    jobName === growName ||
    gender === undefined ||
    !isSharedGrowName(growName)
  ) {
    return growName
  }

  const crusaderRole = maleCrusaderRoleOf(character, role)
  const suffix =
    crusaderRole !== null ? `${gender}, ${MALE_CRUSADER_ROLE_LABELS[crusaderRole]}` : gender

  return `${growName}(${suffix})`
}
