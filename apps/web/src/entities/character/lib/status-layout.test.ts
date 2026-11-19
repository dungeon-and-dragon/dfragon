import { expect, it } from 'vitest'
import { toStatusLayout } from './status-layout'

it('값이 같은 최고 스탯은 모두 굵게 두고, 값이 글자인 스탯은 비교하지 않는다', () => {
  const { main } = toStatusLayout([
    { name: '힘', value: 4000 },
    { name: '지능', value: 4000 },
    { name: '체력', value: 3000 },
    { name: '물리 크리티컬', value: '-' },
    { name: '마법 크리티컬', value: 50 },
    { name: '모험가 명성', value: 100 }
  ])

  expect(main.filter(({ emphasized }) => emphasized).map(({ name }) => name)).toEqual([
    '힘',
    '지능',
    '마법 크리티컬'
  ])
})

it('모험가 명성이 없으면 응답 순서 그대로 한 묶음으로 둔다', () => {
  const stats = [
    { name: '화속성 강화', value: 300 },
    { name: 'HP', value: 1 },
    { name: '적중률', value: 2 }
  ]

  expect(toStatusLayout(stats)).toEqual({
    main: [
      { name: '화속성 강화', value: 300, emphasized: true },
      { name: 'HP', value: 1, emphasized: false },
      { name: '적중률', value: 2, emphasized: false }
    ],
    rest: []
  })
})
