import type { TimelineSyncQueue } from './queue.js'

export type TimelineSyncWaiter = Pick<TimelineSyncQueue, 'requestAndWait'>
