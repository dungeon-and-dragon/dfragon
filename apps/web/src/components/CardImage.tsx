import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import type { CharacterFaceWindow } from '#core/search/search'
import { styles } from './CardImage.style'

export function CardImage({
  src,
  face
}: {
  src?: string
  face?: CharacterFaceWindow | null
}): React.JSX.Element {
  const [failedSource, setFailedSource] = useState<string>()
  if (src == null || failedSource === src) {
    const placeholder = stylex.props(styles.placeholder)

    return (
      <span
        role="img"
        aria-label="캐릭터 이미지 없음"
        className={`${placeholder.className ?? ''} text-xs`}
        style={placeholder.style}
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
      {...stylex.props(
        face != null ? styles.faceWindow(face.x, face.y, face.width) : [styles.image, styles.zoom]
      )}
    />
  )
}
