import { type DynamicModule, Module, type OnApplicationShutdown } from '@nestjs/common'

class OpsDatabaseConnection implements OnApplicationShutdown {
  constructor(private readonly close: () => Promise<void>) {}

  onApplicationShutdown(): Promise<void> {
    return this.close()
  }
}

export interface OpsDatabaseModuleOptions {
  readonly close: () => Promise<void>
}

@Module({})
export class OpsDatabaseModule {
  static register({ close }: OpsDatabaseModuleOptions): DynamicModule {
    return {
      module: OpsDatabaseModule,
      providers: [
        { provide: OpsDatabaseConnection, useFactory: () => new OpsDatabaseConnection(close) }
      ]
    }
  }
}
