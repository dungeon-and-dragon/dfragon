import { MALE_CRUSADER_DEALER_SKILL } from '@dfragon/lib'
import { Prisma } from './generated/prisma/client.js'

export type MaleCrusaderRole = 'dealer' | 'buffer'

const dealerSkillContainment = JSON.stringify([{ name: MALE_CRUSADER_DEALER_SKILL }])

export function learnedDealerSkillSql(skills: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${skills} @> ${dealerSkillContainment}::jsonb`
}

// 스킬 스타일 행이 없어 learnedDealerSkill이 NULL이면 비교도 NULL이라 어느 역할로도 고르지 않는다.
export function maleCrusaderRoleSql(
  learnedDealerSkill: Prisma.Sql,
  role: MaleCrusaderRole
): Prisma.Sql {
  return Prisma.sql`(${learnedDealerSkill}) = ${role === 'dealer'}`
}
