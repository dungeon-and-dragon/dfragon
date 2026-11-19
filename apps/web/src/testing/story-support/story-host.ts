import type { ClientHost } from '#features/capture-search'

type StoryHostOverrides = {
  party?: Partial<ClientHost['party']>
  raid?: Partial<ClientHost['raid']>
}

// Storybook은 vitest의 mock을 쓸 수 없어, story가 넘기지 않은 연산은 끝나지 않는 Promise로 채워 받는 중 상태로 둔다.
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

function unsubscribe(): void {}

export function createStoryClientHost({ party, raid }: StoryHostOverrides = {}): ClientHost {
  return {
    party: {
      controlCharacterSearch: pending,
      onCharacterSearchChanged: () => unsubscribe,
      notifyOcrCandidatesDetected: pending,
      selectCaptureSource: pending,
      readCaptureFrame: pending,
      ...party
    },
    raid: {
      controlCharacterSearch: pending,
      onCharacterSearchChanged: () => unsubscribe,
      notifyOcrCandidatesDetected: pending,
      readCaptureFrame: pending,
      ...raid
    }
  }
}
