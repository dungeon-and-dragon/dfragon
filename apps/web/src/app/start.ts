import { createStart } from '@tanstack/react-start'

// 화면은 서버에서 그리겠다고 밝힌 route만 서버에서 그리고, 나머지는 브라우저에서 그린다.
export const startInstance = createStart(() => ({ defaultSsr: false }))
