import { isRecord } from '@dfragon/lib/utils/shape-check'
import { Character, type CharacterRole } from './character.js'

const dealerSkill = '용기의 은총'

// 남성 크루세이더는 스킬 구성으로 딜러와 버퍼를 바꾼다.
export class MaleCrusader extends Character {
  constructor(private readonly skillStyle: unknown) {
    super()
  }

  role(): CharacterRole {
    if (this.hasLearned(dealerSkill)) {
      return 'dealer'
    }

    return 'buffer'
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
