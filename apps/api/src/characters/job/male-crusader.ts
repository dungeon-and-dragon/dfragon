import { isRecord } from '@dfragon/lib/utils/shape-check'
import { CharacterJob } from './character-job.js'

const dealerSkill = '용기의 은총'

// 남성 크루세이더는 스킬 구성으로 딜러와 버퍼를 바꾼다.
export class MaleCrusader extends CharacterJob {
  constructor(private readonly skillStyle: unknown) {
    super()
  }

  isDealer(): boolean {
    return this.hasLearned(dealerSkill)
  }

  private hasLearned(skillName: string): boolean {
    if (!isRecord(this.skillStyle) || !isRecord(this.skillStyle.style)) {
      return false
    }

    const { active, passive } = this.skillStyle.style

    return [active, passive].some(
      (skills) =>
        Array.isArray(skills) && skills.some((skill) => isRecord(skill) && skill.name === skillName)
    )
  }
}
