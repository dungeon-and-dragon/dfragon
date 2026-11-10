import { OnEvent } from '@nestjs/event-emitter'
import type { RecordFetchedCharacterBasic } from '../../application/character-basic/ports.js'
import { CHARACTER_FETCHED, type CharacterFetched } from '../../domain/character-events.js'

export class CharacterBasicSubscriber {
  constructor(private readonly record: RecordFetchedCharacterBasic) {}

  @OnEvent(CHARACTER_FETCHED)
  onCharacterFetched(event: CharacterFetched): void {
    this.record(event)
  }
}
