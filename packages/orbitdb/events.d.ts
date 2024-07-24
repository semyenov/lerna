import type { EventEmitter } from 'node:events'

interface SyncEvents<T> extends EventEmitter {
  on: ((
    event: 'join',
    listener: (peerId: string, heads: EntryInstance<T>[]) => void,
  ) => this) &
    ((event: 'leave', listener: (peerId: string) => void) => this) &
    ((event: 'error', listener: (error: Error) => void) => this)
}

interface DatabaseEvents<T = unknown> extends EventEmitter {
  on: ((
    event: 'join',
    listener: (peerId: string, heads: EntryInstance<T>[]) => void,
  ) => this) &
    ((event: 'leave', listener: (peerId: string) => void) => this) &
    ((event: 'close', listener: () => void) => this) &
    ((event: 'drop', listener: () => void) => this) &
    ((event: 'error', listener: (error: Error) => void) => this) &
    ((event: 'update', listener: (entry: EntryInstance<T>) => void) => this)
}

export type { DatabaseEvents, SyncEvents }
