// 레기온은 THE NEXT JOURNEY(시즌 8)부터 있어 마계, 할렘, 귀환에는 없다.
const SEASONS_WITHOUT_LEGION = new Set([5, 6, 7])

export function seasonHasLegion(seasonId: number | undefined): boolean {
  return seasonId === undefined || !SEASONS_WITHOUT_LEGION.has(seasonId)
}
