import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { formatJobName } from '#core/lib/job-format'
import { Link } from '@tanstack/react-router'
import { MISSING_VALUE } from '#core/constants/cards'
import { formatApproximateScore, toScoreView } from '#core/lib/card-score'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/shared/search/character-summary'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { Portrait } from '../../components/Portrait'
import { characterDisplaySchema } from '../../lib/stored-character'
import { styles } from './CharacterSummary.style'
import { FavoriteToggle } from './FavoriteToggle'

const integer = new Intl.NumberFormat('ko-KR')

export function CharacterSummary({ detail }: { detail: CharacterDetailView }): React.JSX.Element {
  const { character } = detail
  const favorite = characterDisplaySchema.safeParse(character).data
  const job = character.jobGrowName ?? character.jobName
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
    <section aria-label="캐릭터 요약" {...stylex.props(styles.summary)}>
      <div {...stylex.props(styles.well)}>
        <Portrait src={characterImageUrl(character)} />
      </div>
      <div {...stylex.props(styles.identity)}>
        <div {...stylex.props(styles.heading)}>
          <h1 {...stylex.props(styles.name)}>{character.characterName ?? MISSING_VALUE}</h1>
          {favorite != null && <FavoriteToggle character={favorite} />}
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
