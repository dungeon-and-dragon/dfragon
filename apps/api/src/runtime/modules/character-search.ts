import { neopleCharacterImageUrl } from '@dfragon/neople'
import { type DynamicModule, Module } from '@nestjs/common'
import {
  type CharacterSearchDependencies,
  createCharacterSearchService
} from '../../application/character-search/service.js'
import {
  CHARACTER_SEARCH_SERVICE,
  CharacterSearchController
} from '../../presentation/http/character-search/controller.js'

export type CharacterSearchModuleOptions = Omit<CharacterSearchDependencies, 'characterImageUrl'>

@Module({})
export class CharacterSearchModule {
  static register(options: CharacterSearchModuleOptions): DynamicModule {
    const service = createCharacterSearchService({
      ...options,
      characterImageUrl: neopleCharacterImageUrl
    })

    return {
      module: CharacterSearchModule,
      controllers: [CharacterSearchController],
      providers: [{ provide: CHARACTER_SEARCH_SERVICE, useValue: service }]
    }
  }
}
