import type { CharacterBasicInput } from '@dfragon/database'
import { characterBasicSchema } from '@dfragon/neople'
import { OnEvent } from '@nestjs/event-emitter'
import { CHARACTER_FETCHED, type CharacterFetched } from '../events.js'

export type RecordCharacterBasic = (basic: CharacterBasicInput) => Promise<void>

export class CharacterBasicSubscriber {
  constructor(
    private readonly record: RecordCharacterBasic,
    private readonly reportFailure: () => void
  ) {}

  @OnEvent(CHARACTER_FETCHED)
  onCharacterFetched({ basic }: CharacterFetched): void {
    const parsed = characterBasicSchema.safeParse(basic)
    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (!parsed.success) {
      return
    }
    const { data } = parsed
    const fame = data.fame ?? null
    const guildId = data.guildId ?? null
    const guildName = data.guildName ?? null
    this.record({ ...data, fame, guildId, guildName }).catch(this.reportFailure)
  }
}
