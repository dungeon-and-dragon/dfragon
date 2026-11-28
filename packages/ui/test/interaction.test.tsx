import { act, createRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  ConfirmPopover,
  IconButton,
  NumberField,
  Pagination,
  Popover,
  Select,
  StatusChip,
  Switch,
  Tabs,
  TextField,
  TextFieldDescription,
  TextFieldError,
  TextFieldInput,
  TextFieldLabel,
  Tooltip,
  type ButtonProps,
  type IconButtonProps,
  type TextFieldInputProps
} from '../src/index'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function render(children: ReactNode) {
  await act(async () => root.render(children))
}

function accessibleName(element: Element) {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy != null) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
  }
  const label = element.getAttribute('aria-label')
  if (label != null) {
    return label
  }
  const isLabelable = element instanceof HTMLInputElement
  if (isLabelable && element.labels != null && element.labels.length > 0) {
    return Array.from(element.labels, (candidate) => candidate.textContent ?? '').join(' ')
  }

  const text = element.textContent ?? ''

  return text.trim()
}

const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button, [role="button"]',
  textbox: 'input:not([type]), input[type="text"], [role="textbox"]',
  combobox: '[role="combobox"]',
  listbox: '[role="listbox"]',
  option: '[role="option"]',
  tab: '[role="tab"]',
  tablist: '[role="tablist"]',
  tabpanel: '[role="tabpanel"]',
  dialog: '[role="dialog"]',
  alertdialog: '[role="alertdialog"]',
  alert: '[role="alert"]',
  switch: '[role="switch"]',
  checkbox: '[role="checkbox"]',
  status: '[role="status"]',
  group: '[role="group"]'
}

function queryByRole(role: string, name?: string, scope: ParentNode = document) {
  const candidates = Array.from(scope.querySelectorAll<HTMLElement>(IMPLICIT_ROLES[role]))

  const match = candidates.find((candidate) => {
    const isNamed = name === undefined || accessibleName(candidate) === name

    return isNamed
  })
  if (match === undefined) {
    return null
  }

  return match
}

function getByRole(role: string, name?: string, scope: ParentNode = document) {
  const result = queryByRole(role, name, scope)
  if (result == null) {
    throw new Error(`테스트 준비: ${role} ${name ?? ''} 요소가 없습니다.`)
  }

  return result
}

function describedTexts(target: HTMLElement) {
  const ids = target.getAttribute('aria-describedby')?.split(/\s+/) ?? []

  return ids.map((id) => document.getElementById(id)?.textContent)
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

// jsdom에 텍스트 입력의 기본 동작이 없어 native setter와 input 이벤트를 함께 사용한다.
async function editInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (valueSetter == null) {
    throw new Error('테스트 준비: native input value setter가 없습니다.')
  }
  await act(async () => {
    valueSetter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Button의 클릭과 disabled, loading 상태', () => {
  it.each([
    { title: '활성 버튼은 클릭을 전달한다', loading: false, disabled: false },
    { title: 'disabled 버튼은 클릭을 차단한다', loading: false, disabled: true },
    { title: 'loading만 지정한 버튼은 클릭을 전달한다', loading: true, disabled: false },
    { title: 'loading과 disabled를 함께 지정하면 클릭을 차단한다', loading: true, disabled: true }
  ])('$title', async ({ loading, disabled }) => {
    const onClick = vi.fn<NonNullable<ButtonProps['onClick']>>()
    await render(
      <Button loading={loading} disabled={disabled} onClick={onClick}>
        실행
      </Button>
    )
    const button = getByRole('button', '실행')

    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect((button as HTMLButtonElement).disabled).toBe(disabled)
    await click(button)

    if (disabled) {
      expect(onClick).not.toHaveBeenCalled()
    } else {
      expect(onClick).toHaveBeenCalledOnce()
    }
  })

  // jsdom은 계산된 스타일을 모르므로 글자를 투명하게 가리고 호를 그리는 CSS는 확인하지 못한다.
  it('loading 중에도 글자가 접근 가능한 이름으로 남고 data-loading으로 진행 표시를 켠다', async () => {
    await render(
      <Button variant="primary" loading>
        검색
      </Button>
    )
    const button = getByRole('button', '검색')

    expect(button.hasAttribute('data-loading')).toBe(true)
  })

  it('화면이 넘긴 type과 ref를 native button에 전달한다', async () => {
    const ref = createRef<HTMLButtonElement>()
    await render(
      <Button ref={ref} type="submit">
        저장
      </Button>
    )

    expect(ref.current).toBe(getByRole('button', '저장'))
    expect(ref.current?.type).toBe('submit')
  })
})

describe('Pagination의 페이지 번호와 이전, 다음', () => {
  it('지금 페이지를 가운데 둔 번호 5개를 보이고, 누른 번호와 앞뒤 페이지를 전달한다', async () => {
    const onPageChange = vi.fn()
    await render(<Pagination page={6} pageCount={12} onPageChange={onPageChange} />)
    const nav = container.querySelector('nav[aria-label="페이지"]')!

    expect(nav.textContent).toBe('이전45678다음')
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('6')
    await click(getByRole('button', '8'))
    await click(getByRole('button', '다음'))
    await click(getByRole('button', '이전'))
    expect(onPageChange.mock.calls).toEqual([[8], [7], [5]])
  })

  it.each([
    { name: '첫 페이지', page: 1, pageCount: 12, text: '이전12345다음' },
    { name: '마지막 페이지', page: 12, pageCount: 12, text: '이전89101112다음' },
    { name: '페이지가 5개보다 적을 때', page: 2, pageCount: 3, text: '이전123다음' }
  ])('$name에서는 번호를 끝에 맞춰 보인다', async ({ page, pageCount, text }) => {
    await render(<Pagination page={page} pageCount={pageCount} onPageChange={vi.fn()} />)

    expect(container.querySelector('nav')?.textContent).toBe(text)
  })

  it('첫 페이지는 이전을, 마지막 페이지는 다음을 막고 disabled면 모든 버튼을 막는다', async () => {
    const onPageChange = vi.fn()
    await render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />)

    expect(getByRole('button', '이전').hasAttribute('disabled')).toBe(true)
    expect(getByRole('button', '다음').hasAttribute('disabled')).toBe(false)

    await render(<Pagination page={3} pageCount={3} onPageChange={onPageChange} />)

    expect(getByRole('button', '이전').hasAttribute('disabled')).toBe(false)
    expect(getByRole('button', '다음').hasAttribute('disabled')).toBe(true)

    await render(<Pagination page={2} pageCount={3} onPageChange={onPageChange} disabled />)
    const buttons = [...container.querySelectorAll('button')]

    expect(buttons.map((button) => button.disabled)).toEqual([true, true, true, true])
  })
})

