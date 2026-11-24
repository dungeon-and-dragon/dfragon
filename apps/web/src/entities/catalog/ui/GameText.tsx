import type { GameTextLines } from '#entities/catalog/model/game-text'
import { gameTextToneClasses } from './game-text-tones'

export function GameText({
  lines,
  className = ''
}: {
  lines: GameTextLines
  className?: string
}): React.JSX.Element {
  return (
    <p className={`m-0 ${className}`}>
      {lines.map((line, lineIndex) => (
        // 문구에는 같은 줄이 되풀이되기도 하고 순서가 바뀌지 않아 줄 번호를 key로 쓴다.
        <span key={`line-${lineIndex}`} className="block min-h-lh whitespace-pre-wrap">
          {line.map(({ text, tone }, segmentIndex) => (
            <span key={`segment-${segmentIndex}`} className={gameTextToneClasses[tone]}>
              {text}
            </span>
          ))}
        </span>
      ))}
    </p>
  )
}
