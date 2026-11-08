import { notifyManager } from '@tanstack/react-query'

// TanStack Query는 받은 값을 setTimeout(0) 뒤에 알리므로 act가 끝나도 화면이 그대로다. 테스트에서는 microtask로
// 알려 act 안에서 그리게 한다.
notifyManager.setScheduler(queueMicrotask)
