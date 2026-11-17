import type { CharacterFaceWindow } from '#core/search/search'
import { CardImage } from './CardImage'

export function Portrait({
  src,
  face
}: {
  src: string | undefined
  face?: CharacterFaceWindow | null
}): React.JSX.Element {
  return (
    <div className="absolute inset-0">
      <CardImage src={src} face={face} />
    </div>
  )
}
