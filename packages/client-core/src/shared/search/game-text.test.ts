import { expect, it } from 'vitest'
import { gameTextLinesOf } from './game-text'

it('PVF 문구의 백슬래시 n을 줄로 나누고 %%를 %로 바꾼다', () => {
  expect(gameTextLinesOf('모든 속도 +7%%\\n\\n - 총 11 증가')).toEqual([
    [{ text: '모든 속도 +7%', tone: 'default' }],
    [],
    [{ text: ' - 총 11 증가', tone: 'default' }]
  ])
})

it('강조와 비활성 표지는 다음 표지까지 이어지고, 그 밖의 표지는 기본 색으로 돌린다', () => {
  const raw =
    '<tst::primeval><tst::up_color>[투룡의 불꽃]<tst::default> [장비 발동 옵션]<tst::primeval>\\n' +
    '<tst::ui_disable>[용투장의 난 세트] 장착 시\\n상시 적용<tst::primeval> 끝'

  expect(gameTextLinesOf(raw)).toEqual([
    [
      { text: '[투룡의 불꽃]', tone: 'accent' },
      { text: ' [장비 발동 옵션]', tone: 'default' }
    ],
    [{ text: '[용투장의 난 세트] 장착 시', tone: 'subtle' }],
    [
      { text: '상시 적용', tone: 'subtle' },
      { text: ' 끝', tone: 'default' }
    ]
  ])
})
