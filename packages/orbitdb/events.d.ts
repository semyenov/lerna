import type { Entry } from './log'
import type { EventEmitter } from 'node:events'

interface SyncEvents<T> extends EventEmitter {
  on(
    event: 'join',
    listener: (peerId: string, heads: Entry.Instance<T>[]) => void,
  ): this
  on(event: 'leave', listener: (peerId: string) => void): this
  on(event: 'error', listener: (error: Error) => void): this
}

interface DatabaseEvents<T = unknown> extends EventEmitter {
  on(
    event: 'join',
    listener: (peerId: string, heads: Entry.Instance<T>[]) => void,
  ): this
  on(event: 'leave', listener: (peerId: string) => void): this
  on(event: 'close', listener: () => void): this
  on(event: 'drop', listener: () => void): this
  on(event: 'error', listener: (error: Error) => void): this
  on(event: 'update', listener: (entry: Entry.Instance<T>) => void): this
}

export type { DatabaseEvents, SyncEvents }
