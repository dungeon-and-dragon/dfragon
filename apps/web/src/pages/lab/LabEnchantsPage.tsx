import { ChipGroup } from '@dfragon/ui'
import { useState } from 'react'
import { PageNote } from '#shared/ui/PageNote'
import { RelativeTime } from '#shared/ui/RelativeTime'
import { useLabItems } from './api/useLabItems'
import { LabItemTable } from './LabItemTable'
import { LabTabs } from '#widgets/lab-tabs'
import {
  accessoryRowsOf,
  type EnchantRole,
  enchantRowsOf,
  hasLabItems,
  lastCheckedAtOf
} from './lab-tables'

const ROLE_CHOICES = [
  { value: 'dealer', label: '딜러' },
  { value: 'buffer', label: '버퍼' }
] as const

const ACCESSORY_TITLE = '칭호, 크리쳐, 오라'

export function LabEnchantsPage(): React.JSX.Element {
  const [role, setRole] = useState<EnchantRole>('dealer')

  return (
    <div className="flex flex-col">
      <LabTabs />
      <LabEnchantsBody role={role} onRoleChange={setRole} />
    </div>
  )
}

function LabEnchantsBody({
  role,
  onRoleChange
}: {
  role: EnchantRole
  onRoleChange: (role: EnchantRole) => void
}): React.JSX.Element {
  const result = useLabItems()
  const roleChips = (
    <div className="section flex flex-col gap-3 px-4">
      <ChipGroup aria-label="역할" items={ROLE_CHOICES} value={role} onValueChange={onRoleChange} />
    </div>
  )

  switch (result.status) {
    case 'loading':
      return (
        <>
          {roleChips}
          <div aria-busy="true" className="p-4">
            <span className="skeleton h-[280px]" />
          </div>
        </>
      )
    case 'error':
      return (
        <>
          {roleChips}
          <p role="alert" className="section state state-error">
            마법부여 카드를 받지 못했습니다.
          </p>
        </>
      )
    case 'success': {
      const { groups } = result.value

      if (!hasLabItems(groups)) {
        return <p className="section state">마법부여 카드가 없습니다.</p>
      }

      const enchantRows = enchantRowsOf(groups, role)
      const accessoryRows = accessoryRowsOf(groups)
      const lastCheckedAt = lastCheckedAtOf(groups)

      return (
        <>
          {roleChips}
          {enchantRows.length > 0 && (
            <LabItemTable
              categoryLabel="부위"
              itemLabel="카드"
              rows={enchantRows}
              role={role}
              withFame
            />
          )}
          {accessoryRows.length > 0 && (
            <section aria-label={ACCESSORY_TITLE}>
              <h2 className="section-title">{ACCESSORY_TITLE}</h2>
              <LabItemTable categoryLabel="종류" itemLabel="아이템" rows={accessoryRows} withFame />
            </section>
          )}
          {lastCheckedAt !== null && (
            <PageNote>
              {'마지막 업데이트 '}
              <RelativeTime at={lastCheckedAt} />
            </PageNote>
          )}
        </>
      )
    }
  }
}
