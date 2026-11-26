import { type EnchantRole, enchantGroup, isEmphasizedEnchant } from '#entities/character'
import type { ItemCard } from './item-detail'

const MISSING_STAGE_VALUE = '-'
const ALL_ROLES: readonly EnchantRole[] = ['dealer', 'buffer']

export type CardOptionRow = Readonly<{
  name: string
  values: readonly string[]
  emphasized: boolean
}>

function optionNames(card: ItemCard): string[] {
  const names = card.enchants.flatMap(({ status }) => status.map(({ name }) => name))

  return [...new Set(names)]
}

function stageValue(status: ItemCard['enchants'][number]['status'], name: string): string {
  const option = status.find((candidate) => candidate.name === name)

  if (option === undefined) {
    return MISSING_STAGE_VALUE
  }

  return option.value
}

function rolesOf(role: EnchantRole | undefined): readonly EnchantRole[] {
  if (role === undefined) {
    return ALL_ROLES
  }

  return [role]
}

export function cardOptionRows(card: ItemCard, role: EnchantRole | undefined): CardOptionRow[] {
  const roles = rolesOf(role)

  return optionNames(card).map((name) => {
    const values = card.enchants.map(({ status }) => stageValue(status, name))
    const group = enchantGroup(name)
    const emphasized = roles.some((candidate) => isEmphasizedEnchant(group, candidate))

    return { name, values, emphasized }
  })
}
