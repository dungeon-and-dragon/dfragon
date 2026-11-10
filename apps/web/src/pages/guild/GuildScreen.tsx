import * as stylex from '@stylexjs/stylex'
import { MISSING_VALUE } from '#core/capture/cards'
import type { Guild } from '#core/adventure-guild/adventure-guild'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
import { CharacterListBox } from './components/CharacterListBox'
import { TitleBox, TitleStat } from '../../components/table/TitleBox'
import { useGuild } from './hooks/useGuild'
import type { LoadedResult } from '../../hooks/useLoadedResult'
import { styles } from './GuildScreen.style'

const DEFAULT_TITLE = '길드'
const integer = new Intl.NumberFormat('ko-KR')

export function GuildScreen({ guildId }: { guildId: string }): React.JSX.Element {
  const result = useGuild(guildId)
  const members: LoadedResult<readonly StoredCharacter[]> =
    result.status === 'success' ? { status: 'success', value: result.value.members } : result

  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title={guildTitle(result)}>
        {result.status === 'success' && <GuildStats guild={result.value} />}
      </TitleBox>
      <CharacterListBox name="길드원" result={members} affiliation="adventure" scrolling />
    </div>
  )
}

function guildTitle(result: LoadedResult<Guild>): string {
  if (result.status !== 'success') {
    return DEFAULT_TITLE
  }

  if (result.value.guildName == null) {
    return DEFAULT_TITLE
  }

  return result.value.guildName
}

function GuildStats({ guild }: { guild: Guild }): React.JSX.Element {
  return (
    <>
      <TitleStat label="길드원" value={integer.format(guild.memberCount)} />
      <TitleStat
        label="평균 명성"
        value={guild.averageFame != null ? integer.format(guild.averageFame) : MISSING_VALUE}
      />
    </>
  )
}
