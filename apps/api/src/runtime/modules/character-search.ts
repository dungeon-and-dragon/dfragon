import { type DynamicModule, Module } from '@nestjs/common'
import { CHARACTER_SEARCH_SERVICE, CharacterSearchController } from '../../characters/http.js'
import { createCharacterSearchService } from '../../characters/search-service.js'
import type { CharacterSearchDependencies } from '../../characters/types.js'

export type CharacterSearchModuleOptions = CharacterSearchDependencies

@Module({})
export class CharacterSearchModule {
  static register(options: CharacterSearchModuleOptions): DynamicModule {
    return {
      module: CharacterSearchModule,
      controllers: [CharacterSearchController],
      providers: [
        { provide: CHARACTER_SEARCH_SERVICE, useValue: createCharacterSearchService(options) }
      ]
    }
  }
}
