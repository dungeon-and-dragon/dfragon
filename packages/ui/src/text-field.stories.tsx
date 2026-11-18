import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  TextField,
  TextFieldDescription,
  TextFieldError,
  TextFieldInput,
  TextFieldLabel
} from './text-field'

const SIZES = ['sm', 'md', 'lg'] as const

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: { size: 'md', invalid: false, disabled: false, children: null },
  argTypes: {
    size: { control: 'inline-radio', options: SIZES },
    children: { control: false },
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' }
  },
  render: (args) => (
    <div className="max-w-[384px]">
      <TextField {...args}>
        <TextFieldLabel>캐릭터 이름</TextFieldLabel>
        <TextFieldInput placeholder="이름을 입력합니다" />
        <TextFieldDescription>두 글자 이상 입력합니다.</TextFieldDescription>
        <TextFieldError>이름을 입력해 주세요.</TextFieldError>
      </TextField>
    </div>
  )
} satisfies Meta<typeof TextField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-[384px] gap-4">
      {SIZES.map((size) => (
        <TextField key={size} size={size}>
          <TextFieldLabel>{size}</TextFieldLabel>
          <TextFieldInput defaultValue="던전앤파이터" />
        </TextField>
      ))}
    </div>
  )
}

export const States: Story = {
  render: () => (
    <div className="grid max-w-[384px] gap-6">
      <TextField>
        <TextFieldLabel>기본</TextFieldLabel>
        <TextFieldInput placeholder="이름을 입력합니다" />
      </TextField>
      <TextField invalid>
        <TextFieldLabel>오류</TextFieldLabel>
        <TextFieldInput defaultValue="가" />
        <TextFieldDescription>두 글자 이상 입력합니다.</TextFieldDescription>
        <TextFieldError>두 글자 이상 입력해 주세요.</TextFieldError>
      </TextField>
      <TextField disabled>
        <TextFieldLabel>비활성</TextFieldLabel>
        <TextFieldInput defaultValue="바꿀 수 없음" />
      </TextField>
      <TextField>
        <TextFieldLabel>읽기 전용</TextFieldLabel>
        <TextFieldInput defaultValue="읽기만 함" readOnly />
      </TextField>
    </div>
  )
}

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('input')?.focus()
  }
}

export const Html: Story = {
  render: () => (
    <div className="grid max-w-[384px] gap-6">
      <div className="field">
        <label className="field-label" htmlFor="html-name">
          기본
        </label>
        <div className="field-box field-box-md">
          <input id="html-name" className="field-input" placeholder="이름을 입력합니다" />
        </div>
      </div>
      <div className="field" data-invalid="">
        <label className="field-label" htmlFor="html-invalid">
          오류
        </label>
        <div className="field-box field-box-md">
          <input id="html-invalid" className="field-input" defaultValue="가" aria-invalid="true" />
        </div>
        <p className="field-description">두 글자 이상 입력합니다.</p>
        <p className="field-error">두 글자 이상 입력해 주세요.</p>
      </div>
      <div className="field" data-disabled="">
        <label className="field-label" htmlFor="html-disabled">
          비활성
        </label>
        <div className="field-box field-box-md">
          <input id="html-disabled" className="field-input" defaultValue="바꿀 수 없음" disabled />
        </div>
      </div>
    </div>
  )
}
