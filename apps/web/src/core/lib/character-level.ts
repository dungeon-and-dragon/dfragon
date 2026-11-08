// 만렙이 오르면 이 값만 바꾼다.
export const MAX_CHARACTER_LEVEL = 115

export function isMaxLevel(level: number | null): boolean {
  return level === MAX_CHARACTER_LEVEL
}
