import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '#pages/favorites'
import { pageHead } from '#shared/lib/page-head'

export const Route = createFileRoute('/favorites')({
  head: () => pageHead({ title: '즐겨찾기', path: '/favorites', indexed: false }),
  component: FavoritesPage
})