function StepField({
  initial,
  disabled = false,
  onValueChange
}: {
  initial: number
  disabled?: boolean
  onValueChange: (value: number) => void
}) {
  const [value, setValue] = useState(initial)

  function change(next: number) {
    onValueChange(next)
    setValue(next)
  }

  return (
    <NumberField
      aria-label="무기 수치"
      value={value}
      onValueChange={change}
      min={0}
      max={3}
      disabled={disabled}
      format={{ signDisplay: 'always' }}
    />
  )
}

function stepInput() {
  return container.querySelector<HTMLInputElement>('input[aria-label="무기 수치"]')!
}

describe('NumberField의 한 칸씩 바꾸기와 범위 끝', () => {
  it('양옆 버튼은 입력칸 이름을 붙여 읽히고, 누를 때마다 한 칸씩 바꾼 값을 전달한다', async () => {
    const onValueChange = vi.fn<(value: number) => void>()
    await render(<StepField initial={1} onValueChange={onValueChange} />)

    expect(stepInput().value).toBe('+1')
    expect(stepInput().getAttribute('aria-roledescription')).toBe('숫자 입력')
    await click(getByRole('button', '무기 수치 올리기'))
    expect(onValueChange).toHaveBeenLastCalledWith(2)
    expect(stepInput().value).toBe('+2')
    await click(getByRole('button', '무기 수치 내리기'))
    await click(getByRole('button', '무기 수치 내리기'))
    expect(onValueChange).toHaveBeenLastCalledWith(0)
    expect(stepInput().value).toBe('+0')
  })

  it('범위 끝에 닿은 쪽 버튼만 막고 그 버튼은 값을 바꾸지 않는다', async () => {
    const onValueChange = vi.fn<(value: number) => void>()
    await render(<StepField initial={0} onValueChange={onValueChange} />)
    const decrement = getByRole('button', '무기 수치 내리기') as HTMLButtonElement
    const increment = getByRole('button', '무기 수치 올리기') as HTMLButtonElement

    expect([decrement.disabled, increment.disabled]).toEqual([true, false])
    await click(decrement)
    expect(onValueChange).not.toHaveBeenCalled()
    await click(increment)
    await click(increment)
    await click(increment)
    expect(stepInput().value).toBe('+3')
    expect([decrement.disabled, increment.disabled]).toEqual([false, true])
  })

  it('입력칸에서 위, 아래 화살표로 한 칸씩 바꾼다', async () => {
    const onValueChange = vi.fn<(value: number) => void>()
    await render(<StepField initial={1} onValueChange={onValueChange} />)

    await press(stepInput(), 'ArrowUp')
    expect(onValueChange).toHaveBeenLastCalledWith(2)
    await press(stepInput(), 'ArrowDown')
    expect(onValueChange).toHaveBeenLastCalledWith(1)
  })

  it('disabled면 입력칸과 두 버튼을 모두 막는다', async () => {
    await render(<StepField initial={1} disabled onValueChange={vi.fn()} />)
    const buttons = [
      getByRole('button', '무기 수치 내리기'),
      getByRole('button', '무기 수치 올리기')
    ] as HTMLButtonElement[]

    expect(stepInput().disabled).toBe(true)
    expect(buttons.map((button) => button.disabled)).toEqual([true, true])
  })
})

