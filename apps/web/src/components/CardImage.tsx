import { type CSSProperties, useState } from 'react'
import { type CharacterFaceWindow, PORTRAIT_CANVAS_WIDTH } from '#core/search'

function percentOfFace(value: number, faceWidth: number): string {
  return `${(value / faceWidth) * 100}%`
}

// 칸이 정사각형이라 얼굴 칸 폭을 기준으로 한 비율을 가로, 세로 위치에 함께 쓴다.
function faceWindowStyle({ x, y, width: faceWidth }: CharacterFaceWindow): CSSProperties {
  const left = percentOfFace(-x, faceWidth)
  const top = percentOfFace(-y, faceWidth)
  const width = percentOfFace(PORTRAIT_CANVAS_WIDTH, faceWidth)

  return { left, top, width }
}

export function CardImage({
  src,
  face
}: {
  src?: string
  face?: CharacterFaceWindow | null
}): React.JSX.Element {
  const [failedSource, setFailedSource] = useState<string>()
  if (src == null || failedSource === src) {
    return (
      <span
        role="img"
        aria-label="캐릭터 이미지 없음"
        className="grid size-full place-items-center text-xs text-card-fg-muted"
      >
        —
      </span>
    )
  }

  const handleError = () => setFailedSource(src)

  return (
    <img
      src={src}
      alt="캐릭터"
      draggable={false}
      onError={handleError}
      className={
        face != null
          ? 'absolute h-auto max-w-none [image-rendering:pixelated]'
          : 'size-full scale-170 object-contain'
      }
      style={face != null ? faceWindowStyle(face) : undefined}
    />
  )
}
