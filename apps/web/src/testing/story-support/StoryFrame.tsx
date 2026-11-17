import { type ReactNode, useState } from 'react'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { TestQueryClient } from '../test-support/test-query-client'
import { TestRouter } from '../test-support/test-router'
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
