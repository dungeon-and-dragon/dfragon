import { type DynamicModule, Module } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  type CharacterDetailDependencies,
  createCharacterDetailService
} from '../../application/character-detail/service.js'
import { CHARACTER_FETCHED, CharacterFetched } from '../../domain/character-events.js'
import { SCORE_ENGINE, type ScoreEngine } from '../../infrastructure/score/engine.js'
import {
  CHARACTER_DETAIL_SERVICE,
  CharacterDetailController
} from '../../presentation/http/character-detail/controller.js'

export type CharacterDetailModuleOptions = Omit<
  CharacterDetailDependencies,
  'calculateScore' | 'publishCharacterFetched'
>

@Module({})
export class CharacterDetailModule {
  static register(options: CharacterDetailModuleOptions): DynamicModule {
    return {
      module: CharacterDetailModule,
      controllers: [CharacterDetailController],
      providers: [
        {
          provide: CHARACTER_DETAIL_SERVICE,
          inject: [SCORE_ENGINE, EventEmitter2],
          useFactory: (engine: ScoreEngine, emitter: EventEmitter2) =>
            createCharacterDetailService({
              ...options,
              calculateScore: engine.calculate,
              publishCharacterFetched: (
                { serverId, characterId },
                { basic, skill_style },
                fetchedAt
              ) => {
                emitter.emit(
                  CHARACTER_FETCHED,
                  new CharacterFetched(serverId, characterId, basic, skill_style, fetchedAt)
                )
              }
            })
        }
      ]
    }
  }
}
