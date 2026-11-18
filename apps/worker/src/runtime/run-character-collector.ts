import { startCharacterCollector } from './character-collector.js'
import { readCollectorConfiguration } from './collector-configuration.js'

export async function runCharacterCollector(): Promise<void> {
  try {
    await startCharacterCollector(readCollectorConfiguration(process.env))
  } catch {
    console.error('Character collector failed')
    process.exitCode = 1
  }
}
