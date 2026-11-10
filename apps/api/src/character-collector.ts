import { startCharacterCollector } from './runtime/character-collector.js'
import { readCollectorConfiguration } from './runtime/collector-configuration.js'

try {
  await startCharacterCollector(readCollectorConfiguration(process.env))
} catch {
  console.error('Character collector failed')
  process.exitCode = 1
}
