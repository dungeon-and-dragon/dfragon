import { MALE_CRUSADER_DEALER_SKILL } from '@dfragon/lib'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import { Character, type CharacterRole } from './character-role.js'

// Neople /df/jobs의 프리스트(남) 직업 ID와 그 眞 크루세이더 전직 ID다. 여성 크루세이더는 전직 ID가 같고 직업 ID만 다르다.
const maleCrusaderJob = {
  jobId: 'f6a4ad30555b99b499c07835f87ce522',
  jobGrowId: '37495b941da3b1661bc900e68ef3b2c6'
}

export function isMaleCrusaderJob(job: { jobId?: string; jobGrowId?: string }): boolean {
  return job.jobId === maleCrusaderJob.jobId && job.jobGrowId === maleCrusaderJob.jobGrowId
}

function hasLearned(skillStyle: unknown, skillName: string): boolean {
  if (!isRecord(skillStyle) || !isRecord(skillStyle.style)) {
    return false
  }

  const { active, passive } = skillStyle.style

  return [active, passive].some(
    (skills) =>
      Array.isArray(skills) && skills.some((skill) => isRecord(skill) && skill.name === skillName)
  )
}

// 남성 크루세이더는 스킬 구성으로 딜러와 버퍼를 바꾼다.
export class MaleCrusader extends Character {
  constructor(private readonly learnedDealerSkill: boolean) {
    super()
  }

  static fromSkillStyle(skillStyle: unknown): MaleCrusader {
    return new MaleCrusader(hasLearned(skillStyle, MALE_CRUSADER_DEALER_SKILL))
  }

  role(): CharacterRole {
    if (this.learnedDealerSkill) {
      return 'dealer'
    }

    return 'buffer'
  }
}
