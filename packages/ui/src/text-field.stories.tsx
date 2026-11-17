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
    <div className="max-w-sm">
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
    <div className="grid max-w-sm gap-4">
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
    <div className="grid max-w-sm gap-6">
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
