import { type DynamicModule, Module } from '@nestjs/common'
import type { AdventureGuildService } from '../../application/adventure-guild/service.js'
import {
  ADVENTURE_GUILD_SERVICE,
  AdventureGuildController
} from '../../presentation/http/adventure-guild/controller.js'

@Module({})
export class AdventureGuildModule {
  static register(service: AdventureGuildService): DynamicModule {
    return {
      module: AdventureGuildModule,
      controllers: [AdventureGuildController],
      providers: [{ provide: ADVENTURE_GUILD_SERVICE, useValue: service }]
    }
  }
}
