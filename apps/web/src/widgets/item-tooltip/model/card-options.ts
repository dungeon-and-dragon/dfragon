import type { ItemCard } from './item-detail'

const MISSING_STAGE_VALUE = '-'

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

export function cardOptionLines(card: ItemCard): string[] {
  return optionNames(card).map((name) => {
    const values = card.enchants.map(({ status }) => stageValue(status, name))

    if (values.length === 1) {
      return `${name} ${values[0]}`
    }

    return `${name} (${values.join(' / ')})`
  })
}
