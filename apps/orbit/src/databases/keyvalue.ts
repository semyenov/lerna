import {
  Database,
  type DatabaseInstance,
  type DatabaseOptions,
} from '../database'

import type { DatabaseOperation, DatabaseType } from '.'
import type { AccessControllerInstance } from '../access-controllers'
import type { IdentityInstance } from '../identities'
import type { EntryInstance } from '../oplog'
import type { LogInstance } from '../oplog/log'
import type { StorageInstance } from '../storage'
import type { HeliaInstance } from '../vendor'

const type = 'keyvalue'

export interface KeyValueDatabaseOptions<T = unknown>
  extends DatabaseOptions<T> {
  ipfs: HeliaInstance
  identity?: IdentityInstance
  address?: string
  name?: string
  access?: AccessControllerInstance
  directory: string
  meta: any
  headsStorage?: StorageInstance<Uint8Array>
  entryStorage?: StorageInstance<EntryInstance<T>>
  indexStorage?: StorageInstance<boolean>
  referencesCount?: number
  syncAutomatically?: boolean
  onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>
}

export interface KeyValueEntry<T> {
  key?: string
  hash?: string
  value: T | null
}

export interface KeyValueInstance<T> extends DatabaseInstance<T> {
  type: 'keyvalue'
  indexBy?: string

  put: (key: string, value: T) => Promise<string>
  set: (key: string, value: T) => Promise<string>
  del: (key: string) => Promise<string>
  get: (key: string) => Promise<T | null>
  iterator: (options?: { amount?: number }) => AsyncIterable<KeyValueEntry<T>>
  all: () => Promise<KeyValueEntry<T>[]>
}

export const KeyValue: DatabaseType<'keyvalue'> =
  () =>
  async <T = unknown>(
    options: KeyValueDatabaseOptions<T>,
  ): Promise<KeyValueInstance<T>> => {
    const database = await Database<T>(options)
    const { addOperation, log } = database

    const put = async (key: string, value: T): Promise<string> => {
      return addOperation({ op: 'PUT', key, value })
    }

    const del = async (key: string): Promise<string> => {
      return addOperation({ op: 'DEL', key, value: null })
    }

    const get = async (key: string): Promise<T | null> => {
      for await (const entry of log.traverse()) {
        const { op, key: k, value } = entry.payload
        if (op === 'PUT' && k === key) {
          return value as T
        } else if (op === 'DEL' && k === key) {
          return null
        }
      }

      return null
    }

    const iterator = async function* ({
      amount,
    }: { amount?: number } = {}): AsyncIterable<KeyValueEntry<T>> {
      const keys: Record<string, boolean> = {}
      let count = 0
      for await (const entry of log.traverse()) {
        const { op, key, value } = entry.payload
        if (op === 'PUT' && !keys[key!]) {
          keys[key!] = true
          count++
          const hash = entry.hash!
          yield {
            key: key!,
            value: value || null,
            hash,
          } satisfies KeyValueEntry<T>
        } else if (op === 'DEL' && !keys[key!]) {
          keys[key!] = true
        }
        if (amount !== undefined && count >= amount) {
          break
        }
      }
    }

    const all = async (): Promise<KeyValueEntry<T>[]> => {
      const values: KeyValueEntry<T>[] = []
      for await (const entry of iterator()) {
        values.unshift(entry)
      }
      return values
    }

    const instance: KeyValueInstance<T> = {
      ...database,
      type,
      put,
      set: put,
      del,
      get,
      iterator,
      all,
    }

    return instance
  }

KeyValue.type = type
