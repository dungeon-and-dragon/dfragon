import diregie from '../assets/clear-content-backgrounds/diregie.webp'
import inae from '../assets/clear-content-backgrounds/inae.webp'
import nightmare from '../assets/clear-content-backgrounds/nightmare.webp'
import season10 from '../assets/season-raid-backgrounds/season-10.webp'
import season11 from '../assets/season-raid-backgrounds/season-11.webp'

// 같은 레이드의 일반과 하드는 같은 그림을 쓴다. 나벨과 미카엘라는 시즌 배경과 같은 원본이다.
const CLEAR_CONTENT_BACKGROUNDS = new Map<string, string>([
  ['nabel-normal', season10],
  ['nabel-hard', season10],
  ['inae-twilight', inae],
  ['diregie-normal', diregie],
  ['diregie-hard', diregie],
  ['michaela-normal', season11],
  ['michaela-hard', season11],
  ['engraved-nightmare-1', nightmare]
])

export function findClearContentBackground(contentId: string): string | undefined {
  return CLEAR_CONTENT_BACKGROUNDS.get(contentId)
}
