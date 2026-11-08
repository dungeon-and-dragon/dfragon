import { expect, it } from 'vitest'
import { buildCommit } from './build-commit.ts'

it('빌드 commit은 40자리 commit의 앞 7자리이고 값이 없거나 빈 문자열이면 dev다', () => {
  expect(buildCommit('133a9f26e1c0b5d4a7f8e9d0c1b2a3f4e5d6c7b8')).toBe('133a9f2')
  expect(buildCommit('')).toBe('dev')
  expect(buildCommit(undefined)).toBe('dev')
})
