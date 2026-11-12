import { type DynamicModule, Module } from '@nestjs/common'
import type { FetchCharacterImage } from '../../application/character-image/ports.js'
import {
  CHARACTER_IMAGE_FETCH,
  CharacterImageController
} from '../../presentation/http/character-image/controller.js'

@Module({})
export class CharacterImageModule {
  static register(fetchCharacterImage: FetchCharacterImage): DynamicModule {
    return {
      module: CharacterImageModule,
      controllers: [CharacterImageController],
      providers: [{ provide: CHARACTER_IMAGE_FETCH, useValue: fetchCharacterImage }]
    }
  }
}
