import { z } from 'zod'
import type { CharacterCardRole } from './character'
import { formatJobName } from './job-format'

export const maleCrusaderRoleSchema = z.enum(['dealer', 'buffer'])

export type MaleCrusaderRole = z.infer<typeof maleCrusaderRoleSchema>

// Neople /df/jobs의 프리스트(남) 직업 ID와 그 眞 크루세이더 전직 ID다. API는 이 전직에서만 role query를 받는다.
export const MALE_CRUSADER_JOB = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
} as const

// API가 딜러로 판정하는 스킬이다. 딜러 표본에서는 늘 100%, 버퍼 표본에서는 늘 0%라 채택률을 보이지 않는다.
export const MALE_CRUSADER_DEALER_SKILL = '용기의 은총'

export const MALE_CRUSADER_ROLE_LABELS: Readonly<Record<MaleCrusaderRole, string>> = {
  dealer: '딜러',
  buffer: '버퍼'
}

const MALE_PRIEST = '프리스트(남)'
const CRUSADER = '크루세이더'

type JobNames = Readonly<{ jobName: string | null; jobGrowName: string | null }>

export function isMaleCrusaderJob(job: Readonly<{ jobId?: string; jobGrowId?: string }>): boolean {
  return job.jobId === MALE_CRUSADER_JOB.jobId && job.jobGrowId === MALE_CRUSADER_JOB.jobGrowId
}

export function maleCrusaderRoleOf(
  { jobName, jobGrowName }: JobNames,
  role: CharacterCardRole | null
): MaleCrusaderRole | null {
  const isMaleCrusader =
    jobName === MALE_PRIEST && jobGrowName !== null && formatJobName(jobGrowName) === CRUSADER
  if (!isMaleCrusader || (role !== 'dealer' && role !== 'buffer')) {
    return null
  }

  return role
}

export function withMaleCrusaderRole(name: string, role: MaleCrusaderRole | null): string {
  if (role === null) {
    return name
  }

  return `${name}(${MALE_CRUSADER_ROLE_LABELS[role]})`
}
