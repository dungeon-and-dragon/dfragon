import { readErrorChain } from '#application/jobs/index.js'
import { startCharacterCollector, writeReport } from './character-collector.js'
import { readCollectorConfiguration } from './collector-configuration.js'

export async function runCharacterCollector(): Promise<void> {
  try {
    await startCharacterCollector(readCollectorConfiguration(process.env))
  } catch (error) {
    const errorChain = readErrorChain(error)
    writeReport('CHARACTER_COLLECTOR_FAILED', { errorChain })

    // 수집과 타임라인 동기화 중 하나만 멈춰도 예약 작업과 key 갱신 timer가 event loop를 붙잡아 process가 끝나지 않는다.
    // 멈춘 쪽이 다시 돌도록 직접 끝내 컨테이너가 다시 띄우게 한다.
    process.exit(1)
  }
}
