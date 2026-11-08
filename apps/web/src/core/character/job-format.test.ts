import { expect, it } from 'vitest'
import { formatJobName } from './job-format'

it.each([
  ['앞의 眞과 공백', '眞 웨펀마스터', '웨펀마스터'],
  ['공백 없이 붙은 앞의 眞', '眞웨펀마스터', '웨펀마스터'],
  ['眞이 없는 이름', '웨펀마스터', '웨펀마스터'],
  ['가운데와 끝의 眞', '웨펀眞마스터眞', '웨펀眞마스터眞'],
  ['지우면 빈 이름', '眞 ', '眞 ']
])('%s: %s를 %s로 보인다', (_, jobName, shown) => {
  expect(formatJobName(jobName)).toBe(shown)
})
