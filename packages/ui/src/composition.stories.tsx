import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { ContentStack, ExampleSection, SupportingText } from './composition'

const meta = {
  title: 'Components/Composition',
  component: ContentStack
} satisfies Meta<typeof ContentStack>

export default meta

type Story = StoryObj<typeof meta>

export const Stack: Story = {
  render: () => (
    <ContentStack>
      <SupportingText>보조 글자입니다.</SupportingText>
      <ExampleSection title="묶음 제목">
        <SupportingText>묶음 안의 보조 글자입니다.</SupportingText>
        <div>
          <Button>버튼</Button>
        </div>
      </ExampleSection>
      <ExampleSection title="두 번째 묶음">
        <SupportingText>묶음끼리의 간격을 봅니다.</SupportingText>
      </ExampleSection>
    </ContentStack>
  )
}
