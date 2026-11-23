import { type CharacterDetailView, ServerBadge } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { EquipmentSimulationResult } from '#pages/character-simulator/api/useEquipmentSimulation'
import { ScorePanel } from './ScorePanel'

/**
 * 캐릭터 띠가 화면 위로 나가면 창 위에 붙어 서버, 캐릭터명, 점수를 한 줄로 보인다. 높이는 화면이 정한 `--summary-height`다.
 * 900px 미만에서는 화면 상자가 가로로 스크롤해 그 안의 sticky가 창에 붙지 않으므로 창에 고정하고, 문서 흐름 밖이라 나타나고
 * 사라져도 아래 내용이 움직이지 않는다.
 */
export function SimulatorSummaryBar({
  shown,
  detail,
  simulation
}: {
  shown: boolean
  detail: CharacterDetailView
  simulation: EquipmentSimulationResult
}): React.JSX.Element | null {
  const { character } = detail

  if (!shown) {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-0 z-sticky">
      <div className="page box-border flex flex-wrap items-center gap-x-6 gap-y-1 border-x border-b border-line bg-canvas h-[var(--summary-height)] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ServerBadge serverId={character.serverId} />
          <span className="min-w-0 truncate font-semibold">
            {character.characterName ?? MISSING_VALUE}
          </span>
        </div>
        <ScorePanel role={detail.card?.role ?? null} result={simulation} inline />
      </div>
    </div>
  )
}
