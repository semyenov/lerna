import type { AccessControllerInstance } from './access-controller'
import type { IdentitiesInstance, IdentityInstance } from './identities'
import type { StorageInstance } from './storage'
import type { IPFS } from './vendor'

interface Clock {
  id: string
  time: number
}

export namespace Entry {
  export interface Instance<T = unknown> {
    id: string
    payload: {
      op: 'PUT' | 'DEL'
      key: string
      value: T
    }
    hash: string
    next: string[]
    refs: string[]
    clock: Clock
    v: number
    key: string
    identity: string
    sig: string
  }

  export function create<T>(
    identity: IdentityInstance,
    id: string,
    payload: T,
    clock?: Clock,
    next?: Array<string | Instance<T>>,
    refs?: Array<string | Instance<T>>,
  ): Promise<Instance<T>>
  export function verify<T>(
    identities: IdentitiesInstance,
    entry: Instance<T>,
  ): Promise<boolean>
  export function isEntry(obj: unknown): boolean
  export function isEqual<T>(a: Instance<T>, b: Instance<T>): boolean
  export function decode<T>(bytes: Uint8Array): Promise<Instance<T>>
  export function encode<T>(entry: Instance<T>): Promise<Uint8Array>
}

interface LogIteratorOptions {
  gt?: string
  gte?: string
  lt?: string
  lte?: string
  amount?: number
}
interface LogAppendOptions {
  referencesCount: number
}
interface LogOptions<T> {
  logId?: string
  logHeads?: EntryInstance<T>[]
  access?: AccessControllerInstance
  entries?: EntryInstance<T>[]
  entryStorage?: StorageInstance
  headsStorage?: StorageInstance
  indexStorage?: StorageInstance
  sortFn?: (a: EntryInstance<T>, b: EntryInstance<T>) => number
}
interface LogInstance<T> {
  id: string

  access?: AccessControllerInstance
  identity: IdentityInstance
  storage: StorageInstance

  clock: () => Promise<Clock>
  heads: () => Promise<EntryInstance<T>[]>
  values: () => Promise<EntryInstance<T>[]>
  all: () => Promise<EntryInstance<T>[]>
  get: (hash: string) => Promise<EntryInstance<T> | undefined>
  has: (hash: string) => Promise<boolean>
  append: (payload: T, options?: LogAppendOptions) => Promise<EntryInstance<T>>
  join: (log: LogInstance<T>) => Promise<void>
  joinEntry: (entry: EntryInstance<T>) => Promise<void>
  traverse: () => AsyncGenerator<EntryInstance<T>>
  iterator: (options?: LogIteratorOptions) => AsyncIterable<EntryInstance<T>>
  clear: () => Promise<void>
  close: () => Promise<void>
}
declare function Log<T>(
  ipfs: IPFS,
  identity: IdentityInstance,
  options?: LogOptions<T>,
): Promise<LogInstance<T>>

export type {
  Clock,
  LogAppendOptions,
  LogInstance,
  LogIteratorOptions,
  LogOptions,
}
export { Log }
