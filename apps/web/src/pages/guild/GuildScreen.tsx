import type { Guild } from '#core/adventure-guild'
import type { StoredCharacter } from '#core/ranking'
import { CharacterListBox } from './components/CharacterListBox'
import { TitleBox, TitleStat } from '#components/table/TitleBox'
import { useGuild } from './hooks/useGuild'
import type { LoadedResult } from '#hooks/useLoadedResult'

const DEFAULT_TITLE = '길드'
const integer = new Intl.NumberFormat('ko-KR')

export function GuildScreen({ guildId }: { guildId: string }): React.JSX.Element {
  const result = useGuild(guildId)
  const members: LoadedResult<readonly StoredCharacter[]> =
    result.status === 'success' ? { status: 'success', value: result.value.members } : result

  return (
    <div className="flex flex-col">
      <TitleBox title={guildTitle(result)}>
        {result.status === 'success' && (
          <TitleStat label="길드원" value={integer.format(result.value.memberCount)} />
        )}
      </TitleBox>
      <CharacterListBox name="길드원" result={members} affiliation="adventure" paged />
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
