export type OpsQueueCount = {
  readonly name: string
  readonly waiting: number
  readonly running: number
}

export type ReadQueueCounts = () => Promise<readonly OpsQueueCount[]>
