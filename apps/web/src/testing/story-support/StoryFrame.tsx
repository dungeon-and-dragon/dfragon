import { type ReactNode, useState } from 'react'
import { ClientHostContext, type ClientHost } from '#features/capture-search'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { createStoryClientHost } from './story-host'

export function StoryFrame({
  host,
  children
}: {
  host?: ClientHost
  children: ReactNode
}): React.JSX.Element {
  const [storyHost] = useState(() => host ?? createStoryClientHost())

  return (
    <ClientHostContext value={storyHost}>
      <TestQueryClient>
        <TestRouter>
          <div className="font-sans text-sm text-fg">{children}</div>
        </TestRouter>
      </TestQueryClient>
    </ClientHostContext>
  )
}
