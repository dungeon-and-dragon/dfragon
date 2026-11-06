import * as stylex from '@stylexjs/stylex'
import { colors } from '@dfragon/ui/tokens.stylex'
import { gameTextLinesOf } from '@dfragon/client-core/shared/search/game-text'

const toneStyles = stylex.create({
  default: {},
  accent: { color: colors.accent },
  subtle: { color: colors.fgSubtle }
})

const styles = stylex.create({
  text: { margin: 0 },
  line: { display: 'block', minHeight: '1lh', whiteSpace: 'pre-wrap' }
})

export function GameText({
  text,
  muted = false,
  style
}: {
  text: string
  muted?: boolean
  style?: stylex.StyleXStyles
}): React.JSX.Element {
  return (
    <p {...stylex.props(styles.text, style)}>
      {gameTextLinesOf(text).map((line, lineIndex) => (
        // 원문에는 같은 줄이 되풀이되기도 하고 순서가 바뀌지 않아 줄 번호를 key로 쓴다.
        <span key={`line-${lineIndex}`} {...stylex.props(styles.line)}>
          {line.map(({ text: segment, tone }, segmentIndex) => (
            <span
              key={`segment-${segmentIndex}`}
              {...stylex.props(toneStyles[muted ? 'subtle' : tone])}
            >
              {segment}
            </span>
          ))}
        </span>
      ))}
    </p>
  )
}
