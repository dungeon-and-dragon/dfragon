import { Switch } from '@dfragon/ui'
import type { ContentClearSetting } from '#ops-api/ops-schemas'
import { useChangeContentClearSetting, useContentClearSettings } from '#ops-app/ops-queries'
import { panelClasses } from './panel-classes'

function ContentClearSettingRow({ content }: { content: ContentClearSetting }): React.JSX.Element {
  const change = useChangeContentClearSetting()

  function handleCollectedChange(checked: boolean): void {
    change.mutate({ contentId: content.id, collected: checked })
  }

  function handleShownChange(checked: boolean): void {
    change.mutate({ contentId: content.id, shown: checked })
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
