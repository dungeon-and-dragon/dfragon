// 스킬 창 최소 폭(테두리 포함 522px)에 왼쪽 열 여백과 오른쪽 340px 열을 더한 896px보다 칸이 좁으면 오른쪽 열을 아래로 내린다.
const ROOT =
  'grid grid-cols-[minmax(max-content,1fr)_340px] divide-x divide-line text-sm @max-[56rem]:grid-cols-1 @max-[56rem]:divide-x-0 @max-[56rem]:divide-y @max-[56rem]:overflow-x-auto'

export function SkillWindowColumns({
  main,
  side
}: {
  main: React.ReactNode
  side: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="@container">
      <div className={ROOT}>
        <div className="p-4">{main}</div>
        <div className="min-w-0">{side}</div>
      </div>
    </div>
  )
}
