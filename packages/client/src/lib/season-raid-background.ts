import season5 from '../assets/season-raid-backgrounds/season-5.webp'
import season6 from '../assets/season-raid-backgrounds/season-6.webp'
import season7 from '../assets/season-raid-backgrounds/season-7.webp'
import season8 from '../assets/season-raid-backgrounds/season-8.webp'
import season9 from '../assets/season-raid-backgrounds/season-9.webp'
import season10 from '../assets/season-raid-backgrounds/season-10.webp'
import season11 from '../assets/season-raid-backgrounds/season-11.webp'

const SEASON_RAID_BACKGROUNDS = new Map<number, string>([
  [5, season5],
  [6, season6],
  [7, season7],
  [8, season8],
  [9, season9],
  [10, season10],
  [11, season11]
])

export function findSeasonRaidBackground(season: number): string | undefined {
  return SEASON_RAID_BACKGROUNDS.get(season)
}
