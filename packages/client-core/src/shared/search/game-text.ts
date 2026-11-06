export type GameTextTone = 'default' | 'accent' | 'subtle'

export type GameTextSegment = Readonly<{ text: string; tone: GameTextTone }>

export type GameTextLine = readonly GameTextSegment[]

// PVF 문구의 <tst::…> 표지는 다음 표지가 나올 때까지 적용된다. 강조와 비활성 말고는 등급 이름 같은 표지라 기본 색으로 둔다.
const TONE_BY_MARKER: Readonly<Record<string, GameTextTone>> = {
  up_color: 'accent',
  ui_disable: 'subtle'
}
const MARKER_PATTERN = /<tst::([^>]*)>/
// PVF 문구의 줄바꿈은 백슬래시와 n 두 글자다.
const LINE_BREAK_PATTERN = /\\n|\n/

export function gameTextLinesOf(raw: string): GameTextLine[] {
  let current: GameTextSegment[] = []
  const lines: GameTextSegment[][] = [current]
  const parts = raw.replaceAll('%%', '%').split(MARKER_PATTERN)
  let tone: GameTextTone = 'default'
  for (const [index, part] of parts.entries()) {
    const isMarker = index % 2 === 1
    if (isMarker) {
      tone = TONE_BY_MARKER[part] ?? 'default'
      continue
    }
    for (const [lineIndex, text] of part.split(LINE_BREAK_PATTERN).entries()) {
      if (lineIndex > 0) {
        current = []
        lines.push(current)
      }

      if (text !== '') {
        current.push({ text, tone })
      }
    }
  }

  return lines
}
