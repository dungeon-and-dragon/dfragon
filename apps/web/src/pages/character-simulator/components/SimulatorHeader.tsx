import { Button } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import {
  type CharacterDetailView,
  characterImageUrl,
  displayJobName,
  Portrait,
  ServerBadge
} from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { EquipmentSimulationResult } from '#pages/character-simulator/api/useEquipmentSimulation'
import { ScorePanel } from './ScorePanel'

const integer = new Intl.NumberFormat('ko-KR')

const STRIP = 'section flex flex-wrap items-center gap-6 px-4 py-6'
const IDENTITY = 'flex min-w-0 grow basis-[240px] flex-col gap-2 max-sm:basis-0'
const STATS = 'flex min-w-0 flex-wrap items-end gap-x-12 gap-y-4 max-sm:basis-full max-sm:gap-x-6'
const LINE = 'flex min-w-0 items-center gap-2 whitespace-nowrap'

export function SimulatorHeader({
  title,
  detail,
  simulation,
  changed,
  onReset
}: {
  title: string
  detail: CharacterDetailView
  simulation: EquipmentSimulationResult
  changed: boolean
  onReset: () => void
}): React.JSX.Element {
  const { character } = detail
  const identity = { serverId: character.serverId, characterId: character.characterId }
  const role = detail.card?.role ?? null
  const job = displayJobName(character, role)

  return (
    <header className={STRIP}>
      <div className="portrait portrait-lg">
        <Portrait src={characterImageUrl(character)} />
      </div>
      <div className={IDENTITY}>
        <h1 className="screen-title">{title}</h1>
        <div className={LINE}>
          <ServerBadge serverId={character.serverId} />
          <Link
            to="/c/$serverId/$characterId"
            params={identity}
            className="link min-w-0 truncate font-semibold text-fg"
          >
            {character.characterName ?? MISSING_VALUE}
          </Link>
        </div>
        {(job != null || character.level != null) && (
          <div className={LINE}>
            {job != null && <span className="text-fg-muted">{job}</span>}
            {character.level != null && (
              <span className="num text-fg-subtle">{`Lv ${character.level}`}</span>
            )}
          </div>
        )}
      </div>
      <div className={STATS}>
        <ScorePanel role={role} result={simulation} />
        <FameStat fame={character.fame} />
        <Button size="sm" disabled={!changed} onClick={onReset}>
          초기화
        </Button>
      </div>
    </header>
  )
}

// 시뮬레이션은 명성을 다시 계산하지 않으므로 캐릭터의 지금 명성만 보인다.
function FameStat({ fame }: { fame: number | null }): React.JSX.Element {
  return (
    <div className="stat min-w-0 max-sm:[&_.stat-value]:text-sm">
      <span className="stat-label">명성</span>
      {fame != null ? (
        <span className="stat-value text-game-fame">{integer.format(fame)}</span>
      ) : (
        <span className="stat-value text-fg-subtle">{MISSING_VALUE}</span>
      )}
    </div>
  )
}