describe('TextField의 controlled 입력과 접근성 연결', () => {
  it('표시된 label이 편집 가능한 입력의 이름이 된다', async () => {
    await render(
      <TextField>
        <TextFieldLabel>표시 이름</TextFieldLabel>
        <TextFieldInput />
      </TextField>
    )

    expect(getByRole('textbox', '표시 이름')).toBeInstanceOf(HTMLInputElement)
  })

  it('TextField의 ref는 라벨과 입력을 담은 field를 가리킨다', async () => {
    const ref = createRef<HTMLDivElement>()
    await render(
      <TextField ref={ref}>
        <TextFieldLabel>표시 이름</TextFieldLabel>
        <TextFieldInput />
      </TextField>
    )

    expect(ref.current?.contains(getByRole('textbox', '표시 이름'))).toBe(true)
    expect(ref.current?.textContent).toBe('표시 이름')
  })

  it('편집 값을 전달하고 소비자가 변환한 controlled 값을 표시한다', async () => {
    const onValueChange = vi.fn<(value: string) => void>()
    function ControlledField() {
      const [value, setValue] = useState('')
      const handleValueChange = (nextValue: string) => {
        onValueChange(nextValue)
        setValue(nextValue.toUpperCase())
      }

      return (
        <TextField>
          <TextFieldLabel>표시 이름</TextFieldLabel>
          <TextFieldInput value={value} onValueChange={handleValueChange} />
        </TextField>
      )
    }
    await render(<ControlledField />)
    const input = getByRole('textbox', '표시 이름') as HTMLInputElement

    await editInput(input, 'New name')

    expect(onValueChange).toHaveBeenLastCalledWith('New name')
    expect(input.value).toBe('NEW NAME')

    await editInput(input, '')

    expect(onValueChange).toHaveBeenLastCalledWith('')
    expect(input.value).toBe('')
  })

  it('소비자가 편집 값을 채택하지 않으면 기존 controlled 값을 유지한다', async () => {
    const onValueChange = vi.fn<NonNullable<TextFieldInputProps['onValueChange']>>()
    await render(
      <TextField>
        <TextFieldLabel>표시 이름</TextFieldLabel>
        <TextFieldInput value="고정 이름" onValueChange={onValueChange} />
      </TextField>
    )
    const input = getByRole('textbox', '표시 이름') as HTMLInputElement

    await editInput(input, '바꾸려는 이름')

    expect(onValueChange).toHaveBeenLastCalledWith('바꾸려는 이름', expect.anything())
    expect(input.value).toBe('고정 이름')
  })

  it('입력에 직접 준 value와 onChange도 TextField 안에서 동작한다', async () => {
    function DirectField() {
      const [value, setValue] = useState('처음')

      return (
        <TextField>
          <TextFieldLabel>정답 닉네임</TextFieldLabel>
          <TextFieldInput value={value} onChange={(event) => setValue(event.target.value)} />
        </TextField>
      )
    }
    await render(<DirectField />)
    const input = getByRole('textbox', '정답 닉네임') as HTMLInputElement

    await editInput(input, '바뀐 값')

    expect(input.value).toBe('바뀐 값')
  })

  it('invalid 전환에 따라 오류 연결을 추가, 제거하며 설명 연결을 유지한다', async () => {
    function Field({ invalid }: { invalid: boolean }) {
      return (
        <TextField invalid={invalid}>
          <TextFieldLabel>표시 이름</TextFieldLabel>
          <TextFieldInput />
          <TextFieldDescription>다른 사람이 볼 이름입니다.</TextFieldDescription>
          <TextFieldError>이름을 입력해 주세요.</TextFieldError>
        </TextField>
      )
    }
    await render(<Field invalid={false} />)
    let input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(describedTexts(input)).toEqual(['다른 사람이 볼 이름입니다.'])

    await render(<Field invalid />)
    input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(new Set(describedTexts(input))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 입력해 주세요.'])
    )

    await render(<Field invalid={false} />)
    input = getByRole('textbox', '표시 이름')
    expect(input.getAttribute('aria-invalid')).not.toBe('true')
    expect(describedTexts(input)).toEqual(['다른 사람이 볼 이름입니다.'])
  })

  it('여러 입력의 label, 설명, 오류가 다른 필드와 섞이지 않는다', async () => {
    await render(
      <>
        <TextField invalid>
          <TextFieldLabel>표시 이름</TextFieldLabel>
          <TextFieldInput value="모험가" />
          <TextFieldDescription>다른 사람이 볼 이름입니다.</TextFieldDescription>
          <TextFieldError>이름을 확인해 주세요.</TextFieldError>
        </TextField>
        <TextField invalid>
          <TextFieldLabel>이메일</TextFieldLabel>
          <TextFieldInput value="hello@example.invalid" />
          <TextFieldDescription>연락받을 이메일입니다.</TextFieldDescription>
          <TextFieldError>이메일을 확인해 주세요.</TextFieldError>
        </TextField>
      </>
    )
    const name = getByRole('textbox', '표시 이름') as HTMLInputElement
    const email = getByRole('textbox', '이메일') as HTMLInputElement

    expect(name).not.toBe(email)
    expect(name.value).toBe('모험가')
    expect(email.value).toBe('hello@example.invalid')
    expect(new Set(describedTexts(name))).toEqual(
      new Set(['다른 사람이 볼 이름입니다.', '이름을 확인해 주세요.'])
    )
    expect(new Set(describedTexts(email))).toEqual(
      new Set(['연락받을 이메일입니다.', '이메일을 확인해 주세요.'])
    )
  })

  it('render로 합성한 input에 label과 값이 연결된다', async () => {
    const ref = createRef<HTMLInputElement>()
    function SearchField() {
      const [query, setQuery] = useState('')
      const input = <input ref={ref} />

      return (
        <TextField>
          <TextFieldLabel>구성 요소 검색</TextFieldLabel>
          <TextFieldInput render={input} value={query} onValueChange={setQuery} />
        </TextField>
      )
    }
    await render(<SearchField />)
    const input = getByRole('textbox', '구성 요소 검색') as HTMLInputElement

    await editInput(input, 'MIT')

    expect(ref.current).toBe(input)
    expect(input.value).toBe('MIT')
  })
})

