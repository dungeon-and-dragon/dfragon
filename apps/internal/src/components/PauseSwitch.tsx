import { Switch } from '@dfragon/ui'
import type { Job } from '../api/ops-schemas'
import { useSetPaused } from '../ops-queries'

export function PauseSwitch({ job }: { job: Job }): React.JSX.Element {
  const setPaused = useSetPaused()

  function handleCheckedChange(checked: boolean): void {
    setPaused.mutate({ name: job.name, paused: !checked })
  }

  return (
    <Switch
      checked={!job.paused}
      disabled={setPaused.isPending}
      onCheckedChange={handleCheckedChange}
      aria-label={`${job.displayName} 정기 실행`}
    />
  )
}
