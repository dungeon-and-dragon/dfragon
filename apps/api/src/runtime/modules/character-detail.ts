import { type DynamicModule, Module } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  CHARACTER_DETAIL_SERVICE,
  CharacterDetailController
} from '../../characters/details/http.js'
import {
  type CharacterDetailDependencies,
  createCharacterDetailService
} from '../../characters/details/service.js'
import { CharacterEvents } from '../../characters/events.js'
import { SCORE_ENGINE, type ScoreEngine } from '../../score/engine.js'

export type CharacterDetailModuleOptions = Omit<
  CharacterDetailDependencies,
  'calculateScore' | 'characterEvents'
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
              characterEvents: new CharacterEvents(emitter)
            })
        }
      ]
    }
  }
}
