import { type DynamicModule, Module } from '@nestjs/common'
import { CHARACTER_IMAGE_FETCH, CharacterImageController } from '../../characters/image/http.js'
import {
  type FetchCharacterImage,
  createNeopleCharacterImage
} from '../../characters/image/neople.js'

export interface CharacterImageModuleOptions {
  readonly fetchCharacterImage?: FetchCharacterImage
}

@Module({})
export class CharacterImageModule {
  static register({
    fetchCharacterImage = createNeopleCharacterImage()
  }: CharacterImageModuleOptions): DynamicModule {
    return {
      module: CharacterImageModule,
      controllers: [CharacterImageController],
      providers: [{ provide: CHARACTER_IMAGE_FETCH, useValue: fetchCharacterImage }]
    }
  }
}
