import { Button, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { formatJobName } from '#core/character/job-format'
import { grownJobName } from '#core/character/male-crusader'
import { Link } from '@tanstack/react-router'
import { MISSING_VALUE } from '#core/capture/cards'
import { formatApproximateScore, toScoreView } from '#core/character/card-score'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { Portrait } from '../../components/Portrait'
import { characterDisplayOf } from '../../lib/stored-character'
import { styles } from './CharacterSummary.style'
import { FavoriteToggle } from '../../components/FavoriteToggle'
import { RefreshIcon } from '../../components/RefreshIcon'
import { useRefreshCharacterDetail } from '../../hooks/useCharacterDetail'
import { useRefreshingNow } from '../../hooks/useRefreshingNow'
import { formatSeoulDateTime, formatTimeAgo } from '#core/time-format'

const integer = new Intl.NumberFormat('ko-KR')

// API도 마지막으로 받은 지 1분 안의 강제 갱신에는 Neople을 다시 부르지 않고 받아 둔 응답을 준다.
const REFRESH_INTERVAL_MS = 60_000

export function CharacterSummary({ detail }: { detail: CharacterDetailView }): React.JSX.Element {
  const { character } = detail
  const favorite = characterDisplayOf(detail)
  const job = grownJobName(character, detail.card?.role ?? null)
  const { refresh, refreshing } = useRefreshCharacterDetail()
  const { lastSuccessfulFetchAt } = detail.freshness

  function refreshCharacter(): void {
    refresh({ serverId: character.serverId, characterId: character.characterId })
  }

  const affiliations = [
    {
      id: 'adventure',
      name: character.adventureName,
      tone: styles.adventure,
      link: character.adventureName != null && (
        <Link
          to="/adventures/$adventureName"
          params={{ adventureName: character.adventureName }}
          {...stylex.props(styles.adventure, styles.link)}
        >
          {character.adventureName}
        </Link>
      )
    },
    {
      id: 'guild',
      name: character.guildName,
      tone: styles.guild,
      link: character.guildId != null && (
        <Link
          to="/guilds/$guildId"
          params={{ guildId: character.guildId }}
          {...stylex.props(styles.guild, styles.link)}
        >
          {character.guildName}
        </Link>
      )
    }
  ].filter((affiliation) => affiliation.name != null)

  return (
    <section
      aria-label="캐릭터 요약"
      aria-busy={refreshing || undefined}
      {...stylex.props(styles.summary)}
    >
      <div {...stylex.props(styles.well)}>
        <Portrait src={characterImageUrl(character)} />
      </div>
      <div {...stylex.props(styles.identity)}>
        <div {...stylex.props(styles.heading)}>
          <h1 {...stylex.props(styles.name)}>{character.characterName ?? MISSING_VALUE}</h1>
          {favorite != null && <FavoriteToggle character={favorite} />}
          <RefreshControl
            key={lastSuccessfulFetchAt}
            fetchedAt={lastSuccessfulFetchAt}
            refreshing={refreshing}
            onRefresh={refreshCharacter}
          />
        </div>
        <div {...stylex.props(styles.line)}>
          <span {...stylex.props(styles.server)}>{CHARACTER_SERVER_NAMES[character.serverId]}</span>
          {job != null && <span {...stylex.props(styles.muted)}>{formatJobName(job)}</span>}
          {character.level != null && (
            <span {...stylex.props(styles.level)}>{`Lv.${character.level}`}</span>
          )}
        </div>
        {affiliations.length > 0 && (
          <div {...stylex.props(styles.line)}>
            {affiliations.map(({ id, name, tone, link }, index) => (
              <span key={id} {...stylex.props(styles.affiliation)}>
                {index > 0 && <span aria-hidden="true" {...stylex.props(styles.divider)} />}
                {link || <span {...stylex.props(tone)}>{name}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
      <FameStat fame={character.fame} />
      <ScoreStat card={detail.card} />
    </section>
  )
}

// 받은 시각이 바뀌면 이전 시각의 타이머를 버리도록 받은 시각을 key로 다시 그린다.
function RefreshControl({
  fetchedAt,
  refreshing,
  onRefresh
}: {
  fetchedAt: string
  refreshing: boolean
  onRefresh: () => void
}): React.JSX.Element {
  const now = useRefreshingNow(Date.parse(fetchedAt))
  const justFetched = now - Date.parse(fetchedAt) < REFRESH_INTERVAL_MS

  return (
    <div {...stylex.props(styles.refresh)}>
      <Button
        size="sm"
        variant="secondary"
        disabled={refreshing || justFetched}
        onClick={onRefresh}
      >
        <RefreshIcon spinning={refreshing} />
        {refreshing ? '받는 중' : '갱신'}
      </Button>
      <time
        dateTime={fetchedAt}
        title={formatSeoulDateTime(fetchedAt, now)}
        {...stylex.props(styles.fetchedAt)}
      >
        {justFetched ? '방금 전' : formatTimeAgo(fetchedAt, now)}
      </time>
    </div>
  )
}

// 요약과 같은 칸 크기로 그려, 받은 뒤 요약이 들어와도 아래 탭 줄이 움직이지 않게 한다.
export function CharacterSummarySkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" {...stylex.props(styles.summary)}>
      <div {...stylex.props(styles.well)} />
      <div {...stylex.props(styles.identity)}>
        <Bone width={160} height={28} />
        <Bone width={200} height={20} />
        <Bone width={140} height={18} />
      </div>
      {[0, 1].map((stat) => (
        <div key={stat} {...stylex.props(styles.stat)}>
          <Bone width={40} height={14} />
          <Bone width={96} height={24} />
        </div>
      ))}
    </div>
  )
}

function Bone({ width, height }: { width: number; height: number }): React.JSX.Element {
  return <span {...stylex.props(styles.bone, styles.boneSize(width, height))} />
}

function FameStat({ fame }: { fame: number | null }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.stat)}>
      <span {...stylex.props(styles.statLabel)}>명성</span>
      {fame != null ? (
        <span {...stylex.props(styles.statValue, styles.fame)}>{integer.format(fame)}</span>
      ) : (
        <span {...stylex.props(styles.statValue, styles.missing)}>{MISSING_VALUE}</span>
      )}
    </div>
  )
}

function ScoreStat({ card }: { card: CharacterDetailView['card'] }): React.JSX.Element {
  const { label, tone, value, approximate, description } = toScoreView(card)
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )

  return (
    <div {...stylex.props(styles.stat)}>
      <span {...stylex.props(styles.statLabel)}>{label}</span>
      {value != null ? (
        <span
          title={description}
          {...stylex.props(
            styles.statValue,
            tone !== null && styles[tone],
            approximate && styles.approximate
          )}
        >
          {approximate ? formatApproximateScore(value) : integer.format(value)}
          {note}
        </span>
      ) : (
        <span {...stylex.props(styles.statValue, styles.missing)}>
          {MISSING_VALUE}
          {note}
        </span>
      )}
    </div>
  )
}
