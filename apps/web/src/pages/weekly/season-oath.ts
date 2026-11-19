// API가 115레벨 장비와 서약을 나눠 세는 시즌이다(ADR 0074). API의 SEASON_EQUIPMENT_LEVELS와 같은 시즌을 둔다.
const SEASONS_WITH_OATHS = new Set([10, 11])

export function seasonHasOaths(seasonId: number | undefined): boolean {
  return seasonId !== undefined && SEASONS_WITH_OATHS.has(seasonId)
}
