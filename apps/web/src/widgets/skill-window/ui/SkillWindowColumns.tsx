// 스킬 창 최소 폭(테두리 포함 522px)에 왼쪽 열 여백과 오른쪽 열 폭을 더한 값보다 칸이 좁으면 오른쪽 열을 아래로 내린다.
// 340px 열은 896px(56rem), 420px 열은 976px(61rem)이 기준이다.
const ROOT = 'grid divide-x divide-line text-sm'
const SIDE_COLUMNS = {
  default:
    'grid-cols-[minmax(max-content,1fr)_340px] @max-[56rem]:grid-cols-1 @max-[56rem]:divide-x-0 @max-[56rem]:divide-y @max-[56rem]:overflow-x-auto',
  wide: 'grid-cols-[minmax(max-content,1fr)_420px] @max-[61rem]:grid-cols-1 @max-[61rem]:divide-x-0 @max-[61rem]:divide-y @max-[61rem]:overflow-x-auto'
} as const

export function SkillWindowColumns({
  main,
  side,
  sideWidth = 'default'
}: {
  main: React.ReactNode
  side: React.ReactNode
  sideWidth?: keyof typeof SIDE_COLUMNS
}): React.JSX.Element {
  return (
    <div className="@container">
      <div className={`${ROOT} ${SIDE_COLUMNS[sideWidth]}`}>
        <div className="p-4">{main}</div>
        <div className="min-w-0">{side}</div>
      </div>
    </div>
  )
}
