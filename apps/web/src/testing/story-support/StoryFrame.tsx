import { type ReactNode, useState } from 'react'
import { ClientHostContext, type ClientHost } from '#features/capture-search'
import { PageNoteTarget } from '#shared/ui/page-note-target'
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
  const [noteTarget, setNoteTarget] = useState<HTMLElement | null>(null)

  return (
    <ClientHostContext value={storyHost}>
      <TestQueryClient>
        <TestRouter path={path}>
          <div className="font-sans text-sm text-fg">
            <PageNoteTarget value={noteTarget}>{children}</PageNoteTarget>
            <div ref={setNoteTarget} className="px-4 py-2 text-2xs text-fg-subtle" />
          </div>
        </TestRouter>
      </TestQueryClient>
    </ClientHostContext>
  )
}
