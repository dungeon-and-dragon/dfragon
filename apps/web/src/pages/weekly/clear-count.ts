const numberFormat = new Intl.NumberFormat('ko-KR')

type ClearCount = Readonly<{ count: number; hard?: number; normal?: number }>

export function formatClearCount({ count, hard = 0, normal = 0 }: ClearCount): string {
  if (hard > 0 && normal > 0) {
    return `하드 ${numberFormat.format(hard)}회 | 노말 ${numberFormat.format(normal)}회`
  }

  return `${numberFormat.format(count)}회`
}
