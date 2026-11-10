export function averageGradePercent(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)

  return Math.round(total / values.length)
}
