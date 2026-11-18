import { CHARACTER_SERVER_NAMES } from '#core/character'

const SURFACE_CLASSES = {
  inset: 'bg-inset',
  control: 'bg-control'
} as const

export function ServerBadge({
  serverId,
  surface = 'inset'
}: {
  serverId: keyof typeof CHARACTER_SERVER_NAMES
  surface?: keyof typeof SURFACE_CLASSES
}): React.JSX.Element {
  return (
    // 서버 이름은 가장 긴 것이 4글자라 4글자 폭을 최소 폭으로 두어 줄마다 이름 시작 위치를 맞춘다.
    <span
      className={`badge min-w-[calc(4em+16px)] justify-center text-fg-muted ${SURFACE_CLASSES[surface]}`}
    >
      {CHARACTER_SERVER_NAMES[serverId]}
    </span>
  )
}