function SettingsIcon() {
  return <svg data-testid="settings-icon" viewBox="0 0 24 24" />
}

describe('IconButton의 이름, 클릭, disabled', () => {
  it('아이콘만 보이는 버튼이 aria-label을 이름으로 갖고 클릭과 ref를 전달한다', async () => {
    const onClick = vi.fn<NonNullable<IconButtonProps['onClick']>>()
    const ref = createRef<HTMLButtonElement>()
    await render(
      <IconButton ref={ref} aria-label="설정" icon={<SettingsIcon />} onClick={onClick} />
    )
    const button = getByRole('button', '설정')

    expect(ref.current).toBe(button)
    expect(button.textContent).toBe('')
    expect(button.querySelector('[data-testid="settings-icon"]')).not.toBeNull()
    await click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disabled 버튼은 클릭을 차단한다', async () => {
    const onClick = vi.fn<NonNullable<IconButtonProps['onClick']>>()
    await render(
      <IconButton aria-label="캡처 연결 예정" icon={<SettingsIcon />} disabled onClick={onClick} />
    )
    const button = getByRole('button', '캡처 연결 예정') as HTMLButtonElement

    expect(button.disabled).toBe(true)
    await click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  // jsdom은 계산된 크기를 모르므로 크기마다 다른 class가 붙는지만 확인한다.
  it('헤더 도구 크기 lg는 기본 md와 다른 외형을 쓴다', async () => {
    await render(
      <>
        <IconButton aria-label="기본" icon={<SettingsIcon />} />
        <IconButton aria-label="헤더 도구" size="lg" icon={<SettingsIcon />} />
      </>
    )

    expect(getByRole('button', '헤더 도구').className).not.toBe(
      getByRole('button', '기본').className
    )
  })

  it('pressed 값을 aria-pressed로 전하고 눌림 외형은 pressed 없이 받은 aria-pressed에도 같이 켜진다', async () => {
    await render(
      <>
        <IconButton aria-label="꺼짐" size="lg" pressed={false} icon={<SettingsIcon />} />
        <IconButton aria-label="켜짐" size="lg" pressed icon={<SettingsIcon />} />
        <IconButton aria-label="직접 켜짐" size="lg" aria-pressed="true" icon={<SettingsIcon />} />
        <IconButton aria-label="토글 아님" size="lg" icon={<SettingsIcon />} />
      </>
    )
    const off = getByRole('button', '꺼짐')
    const on = getByRole('button', '켜짐')
    const direct = getByRole('button', '직접 켜짐')
    const plain = getByRole('button', '토글 아님')

    expect(off.getAttribute('aria-pressed')).toBe('false')
    expect(on.getAttribute('aria-pressed')).toBe('true')
    expect(direct.getAttribute('aria-pressed')).toBe('true')
    expect(plain.hasAttribute('aria-pressed')).toBe(false)
    for (const button of [off, direct, plain]) {
      expect(button.className).toBe(on.className)
    }
  })
})

const servers = [
  { id: 'cain', label: '카인' },
  { id: 'diregie', label: '디레지에' },
  { id: 'siroco', label: '시로코' }
]

function ServerSelect({
  onValueChange,
  columns
}: {
  onValueChange: (value: string | null) => void
  columns?: number
}) {
  const [value, setValue] = useState<string | null>('siroco')

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
      items={servers.map((server) => ({ value: server.id, label: server.label }))}
    >
      <Select.Trigger size="xs" aria-label="서버">
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label="서버 목록" columns={columns}>
        {servers.map((server) => (
          <Select.Item key={server.id} value={server.id}>
            <Select.ItemText>{server.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

describe('Select의 키보드 선택과 포커스 복귀', () => {
  it('trigger에서 목록을 열고 화살표와 Enter로 고르면 값을 전달하고 trigger로 돌아온다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} />)
    const trigger = getByRole('combobox', '서버')
    expect(trigger.textContent).toContain('시로코')
    trigger.focus()

    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox'))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const current = getByRole('option', '시로코', listbox)
    expect(current.getAttribute('aria-selected')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement).toBe(current))

    await press(current, 'ArrowUp')
    const previous = getByRole('option', '디레지에', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(previous))
    await press(previous, 'Enter')

    expect(onValueChange).toHaveBeenLastCalledWith('diregie')
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    expect(trigger.textContent).toContain('디레지에')
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('columns를 주면 목록을 그 수의 열로 늘어놓고 화살표로 읽는 순서대로 옮긴다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} columns={2} />)
    const trigger = getByRole('combobox', '서버')
    trigger.focus()

    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox', '서버 목록'))
    expect(listbox.classList.contains('listbox-grid')).toBe(true)
    expect(listbox.style.getPropertyValue('--listbox-columns')).toBe('2')
    const current = getByRole('option', '시로코', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(current))
    await press(current, 'ArrowUp')
    const previous = getByRole('option', '디레지에', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(previous))
    await press(previous, 'Enter')

    expect(onValueChange).toHaveBeenLastCalledWith('diregie')
  })

  it('columns가 없으면 한 줄 목록이다', async () => {
    await render(<ServerSelect onValueChange={vi.fn()} />)
    const trigger = getByRole('combobox', '서버')
    await click(trigger)
    const listbox = await vi.waitFor(() => getByRole('listbox', '서버 목록'))
    expect(listbox.classList.contains('listbox-grid')).toBe(false)
  })

  it('Escape로 닫으면 값을 바꾸지 않고 trigger로 focus를 돌려준다', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>()
    await render(<ServerSelect onValueChange={onValueChange} />)
    const trigger = getByRole('combobox', '서버')
    trigger.focus()
    await press(trigger, 'ArrowDown')
    const listbox = await vi.waitFor(() => getByRole('listbox'))
    const current = getByRole('option', '시로코', listbox)
    await vi.waitFor(() => expect(document.activeElement).toBe(current))

    await press(current, 'Escape')

    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    expect(onValueChange).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

function ItemSelect({ onValueChange }: { onValueChange: (value: string[]) => void }) {
  const [value, setValue] = useState<string[]>([])
  const items = [
    { value: 'ring', label: '반지 아이템' },
    { value: 'support', label: '보조장비 아이템' }
  ]

  function valueText(values: string[]): string {
    if (values.length === 0) {
      return '전체'
    }

    return `${values.length}개`
  }

  return (
    <Select.Root
      multiple
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
      items={items}
    >
      <Select.Trigger size="sm" aria-label="아이템">
        {value.map((itemId) => (
          <img key={itemId} alt="" data-icon={itemId} />
        ))}
        <Select.Value>{valueText}</Select.Value>
      </Select.Trigger>
      <Select.Popup aria-label="아이템 목록">
        {items.map((item) => (
          <Select.Item key={item.value} value={item.value}>
            <img alt="" data-icon={item.value} />
            <Select.ItemText>{item.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

describe('Select의 아이콘과 여러 개 고르기', () => {
  it('항목 글자 왼쪽의 아이콘은 이름에 섞이지 않고, multiple이면 고를 때마다 고른 값 배열을 전달하고 목록을 열어 둔다', async () => {
    const onValueChange = vi.fn<(value: string[]) => void>()
    await render(<ItemSelect onValueChange={onValueChange} />)
    const trigger = getByRole('combobox', '아이템')
    expect(trigger.textContent).toBe('전체')

    await click(trigger)
    const listbox = await vi.waitFor(() => getByRole('listbox', '아이템 목록'))
    const ring = getByRole('option', '반지 아이템', listbox)
    expect(ring.querySelector('img[data-icon="ring"]')).not.toBeNull()
    await click(ring)
    await click(getByRole('option', '보조장비 아이템', listbox))

    expect(onValueChange).toHaveBeenLastCalledWith(['ring', 'support'])
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.textContent).toBe('2개')
    expect(
      [...trigger.querySelectorAll('img')].map((icon) => icon.getAttribute('data-icon'))
    ).toEqual(['ring', 'support'])
    await click(ring)
    expect(onValueChange).toHaveBeenLastCalledWith(['support'])
  })
})

describe('Popover의 열고 닫기와 focus 복귀', () => {
  function SnapshotPopover() {
    return (
      <Popover.Root>
        <Popover.Trigger render={<Button />}>고정</Popover.Trigger>
        <Popover.Popup>
          <Popover.Title>고정을 취소하시겠습니까?</Popover.Title>
          <Popover.Close render={<Button />}>유지</Popover.Close>
        </Popover.Popup>
      </Popover.Root>
    )
  }

  it('trigger를 누르면 body portal에 열리고 Escape로 닫으면 trigger로 focus를 돌려준다', async () => {
    await render(<SnapshotPopover />)
    const trigger = getByRole('button', '고정')

    await click(trigger)
    const popup = await vi.waitFor(() => getByRole('dialog', '고정을 취소하시겠습니까?'))
    expect(container.contains(popup)).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await vi.waitFor(() => expect(popup.contains(document.activeElement)).toBe(true))

    await press(document.activeElement as HTMLElement, 'Escape')

    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Close 버튼으로 닫으면 trigger로 focus를 돌려준다', async () => {
    await render(<SnapshotPopover />)
    const trigger = getByRole('button', '고정')
    await click(trigger)
    const popup = await vi.waitFor(() => getByRole('dialog', '고정을 취소하시겠습니까?'))

    await click(getByRole('button', '유지', popup))

    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'))
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('ConfirmPopover의 확인 흐름', () => {
  function DeletePopover({ onConfirm }: { onConfirm: () => Promise<unknown> }) {
    return (
      <ConfirmPopover title="batch key 삭제" confirmLabel="삭제" onConfirm={onConfirm}>
        <Popover.Trigger render={<Button />}>삭제</Popover.Trigger>
      </ConfirmPopover>
    )
  }

  async function open() {
    await click(getByRole('button', '삭제'))

    return vi.waitFor(() => getByRole('alertdialog', 'batch key 삭제'))
  }

  it('열리면 취소 버튼에 focus가 간다', async () => {
    await render(<DeletePopover onConfirm={async () => {}} />)

    const popup = await open()

    await vi.waitFor(() => expect(document.activeElement).toBe(getByRole('button', '취소', popup)))
  })

  it('확인 요청이 끝날 때까지 확인 버튼을 막고, 성공하면 닫는다', async () => {
    let finish = () => {}
    const request = new Promise<void>((resolve) => {
      finish = resolve
    })
    await render(<DeletePopover onConfirm={() => request} />)
    const popup = await open()
    const confirm = getByRole('button', '삭제', popup) as HTMLButtonElement

    await click(confirm)
    expect(confirm.disabled).toBe(true)
    await act(async () => finish())

    await vi.waitFor(() =>
      expect(getByRole('button', '삭제').getAttribute('aria-expanded')).toBe('false')
    )
  })

  it('확인 요청이 실패하면 열린 채 실패 문구를 보이고 확인 버튼을 다시 누를 수 있다', async () => {
    await render(<DeletePopover onConfirm={async () => Promise.reject(new Error('요청 실패'))} />)
    const popup = await open()
    const confirm = getByRole('button', '삭제', popup) as HTMLButtonElement

    await click(confirm)

    await vi.waitFor(() =>
      expect(getByRole('alert', undefined, popup).textContent).toBe('요청에 실패했습니다.')
    )
    expect(popup.isConnected).toBe(true)
    expect(confirm.disabled).toBe(false)
  })
})

describe('Tabs의 키보드 이동과 패널 연결', () => {
  // 탭은 native button이다. jsdom은 Enter의 기본 click을 만들지 않으므로 고르기는 click으로 보낸다.
  it('화살표로 다음 탭에 focus를 옮기고 고르면 그 패널을 보인다', async () => {
    await render(
      <Tabs.Root defaultValue="collection">
        <Tabs.List aria-label="개발자 도구">
          <Tabs.Tab value="collection">수집</Tabs.Tab>
          <Tabs.Tab value="labeling">정답 입력</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="collection">수집 패널</Tabs.Panel>
        <Tabs.Panel value="labeling">정답 패널</Tabs.Panel>
      </Tabs.Root>
    )
    const collection = getByRole('tab', '수집')
    const labeling = getByRole('tab', '정답 입력')
    expect(collection.getAttribute('aria-selected')).toBe('true')
    expect(getByRole('tabpanel').textContent).toBe('수집 패널')
    collection.focus()

    await press(collection, 'ArrowRight')
    await vi.waitFor(() => expect(document.activeElement).toBe(labeling))
    await click(labeling)

    await vi.waitFor(() => expect(labeling.getAttribute('aria-selected')).toBe('true'))
    expect(collection.getAttribute('aria-selected')).toBe('false')
    const panel = getByRole('tabpanel')
    expect(panel.textContent).toBe('정답 패널')
    expect(panel.getAttribute('aria-labelledby')).toBe(labeling.id)
  })

  it('비활성 탭은 눌러도 고르지 않는다', async () => {
    await render(
      <Tabs.Root defaultValue="character">
        <Tabs.List aria-label="캐릭터 정보">
          <Tabs.Tab value="character">캐릭터</Tabs.Tab>
          <Tabs.Tab value="equipment" disabled>
            장비
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="character">캐릭터 패널</Tabs.Panel>
        <Tabs.Panel value="equipment">장비 패널</Tabs.Panel>
      </Tabs.Root>
    )
    const equipment = getByRole('tab', '장비')
    expect(equipment.getAttribute('aria-disabled')).toBe('true')

    await click(equipment)

    expect(getByRole('tab', '캐릭터').getAttribute('aria-selected')).toBe('true')
    expect(getByRole('tabpanel').textContent).toBe('캐릭터 패널')
  })
})

describe('Switch, Checkbox, Chip의 켜짐 상태', () => {
  it('Switch를 누르면 켜짐 값을 전달하고 상태를 알린다', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>()
    await render(<Switch aria-label="자동 캡처" onCheckedChange={onCheckedChange} />)
    const control = getByRole('switch', '자동 캡처')
    expect(control.getAttribute('aria-checked')).toBe('false')

    await click(control)

    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything())
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('Checkbox를 누르면 켜짐 값을 전달하고 켜진 동안만 체크 표시를 그린다', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>()
    await render(<Checkbox aria-label="첫 번째 진의" onCheckedChange={onCheckedChange} />)
    const control = getByRole('checkbox', '첫 번째 진의')
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.querySelector('svg')).toBeNull()

    await click(control)

    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything())
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.querySelector('svg')).not.toBeNull()
  })

  it('비활성 Checkbox는 눌러도 켜지지 않는다', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>()
    await render(<Checkbox aria-label="첫 번째 진의" disabled onCheckedChange={onCheckedChange} />)
    const control = getByRole('checkbox', '첫 번째 진의')

    await click(control)

    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(control.getAttribute('aria-checked')).toBe('false')
  })

  it('Chip은 누를 때마다 aria-pressed를 바꾼다', async () => {
    await render(<Chip>원본</Chip>)
    const chip = getByRole('button', '원본')
    expect(chip.getAttribute('aria-pressed')).toBe('false')

    await click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')

    await click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('false')
  })
})

const PERIODS = [
  { value: 'half', label: '반년' },
  { value: 'quarter', label: '분기' },
  { value: 'month', label: '한 달' }
] as const

type Period = (typeof PERIODS)[number]['value']

function PeriodChips({
  initial = 'half',
  onValueChange
}: {
  initial?: Period
  onValueChange: (value: Period) => void
}) {
  const [period, setPeriod] = useState<Period>(initial)

  function change(value: Period) {
    onValueChange(value)
    setPeriod(value)
  }

  return <ChipGroup aria-label="기간" items={PERIODS} value={period} onValueChange={change} />
}

function pressedLabels(group: HTMLElement) {
  return [...group.querySelectorAll('button[aria-pressed="true"]')].map((chip) => chip.textContent)
}

describe('ChipGroup의 하나만 고르기와 키보드 이동', () => {
  it('다른 칩을 누르면 그 칩만 켜고, 이미 고른 칩을 다시 눌러도 값을 바꾸지 않는다', async () => {
    const onValueChange = vi.fn<(value: Period) => void>()
    await render(<PeriodChips onValueChange={onValueChange} />)
    const group = getByRole('group', '기간')
    expect(pressedLabels(group)).toEqual(['반년'])

    await click(getByRole('button', '분기', group))
    expect(onValueChange).toHaveBeenLastCalledWith('quarter')
    expect(pressedLabels(group)).toEqual(['분기'])

    await click(getByRole('button', '분기', group))
    expect(onValueChange).toHaveBeenCalledOnce()
    expect(pressedLabels(group)).toEqual(['분기'])
  })

  it('Tab 키는 묶음에서 칩 하나에만 멈추고 화살표로 칩 사이를 옮긴다', async () => {
    await render(<PeriodChips initial="quarter" onValueChange={vi.fn()} />)
    const group = getByRole('group', '기간')
    const chips = [...group.querySelectorAll<HTMLElement>('button')]
    const tabStops = chips.filter((chip) => chip.tabIndex === 0)
    expect(tabStops).toHaveLength(1)
    const [stop] = tabStops
    stop.focus()

    await press(stop, 'ArrowRight')

    await vi.waitFor(() => expect(document.activeElement).toBe(chips[chips.indexOf(stop) + 1]))
  })
})

describe('StatusChip의 상태 알림 범위', () => {
  it('호출자가 status 영역을 요청하면 상태 글자만 알린다', async () => {
    await render(
      <StatusChip tone="success" role="status">
        창 감지됨
      </StatusChip>
    )

    expect(getByRole('status').textContent).toBe('창 감지됨')
  })

  it('호출자가 요청하지 않으면 live region을 만들지 않는다', async () => {
    await render(<StatusChip tone="warning">파티원창 찾는 중</StatusChip>)

    expect(container.textContent).toBe('파티원창 찾는 중')
    expect(container.querySelector('[role]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})

describe('StatusChip의 tone과 진행 표시', () => {
  it('tone을 data 속성으로 드러내고 진행 중이면 점 대신 spinner를 둔다', async () => {
    await render(
      <>
        <StatusChip tone="neutral">준비 중</StatusChip>
        <StatusChip tone="success">창 감지됨</StatusChip>
        <StatusChip tone="danger">조회 실패</StatusChip>
        <StatusChip tone="warning">확인 필요</StatusChip>
        <StatusChip tone="signal">인식 완료</StatusChip>
        <StatusChip tone="signal" busy>
          인식 중
        </StatusChip>
      </>
    )
    const chips = [...container.querySelectorAll<HTMLElement>('[data-tone]')]
    const [, , , , done, busy] = chips

    expect(chips.map((chip) => chip.dataset.tone)).toEqual([
      'neutral',
      'success',
      'danger',
      'warning',
      'signal',
      'signal'
    ])
    expect(done.hasAttribute('data-busy')).toBe(false)
    expect(
      [...done.querySelectorAll('[aria-hidden="true"]')].map((mark) => mark.className)
    ).toEqual(['status-dot'])
    expect(busy.hasAttribute('data-busy')).toBe(true)
    expect(
      [...busy.querySelectorAll('[aria-hidden="true"]')].map((mark) => mark.className)
    ).toEqual(['status-spinner'])
    expect(busy.textContent).toBe('인식 중')
  })
})

describe('Tooltip의 터치 탭', () => {
  async function tap(target: Element) {
    await act(async () => {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })
      )
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
  }

  function tooltip() {
    return document.querySelector('.tooltip')
  }

  function Described({ onCopy }: { onCopy?: () => void }) {
    return (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger render={<span tabIndex={0} />}>스킬</Tooltip.Trigger>
          <Tooltip.Popup>스킬 설명</Tooltip.Popup>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger render={<span />}>
            <IconButton aria-label="복사" icon={<SettingsIcon />} onClick={onCopy} />
          </Tooltip.Trigger>
          <Tooltip.Popup>복사하기</Tooltip.Popup>
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  }

  it('trigger를 탭하면 열리고, 같은 trigger를 다시 탭하면 닫힌다', async () => {
    await render(<Described />)
    const trigger = container.querySelector('[data-base-ui-tooltip-trigger]') as Element

    await tap(trigger)
    await vi.waitFor(() => expect(tooltip()?.textContent).toBe('스킬 설명'))

    await tap(trigger)
    await vi.waitFor(() => expect(tooltip()).toBeNull())
  })

  it('trigger 안의 버튼을 탭하면 버튼 동작만 하고 이름 Tooltip은 열지 않는다', async () => {
    const onCopy = vi.fn()
    await render(<Described onCopy={onCopy} />)

    await tap(getByRole('button', '복사'))

    expect(onCopy).toHaveBeenCalledOnce()
    expect(tooltip()).toBeNull()
  })

  it('링크 행 안의 trigger를 탭하면 링크로 이동하지 않고 Tooltip을 연다', async () => {
    await render(
      <a href="#item">
        <Tooltip.Root>
          <Tooltip.Trigger render={<span />}>아이템</Tooltip.Trigger>
          <Tooltip.Popup>아이템 상세</Tooltip.Popup>
        </Tooltip.Root>
      </a>
    )
    const trigger = container.querySelector('[data-base-ui-tooltip-trigger]') as Element
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })

    await act(async () => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })
      )
      trigger.dispatchEvent(clickEvent)
    })

    await vi.waitFor(() => expect(tooltip()?.textContent).toBe('아이템 상세'))
    expect(clickEvent.defaultPrevented).toBe(true)
  })

  it('링크 행 안 Tooltip의 내용을 눌러도 링크의 click handler로 올라가지 않는다', async () => {
    const onLinkClick = vi.fn()
    await render(
      <a href="#item" onClick={onLinkClick}>
        <Tooltip.Root defaultOpen>
          <Tooltip.Trigger render={<span />}>아이템</Tooltip.Trigger>
          <Tooltip.Popup>아이템 상세</Tooltip.Popup>
        </Tooltip.Root>
      </a>
    )
    const popup = await vi.waitFor(() => {
      const shown = tooltip()
      expect(shown).not.toBeNull()

      return shown as HTMLElement
    })

    await click(popup)

    expect(onLinkClick).not.toHaveBeenCalled()
  })

  it('마우스 클릭은 Tooltip을 열지 않는다', async () => {
    await render(<Described />)
    const trigger = container.querySelector('[data-base-ui-tooltip-trigger]') as HTMLElement

    await act(async () => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' })
      )
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(tooltip()).toBeNull()
  })
})
