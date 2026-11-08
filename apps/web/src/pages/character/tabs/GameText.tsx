import * as stylex from '@stylexjs/stylex'
import type { GameTextLines } from '#core/shared/search/game-text'
import { styles, toneStyles } from './GameText.style'

export function GameText({
  lines,
  style
}: {
  lines: GameTextLines
  style?: stylex.StyleXStyles
}): React.JSX.Element {
  return (
    <p {...stylex.props(styles.text, style)}>
      {lines.map((line, lineIndex) => (
        // 문구에는 같은 줄이 되풀이되기도 하고 순서가 바뀌지 않아 줄 번호를 key로 쓴다.
        <span key={`line-${lineIndex}`} {...stylex.props(styles.line)}>
          {line.map(({ text, tone }, segmentIndex) => (
            <span key={`segment-${segmentIndex}`} {...stylex.props(toneStyles[tone])}>
              {text}
            </span>
          ))}
        </span>
      ))}
    </p>
  )
}
