import { type ReactNode, useState } from 'react'
import { ClientHostContext, type ClientHost } from '#features/capture-search'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { createStoryClientHost } from './story-host'

export function StoryFrame({
  host,
  path,
  children
}: {
  host?: ClientHost
  path?: string
  children: ReactNode
}): React.JSX.Element {
  const [storyHost] = useState(() => host ?? createStoryClientHost())

  return (
    <ClientHostContext value={storyHost}>
      <TestQueryClient>
        <TestRouter path={path}>
          <div className="font-sans text-sm text-fg">{children}</div>
        </TestRouter>
      </TestQueryClient>
    </ClientHostContext>
  )
}
