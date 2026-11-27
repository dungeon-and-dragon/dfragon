import gsap from 'gsap'
import { type RefObject, useEffect } from 'react'
import { MOTION_QUERY } from '#shared/lib/animations/gsap-motion'

const NUDGE_PX = 4
const NUDGE_SECONDS = 0.45

// 마우스를 올린 동안 화살표가 가리키는 쪽(1은 아래, -1은 위)으로 부드럽게 움직였다 돌아오기를 되풀이하고,
// 마우스를 떼면 제자리로 돌아온다.
export function useArrowNudge(
  trigger: RefObject<HTMLElement | null>,
  arrow: RefObject<HTMLElement | null>,
  direction: 1 | -1
): void {
  useEffect(() => {
    const target = trigger.current
    const icon = arrow.current

    if (target == null || icon == null) {
      return
    }

    const media = gsap.matchMedia()
    media.add(MOTION_QUERY, () => {
      const nudge = gsap.to(icon, {
        y: NUDGE_PX * direction,
        duration: NUDGE_SECONDS,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        paused: true
      })

      function start(): void {
        nudge.restart()
      }

      function stop(): void {
        nudge.pause()
        gsap.to(icon, { y: 0, duration: NUDGE_SECONDS / 2, ease: 'sine.out' })
      }

      target.addEventListener('pointerenter', start)
      target.addEventListener('pointerleave', stop)

      // 눌러서 방향이 바뀌면 효과를 다시 걸므로, 마우스가 이미 올라가 있으면 바로 움직인다.
      if (target.matches(':hover')) {
        start()
      }

      return () => {
        target.removeEventListener('pointerenter', start)
        target.removeEventListener('pointerleave', stop)
      }
    })

    return () => media.revert()
  }, [trigger, arrow, direction])
}
