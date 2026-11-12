import { type DynamicModule, Module } from '@nestjs/common'
import type { CharacterTimelineService } from '../../application/character-timeline/service.js'
import {
  CHARACTER_TIMELINE_SERVICE,
  CharacterTimelineController
} from '../../presentation/http/character-timeline/controller.js'

@Module({})
export class CharacterTimelineModule {
  static register(service: CharacterTimelineService): DynamicModule {
    return {
      module: CharacterTimelineModule,
      controllers: [CharacterTimelineController],
      providers: [{ provide: CHARACTER_TIMELINE_SERVICE, useValue: service }]
    }
  }
}
