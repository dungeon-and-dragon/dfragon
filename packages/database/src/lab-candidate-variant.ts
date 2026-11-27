import { labItemBaseName } from '@dfragon/lib/lab-items'

// 오라와 마법부여 카드에는 플래티넘, 레벨 변형이 없어 이름마다 한 줄로 둔다.
export const VARIANT_GROUPED_KINDS: readonly string[] = ['TITLE', 'CREATURE']

const PLATINUM = '플래티넘'

export function isVariantGroupedKind(kind: string): boolean {
  return VARIANT_GROUPED_KINDS.includes(kind)
}

// 기본 이름 줄이 없는 묶음도 명성, 옵션 같은 값을 정할 줄 하나가 필요해, 기본 이름 줄, 플래티넘이 아닌 변형, 플래티넘 변형 순으로 고른다.
function representativeRank(itemName: string, baseName: string): number {
  if (itemName === baseName) {
    return 0
  }

  if (!itemName.includes(PLATINUM)) {
    return 1
  }

  return 2
}

export function compareVariants(baseName: string, left: string, right: string): number {
  const rank = representativeRank(left, baseName) - representativeRank(right, baseName)

  if (rank !== 0) {
    return rank
  }

  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

export function representativeOf<Row extends { itemName: string }>(
  baseName: string,
  rows: readonly Row[]
): Row {
  const sorted = [...rows].sort((left, right) =>
    compareVariants(baseName, left.itemName, right.itemName)
  )

  return sorted[0]
}

export function groupByBaseName<Row extends { itemName: string }>(
  rows: readonly Row[]
): Map<string, Row[]> {
  const groups = new Map<string, Row[]>()

  for (const row of rows) {
    const baseName = labItemBaseName(row.itemName)
    const group = groups.get(baseName)

    if (group === undefined) {
      groups.set(baseName, [row])
    } else {
      group.push(row)
    }
  }

  return groups
}

type PricedVariant = {
  itemId: string | null
  unitPrice: number | null
  checkedAt: Date | null
}

// 가격이 있는 변형 가운데 가장 싼 줄, 없으면 검색에 잡힌 줄, 조회한 줄 순으로 골라 묶은 줄의 배지가 가장 나은 상태를 보이게 한다.
function priceRank({ itemId, unitPrice, checkedAt }: PricedVariant): number {
  if (unitPrice !== null) {
    return 0
  }

  if (itemId !== null) {
    return 1
  }

  if (checkedAt !== null) {
    return 2
  }

  return 3
}

export function cheapestVariantOf<Row extends PricedVariant>(rows: readonly Row[]): Row {
  return rows.reduce((best, row) => {
    const rank = priceRank(row) - priceRank(best)

    if (rank < 0) {
      return row
    }

    if (
      rank === 0 &&
      row.unitPrice !== null &&
      best.unitPrice !== null &&
      row.unitPrice < best.unitPrice
    ) {
      return row
    }

    return best
  })
}
