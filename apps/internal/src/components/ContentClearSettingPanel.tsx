import { Button, Switch } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import type { ContentClearSetting } from '#ops-api/ops-schemas'
import { useChangeContentClearSetting, useContentClearSettings } from '#ops-app/ops-queries'
import { FIELD_INPUT, panelClasses } from './panel-classes'

function ContentClearSettingRow({ content }: { content: ContentClearSetting }): React.JSX.Element {
  const change = useChangeContentClearSetting()
  const [minPopulation, setMinPopulation] = useState(String(content.scoreBandMinPopulation))

  function handleCollectedChange(checked: boolean): void {
    change.mutate({ contentId: content.id, collected: checked })
  }

  function handleShownChange(checked: boolean): void {
    change.mutate({ contentId: content.id, shown: checked })
  }

  function handleMinPopulationChange(event: ChangeEvent<HTMLInputElement>): void {
    setMinPopulation(event.currentTarget.value)
  }

  function handleMinPopulationSubmit(event: FormEvent<HTMLFormElement>): void {
    const scoreBandMinPopulation = Number(minPopulation)

    event.preventDefault()
    change.mutate({ contentId: content.id, scoreBandMinPopulation })
  }

  return (
    <tr>
      <td className="font-semibold">{content.name}</td>
      <td>
        <Switch
          checked={content.collected}
          disabled={change.isPending}
          onCheckedChange={handleCollectedChange}
          aria-label={`${content.name} 수집`}
        />
      </td>
      <td>
        <Switch
          checked={content.shown}
          disabled={change.isPending}
          onCheckedChange={handleShownChange}
          aria-label={`${content.name} 노출`}
        />
      </td>
      <td>
        <form onSubmit={handleMinPopulationSubmit} className="m-0 flex items-center gap-2">
          <div className="w-16 shrink-0">
            <input
              type="number"
              required
              min={0}
              step={1}
              aria-label={`${content.name} 최소 인원`}
              value={minPopulation}
              onChange={handleMinPopulationChange}
              className={`${FIELD_INPUT} field-box-sm`}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={change.isPending}
            aria-label={`${content.name} 최소 인원 저장`}
          >
            저장
          </Button>
        </form>
      </td>
    </tr>
  )
}

export function ContentClearSettingPanel(): React.JSX.Element {
  const settings = useContentClearSettings()

  return (
    <section aria-label="클리어 집계" className={panelClasses.box}>
      <h2 className="section-title">클리어 집계</h2>
      {settings.isError && settings.data === undefined && (
        <p role="alert" className="state state-error">
          클리어 집계 설정을 읽지 못했습니다.
        </p>
      )}
      {settings.data !== undefined && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>컨텐츠</th>
                <th>수집</th>
                <th>노출</th>
                <th>최소 인원</th>
              </tr>
            </thead>
            <tbody>
              {settings.data.contents.map((content) => (
                <ContentClearSettingRow key={content.id} content={content} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
