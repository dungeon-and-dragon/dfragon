import type { Meta, StoryObj } from '@storybook/react-vite'
import { useFavoriteCharacterStore } from '#hooks/useFavoriteCharacterStore'
import { StoryFrame } from '#testing/story-support/StoryFrame'
import { StoryScreen } from '#testing/story-support/StoryScreen'
import { storyFavoriteCharacters } from '#testing/story-support/story-adventure'
import { FavoritesPage } from './FavoritesPage'

const meta = {
  title: 'Screens/즐겨찾기',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <StoryFrame>
      <StoryScreen>
        <FavoritesPage />
      </StoryScreen>
    </StoryFrame>
  )
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const 즐겨찾기: Story = {
  beforeEach: () => {
    useFavoriteCharacterStore.setState({ favoriteCharacters: storyFavoriteCharacters })
  }
}

export const 비어있음: Story = {
  beforeEach: () => {
    useFavoriteCharacterStore.setState({ favoriteCharacters: [] })
  }
}
