import { type DynamicModule, Module } from '@nestjs/common'
import type { FetchCharacterImage } from '../../application/character-image/ports.js'
import { createNeopleCharacterImage } from '../../infrastructure/neople/character-image.js'
import {
  CHARACTER_IMAGE_FETCH,
  CharacterImageController
} from '../../presentation/http/character-image/controller.js'

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
